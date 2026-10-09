import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/auth";

const schema = z.object({ patientId: z.string().nullable().optional(), discount: z.coerce.number().min(0).default(0), paidAmount: z.coerce.number().min(0).default(0), paymentMethod: z.string().trim().max(80).nullable().optional(), createdAt: z.coerce.date().optional(), items: z.array(z.object({ productId: z.string().min(1), quantity: z.coerce.number().int().positive() })).min(1) });

/** Creates a sale from catalog prices and updates pharmacy batches in one transaction. */
export async function createSale(session: SessionUser, saleType: "PHARMACY" | "LAB" | "SERVICE", raw: unknown) {
  if (session.role === "PHARMACIST" && saleType !== "PHARMACY") throw new Error("Pharmacists can only create pharmacy sales");
  const input = schema.parse(raw);
  if (input.patientId) {
    const patient = await prisma.patient.findFirst({ where: { id: input.patientId, tenantId: session.tenantId, branchId: session.branchId, deletedAt: null }, select: { id: true } });
    if (!patient) throw new Error("Patient not found");
  }
  return prisma.$transaction(async (tx) => {
    const productIds = [...new Set(input.items.map((item) => item.productId))];
    const now = new Date();
    const products = await tx.product.findMany({ where: { tenantId: session.tenantId, branchId: session.branchId, id: { in: productIds }, isActive: true, type: saleType }, include: { batches: { where: { quantity: { gt: 0 }, OR: [{ expiryDate: null }, { expiryDate: { gte: now } }] }, orderBy: [{ expiryDate: "asc" }, { createdAt: "asc" }] } } });
    const byId = new Map(products.map((product) => [product.id, product]));
    if (byId.size !== productIds.length) throw new Error("One or more items are unavailable for this sale type");
    const prepared = input.items.map((item) => ({ ...item, product: byId.get(item.productId)! }));
    const subtotal = prepared.reduce((sum, item) => sum + Number(item.product.salePrice) * item.quantity, 0);
    if (input.discount > subtotal) throw new Error("Discount cannot exceed the sale subtotal");
    const total = Math.round((subtotal - input.discount) * 100) / 100;
    if (input.paidAmount > total) throw new Error("Paid amount cannot exceed the amount due");
    if (saleType === "PHARMACY") {
      for (const item of prepared) {
        let remaining = item.quantity;
        for (const batch of item.product.batches) {
          if (!remaining) break;
          const quantity = Math.min(remaining, batch.quantity);
          const updated = await tx.productBatch.updateMany({ where: { id: batch.id, quantity: { gte: quantity } }, data: { quantity: { decrement: quantity } } });
          if (!updated.count) throw new Error(`Stock changed while processing ${item.product.name}; please retry`);
          remaining -= quantity;
        }
        if (remaining) throw new Error(`Insufficient stock for ${item.product.name}`);
      }
    }
    return tx.sale.create({ data: { tenantId: session.tenantId, branchId: session.branchId, patientId: input.patientId || null, userId: session.userId, type: saleType, total, discount: input.discount, paidAmount: input.paidAmount, paymentMethod: input.paymentMethod || null, ...(session.role !== "PHARMACIST" && input.createdAt ? { createdAt: input.createdAt } : {}), status: input.paidAmount >= total ? "PAID" : "PARTIAL", items: { create: prepared.map((item) => ({ productId: item.productId, quantity: item.quantity, unitPrice: item.product.salePrice })) } }, include: { items: { include: { product: true } }, patient: true } });
  });
}
