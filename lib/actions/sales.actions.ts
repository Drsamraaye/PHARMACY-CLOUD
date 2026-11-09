import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/auth";
import { businessDateKey, businessDateRecord } from "@/lib/business-date";

const paymentSchema = z.object({ method: z.string().trim().min(1).max(80), currency: z.enum(["USD", "SLSh"]), amount: z.coerce.number().finite().positive().max(9_999_999_999.99) });
const schema = z.object({ patientId: z.string().nullable().optional(), discount: z.coerce.number().finite().min(0).max(9_999_999_999.99).default(0), paidAmount: z.coerce.number().finite().min(0).max(9_999_999_999.99).default(0), paymentMethod: z.string().trim().max(80).nullable().optional(), payments: z.array(paymentSchema).max(4).optional(), createdAt: z.coerce.date().optional(), items: z.array(z.object({ productId: z.string().min(1), quantity: z.coerce.number().int().positive().max(1_000_000) })).min(1) });

const cents = (value: number) => Math.round(value * 100);
const roundMoney = (value: number) => value / 100;
const methodCurrency = (method: string): "USD" | "SLSh" => /shilling|slsh|somaliland/i.test(method) ? "SLSh" : "USD";
const canonicalMethod = (method: string, currency: "USD" | "SLSh") => {
  const normalized = method.toLowerCase().replace(/[^a-z]/g, "");
  if (normalized.includes("cash") && (normalized.includes("shilling") || normalized.includes("slsh"))) return "Cash Shilling";
  if (normalized.includes("cash") && (normalized.includes("dollar") || normalized.includes("usd"))) return "Cash Dollar";
  if (normalized.includes("zaad") && (normalized.includes("shilling") || normalized.includes("slsh"))) return "Zaad Shilling";
  if (normalized.includes("zaad") && (normalized.includes("dollar") || normalized.includes("usd"))) return "Zaad Dollar";
  if (["cash", "zaad", "evcplus", "bank"].includes(normalized)) return method.trim(); // legacy USD method
  return currency === "USD" ? method.trim() : "";
};

