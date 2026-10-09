import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
type Context = { params: Promise<{ id: string }> };

/** Reads a tenant supplier and its purchase summary. */
export async function GET(req: NextRequest, { params }: Context) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params; const data = await prisma.supplier.findFirst({ where: { id, tenantId: session.tenantId, ...(session.branchId ? { branchId: session.branchId } : {}) }, include: { purchases: { where: session.branchId ? { branchId: session.branchId } : {}, orderBy: { createdAt: "desc" }, take: 50 } } });
  return data ? NextResponse.json({ data }) : NextResponse.json({ error: "Supplier not found" }, { status: 404 });
}

/** Updates supplier contact and payment-term details. */
export async function PUT(req: NextRequest, { params }: Context) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = z.object({ name: z.string().trim().min(2).optional(), phone: z.string().nullable().optional(), email: z.string().email().nullable().optional(), address: z.string().nullable().optional(), city: z.string().nullable().optional(), country: z.string().nullable().optional(), paymentTerms: z.string().nullable().optional(), notes: z.string().nullable().optional() }).safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid supplier details" }, { status: 400 });
  const { id } = await params; const result = await prisma.supplier.updateMany({ where: { id, tenantId: session.tenantId, ...(session.branchId ? { branchId: session.branchId } : {}) }, data: parsed.data });
  return result.count ? NextResponse.json({ data: await prisma.supplier.findUnique({ where: { id } }) }) : NextResponse.json({ error: "Supplier not found" }, { status: 404 });
}

/** Removes a supplier only when no purchase history depends on it. */
export async function DELETE(_req: NextRequest, { params }: Context) {
  const session = await getSession(_req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const supplier = await prisma.supplier.findFirst({ where: { id, tenantId: session.tenantId, ...(session.branchId ? { branchId: session.branchId } : {}) }, select: { id: true } });
  if (!supplier) return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
  const purchases = await prisma.purchase.count({ where: { supplierId: id, tenantId: session.tenantId, ...(session.branchId ? { branchId: session.branchId } : {}) } });
  if (purchases) return NextResponse.json({ error: "Supplier cannot be deleted because purchase history is linked to it." }, { status: 409 });
  await prisma.supplier.deleteMany({ where: { id, tenantId: session.tenantId, ...(session.branchId ? { branchId: session.branchId } : {}) } });
  return NextResponse.json({ data: { id } });
}
