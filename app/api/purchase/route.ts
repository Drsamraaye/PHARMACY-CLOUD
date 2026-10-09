import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({ supplierId: z.string().optional(), invoiceNo: z.string().optional(), purchaseDate: z.string().optional().refine((value) => !value || !Number.isNaN(Date.parse(value)), "Purchase date is invalid"), discount: z.coerce.number().min(0).default(0), paidAmount: z.coerce.number().min(0).default(0), notes: z.string().optional(), items: z.array(z.object({ productId: z.string(), quantity: z.coerce.number().int().positive(), costPrice: z.coerce.number().min(0), salePrice: z.coerce.number().min(0).optional(), expiryDate: z.string().optional(), batchNo: z.string().optional() })).min(1) });

/** Lists purchases for the active tenant and branch. */
export async function GET(req: NextRequest) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const data = await prisma.purchase.findMany({ where: { tenantId: session.tenantId, ...(session.branchId ? { branchId: session.branchId } : {}) }, include: { supplier: true, items: { include: { product: true } } }, orderBy: { createdAt: "desc" }, take: 500 });
  return NextResponse.json({ data });
}

/** Records a supplier purchase and receives its products into batches atomically. */
export async function POST(req: NextRequest) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await req.json()); if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid purchase" }, { status: 400 });
  const input = parsed.data; const ids = [...new Set(input.items.map((line) => line.productId))];
  const products = await prisma.product.findMany({ where: { tenantId: session.tenantId, id: { in: ids }, isActive: true, ...(session.branchId ? { branchId: session.branchId } : {}) }, select: { id: true } });
  if (products.length !== ids.length) return NextResponse.json({ error: "One or more products were not found" }, { status: 400 });
  if (input.supplierId && !await prisma.supplier.findFirst({ where: { id: input.supplierId, tenantId: session.tenantId, ...(session.branchId ? { branchId: session.branchId } : {}) } })) return NextResponse.json({ error: "Supplier not found in this branch" }, { status: 400 });
  const subtotal = input.items.reduce((sum, line) => sum + line.quantity * line.costPrice, 0); const total = Math.round((subtotal - input.discount) * 100) / 100;
  if (input.discount > subtotal || input.paidAmount > total) return NextResponse.json({ error: "Discount or paid amount exceeds the purchase total" }, { status: 400 });
  const purchase = await prisma.$transaction(async (tx) => {
    const created = await tx.purchase.create({ data: { tenantId: session.tenantId, branchId: session.branchId, supplierId: input.supplierId || null, total, discount: input.discount, paidAmount: input.paidAmount, invoiceNo: input.invoiceNo || null, notes: input.notes || null, ...(input.purchaseDate ? { createdAt: new Date(input.purchaseDate) } : {}), status: input.paidAmount >= total ? "PAID" : input.paidAmount > 0 ? "PARTIAL" : "UNPAID", items: { create: input.items.map((line) => ({ productId: line.productId, quantity: line.quantity, costPrice: line.costPrice })) } }, include: { items: true, supplier: true } });
    for (const line of input.items) {
      await tx.productBatch.create({ data: { productId: line.productId, quantity: line.quantity, costPrice: line.costPrice, expiryDate: line.expiryDate ? new Date(line.expiryDate) : null, batchNo: line.batchNo || null } });
      if (line.salePrice !== undefined) await tx.product.updateMany({ where: { id: line.productId, tenantId: session.tenantId }, data: { salePrice: line.salePrice } });
    }
    return created;
  });
  return NextResponse.json({ data: purchase }, { status: 201 });
}
