import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Lists active branches in the current tenant. */
export async function GET(req: NextRequest) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const picker = req.nextUrl.searchParams.get("picker") === "true";
  const canChooseBranch = session.role === "OWNER";
  const canManageBranches = session.role === "OWNER" || session.role === "ADMIN";
  const where = { tenantId: session.tenantId, isActive: true, ...(picker && !canChooseBranch ? { id: session.branchId ?? "__unassigned__" } : !canManageBranches ? { id: session.branchId ?? "__unassigned__" } : {}) };
  const data = canManageBranches
    ? await prisma.branch.findMany({ where, select: { id: true, name: true, createdAt: true, isActive: true, _count: { select: { users: true, products: true, patients: true, sales: true, purchases: true } } }, orderBy: { name: "asc" } })
    : await prisma.branch.findMany({ where, select: { id: true, name: true, createdAt: true, isActive: true }, orderBy: { name: "asc" } });
  return NextResponse.json({ data });
}

/** Adds a uniquely named tenant branch. */
export async function POST(req: NextRequest) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "OWNER" && session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = z.object({ name: z.string().trim().min(2).max(100) }).safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Branch name is required" }, { status: 400 });
  try { const data = await prisma.branch.create({ data: { tenantId: session.tenantId, name: parsed.data.name } }); return NextResponse.json({ data }, { status: 201 }); }
  catch { return NextResponse.json({ error: "A branch with this name already exists" }, { status: 409 }); }
}

/** Renames an active branch inside the current tenant. */
export async function PUT(req: NextRequest) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "OWNER" && session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = z.object({ id: z.string(), name: z.string().trim().min(2).max(100) }).safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Branch id and name are required" }, { status: 400 });
  const branch = await prisma.branch.findFirst({ where: { id: parsed.data.id, tenantId: session.tenantId, isActive: true } });
  if (!branch) return NextResponse.json({ error: "Branch not found" }, { status: 404 });
  try { const data = await prisma.branch.update({ where: { id: branch.id }, data: { name: parsed.data.name } }); return NextResponse.json({ data }); }
  catch { return NextResponse.json({ error: "A branch with this name already exists" }, { status: 409 }); }
}

/** Archives an empty branch, keeping branch history intact. */
export async function DELETE(req: NextRequest) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "OWNER" && session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = z.object({ id: z.string() }).safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Branch id is required" }, { status: 400 });
  const branch = await prisma.branch.findFirst({ where: { id: parsed.data.id, tenantId: session.tenantId, isActive: true }, include: { _count: { select: { users: true, products: true, patients: true, sales: true, purchases: true, suppliers: true, bankAccounts: true } } } });
  if (!branch) return NextResponse.json({ error: "Branch not found" }, { status: 404 });
  if (session.branchId === branch.id) return NextResponse.json({ error: "Choose another active branch before archiving this one." }, { status: 409 });
  const activeBranches = await prisma.branch.count({ where: { tenantId: session.tenantId, isActive: true } });
  if (activeBranches <= 1) return NextResponse.json({ error: "The pharmacy must keep at least one active branch." }, { status: 409 });
  const linkedRecords = Object.values(branch._count).reduce((sum, count) => sum + count, 0);
  if (linkedRecords > 0) return NextResponse.json({ error: "Branch-ku wali wuxuu leeyahay users ama xog ku xiran. Marka hore u rar ama ka saar xogtaas." }, { status: 409 });
  await prisma.branch.update({ where: { id: branch.id }, data: { isActive: false } });
  return NextResponse.json({ data: { id: branch.id, archived: true } });
}