/** Creates a sale from catalog prices and updates pharmacy batches in one transaction. */
export async function createSale(session: SessionUser, saleType: "PHARMACY" | "LAB" | "SERVICE", raw: unknown) {
  if (session.role === "PHARMACIST" && saleType !== "PHARMACY") throw new Error("Pharmacists can only create pharmacy sales");
  const input = schema.parse(raw);
  if (input.patientId) {
    const patient = await prisma.patient.findFirst({ where: { id: input.patientId, tenantId: session.tenantId, branchId: session.branchId, deletedAt: null }, select: { id: true } });
    if (!patient) throw new Error("Patient not found");
  }
  return prisma.$transaction(async (tx) => {
    const transactionDate = session.role !== "PHARMACIST" && input.createdAt ? input.createdAt : new Date();
    if (session.branchId) {
      const businessDate = businessDateRecord(businessDateKey(transactionDate));
      const closed = await tx.dailyCloseout.findFirst({ where: { tenantId: session.tenantId, branchId: session.branchId, businessDate }, select: { id: true } });
      if (closed) throw new Error("This branch business day has already been closed; record the sale in an open business day.");
    }
    const productIds = [...new Set(input.items.map((item) => item.productId))];
    const now = transactionDate;
    const products = await tx.product.findMany({ where: { tenantId: session.tenantId, branchId: session.branchId, id: { in: productIds }, isActive: true, type: saleType }, include: { batches: { where: { quantity: { gt: 0 }, OR: [{ expiryDate: null }, { expiryDate: { gte: now } }] }, orderBy: [{ expiryDate: "asc" }, { createdAt: "asc" }] } } });
    const byId = new Map(products.map((product) => [product.id, product]));
    if (byId.size !== productIds.length) throw new Error("One or more items are unavailable for this sale type");
    const prepared = input.items.map((item) => ({ ...item, product: byId.get(item.productId)! }));
    const subtotalCents = prepared.reduce((sum, item) => sum + cents(Number(item.product.salePrice)) * item.quantity, 0);
    const discountCents = cents(input.discount);
    if (discountCents > subtotalCents) throw new Error("Discount cannot exceed the sale subtotal");
    const totalCents = subtotalCents - discountCents;
    let payments = input.payments ?? [];
    if (!payments.length && input.paidAmount > 0) payments = [{ method: input.paymentMethod || "Cash Dollar", currency: methodCurrency(input.paymentMethod || "Cash Dollar"), amount: input.paidAmount }];
    const rateRow = await tx.exchangeRate.findFirst({ where: { tenantId: session.tenantId }, orderBy: { createdAt: "desc" } });
    if (!rateRow) throw new Error("Set the centralized exchange rate before recording sales");
    const rate = Number(rateRow.rate);
    const rateMicros = BigInt(Math.round(rate * 1_000_000));
    if (payments.some((payment) => payment.currency === "SLSh") && !rateRow) throw new Error("Set the centralized SLSh exchange rate before accepting shilling payments");
    const preparedPayments = payments.map((payment) => {
      const method = canonicalMethod(payment.method, payment.currency);
      if (!method || methodCurrency(payment.method) !== payment.currency && /shilling|dollar|slsh|usd/i.test(payment.method)) throw new Error("Payment method and currency do not match");
      const amountCents = cents(payment.amount);
      if (amountCents <= 0) throw new Error("Each payment must be greater than zero");
      const usdCents = payment.currency === "USD" ? amountCents : Number((BigInt(amountCents) * 1_000_000n + rateMicros / 2n) / rateMicros);
      return { method, currency: payment.currency, amountCents, usdCents };
    });
    if (!input.payments && input.paidAmount > 0 && input.paymentMethod && !preparedPayments.length) throw new Error("Invalid payment");
    const paidCents = preparedPayments.reduce((sum, payment) => sum + payment.usdCents, 0);
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
    const sale = await tx.sale.create({ data: { tenantId: session.tenantId, branchId: session.branchId, patientId: input.patientId || null, userId: session.userId, type: saleType, total: roundMoney(totalCents), totalUsd: roundMoney(totalCents), exchangeRate: rate.toFixed(6), discount: roundMoney(discountCents), paidAmount: roundMoney(paidCents), paymentMethod: preparedPayments.length === 1 ? preparedPayments[0].method : preparedPayments.length ? "SPLIT" : null, ...(session.role !== "PHARMACIST" && input.createdAt ? { createdAt: input.createdAt } : {}), status: paidCents === 0 ? "UNPAID" : paidCents < totalCents ? "PARTIAL" : paidCents === totalCents ? "PAID" : "OVERPAID", items: { create: prepared.map((item) => ({ productId: item.productId, quantity: item.quantity, unitPrice: item.product.salePrice, costPrice: item.product.costPrice })) } } });
    if (preparedPayments.length) await tx.salePayment.createMany({ data: preparedPayments.map((payment) => ({ tenantId: session.tenantId, branchId: session.branchId, saleId: sale.id, userId: session.userId, method: payment.method, currency: payment.currency, amount: roundMoney(payment.amountCents), exchangeRate: rate.toFixed(6), usdEquivalent: roundMoney(payment.usdCents), createdAt: transactionDate })) });
    const overpaidCents = Math.max(0, paidCents - totalCents);
    if (overpaidCents > 0 && !input.patientId) throw new Error("Select a customer before recording an overpayment so the excess can be saved as customer credit");
    if (overpaidCents > 0) await tx.creditNote.create({ data: { tenantId: session.tenantId, saleId: sale.id, patientId: input.patientId || null, amount: roundMoney(overpaidCents), remainingAmount: roundMoney(overpaidCents), status: "AVAILABLE" } });
    return tx.sale.findUniqueOrThrow({ where: { id: sale.id }, include: { items: { include: { product: true } }, patient: true, payments: true } });
  }, { isolationLevel: "Serializable" });
}
