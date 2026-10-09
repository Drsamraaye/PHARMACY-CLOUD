import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ id: string }> };
const updateSchema = z.object({ fullName: z.string().trim().min(2).max(160).optional(), phone: z.string().trim().max(40).nullable().optional(), email: z.string().email().nullable().optional(), age: z.coerce.number().int().min(0).max(125).nullable().optional(), gender: z.string().trim().max(30).nullable().optional(), restore: z.boolean().optional() });

/** Reads one patient constrained to the authenticated tenant. */
export async function GET(req: NextRequest, { params }: Context) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const patient = await prisma.patient.findFirst({ where: { id, tenantId: session.tenantId, ...(session.branchId ? { branchId: session.branchId } : {}) } });
  return patient ? NextResponse.json({ data: patient }) : NextResponse.json({ error: "Patient not found" }, { status: 404 });
}

/** Updates an existing tenant patient, or restores it when restore=true. */
export async function PUT(req: NextRequest, { params }: Context) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params; const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid patient" }, { status: 400 });
  const { restore, ...data } = parsed.data;
  const result = await prisma.patient.updateMany({ where: { id, tenantId: session.tenantId, ...(session.branchId ? { branchId: session.branchId } : {}) }, data: { ...data, ...(restore ? { deletedAt: null } : {}) } });
  if (!result.count) return NextResponse.json({ error: "Patient not found" }, { status: 404 });
  return NextResponse.json({ data: await prisma.patient.findUnique({ where: { id } }) });
}

/** Soft-deletes a patient while preserving their clinical and transaction history. */
export async function DELETE(req: NextRequest, { params }: Context) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params; const result = await prisma.patient.updateMany({ where: { id, tenantId: session.tenantId, ...(session.branchId ? { branchId: session.branchId } : {}), deletedAt: null }, data: { deletedAt: new Date() } });
  return result.count ? NextResponse.json({ data: { id, deleted: true } }) : NextResponse.json({ error: "Patient not found" }, { status: 404 });
}
