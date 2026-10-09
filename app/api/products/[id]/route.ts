import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateProductSchema } from "@/lib/validators/products.schema";

type Context = { params: Promise<{ id: string }> };

/** Fetches one product including its current batch stock. */
export async function GET(req: NextRequest, { params }: Context) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const product = await prisma.product.findFirst({ where: { id, tenantId: session.tenantId, ...(session.branchId ? { branchId: session.branchId } : {}) }, include: { batches: true } });
  return product ? NextResponse.json({ data: { ...product, quantity: product.batches.reduce((n, batch) => n + batch.quantity, 0) } }) : NextResponse.json({ error: "Product not found" }, { status: 404 });
}

/** Updates product catalog fields within the current tenant. */
export async function PUT(req: NextRequest, { params }: Context) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  let input: unknown;
  try { input = await req.json(); } catch { return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 }); }
  const parsed = updateProductSchema.safeParse(input);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid product" }, { status: 400 });
  const result = await prisma.$transaction(async (tx) => {
    const where = { id, tenantId: session.tenantId, ...(session.branchId ? { branchId: session.branchId } : {}) };
    const updated = await tx.product.updateMany({ where, data: parsed.data });
    if (!updated.count) return null;
    const product = await tx.product.findUnique({ where: { id } });
    await tx.productHistory.create({ data: { tenantId: session.tenantId, productId: id, userId: session.userId, action: parsed.data.isActive === false ? "ARCHIVED" : parsed.data.isActive === true ? "REACTIVATED" : "UPDATED", details: JSON.stringify(parsed.data) } });
    return product;
  });
  return result ? NextResponse.json({ data: result }) : NextResponse.json({ error: "Product not found" }, { status: 404 });
}

/** Archives a product without deleting its sales or inventory history. */
export async function DELETE(req: NextRequest, { params }: Context) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.product.updateMany({ where: { id, tenantId: session.tenantId, ...(session.branchId ? { branchId: session.branchId } : {}) }, data: { isActive: false } });
    if (!updated.count) return false;
    await tx.productHistory.create({ data: { tenantId: session.tenantId, productId: id, userId: session.userId, action: "ARCHIVED", details: "Product archived" } });
    return true;
  });
  return result ? NextResponse.json({ data: { id, isActive: false } }) : NextResponse.json({ error: "Product not found" }, { status: 404 });
}
