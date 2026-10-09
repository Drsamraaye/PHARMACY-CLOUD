import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
type Context = { params: Promise<{ id: string }> };

/** Reads one user profile without returning credential data. */
export async function GET(req: NextRequest, { params }: Context) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "OWNER" && session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params; const data = await prisma.userProfile.findFirst({ where: { id, tenantId: session.tenantId }, select: { id: true, email: true, fullName: true, role: true, isActive: true, branchId: true, groupId: true, createdAt: true } });
  return data ? NextResponse.json({ data }) : NextResponse.json({ error: "User not found" }, { status: 404 });
}

/** Updates tenant user details and optionally sets a new password. */
export async function PUT(req: NextRequest, { params }: Context) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "OWNER" && session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = z.object({ email: z.string().email().optional(), fullName: z.string().trim().min(2).optional(), role: z.enum(["OWNER", "ADMIN", "PHARMACIST", "DOCTOR", "RECEPTIONIST", "CASHIER", "ACCOUNTANT", "USER"]).optional(), branchId: z.string().nullable().optional(), groupId: z.string().nullable().optional(), isActive: z.boolean().optional(), password: z.string().min(8).optional() }).safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid user details" }, { status: 400 });
  const { id } = await params; const target = await prisma.userProfile.findFirst({ where: { id, tenantId: session.tenantId } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (target.role === "SUPER_ADMIN") return NextResponse.json({ error: "Platform administrator accounts cannot be managed here" }, { status: 403 });
  if (id === session.userId && parsed.data.isActive === false) return NextResponse.json({ error: "You cannot deactivate your own account" }, { status: 400 });
  if (target.role === "OWNER" && session.role !== "OWNER" && (parsed.data.isActive === false || parsed.data.role !== undefined && parsed.data.role !== "OWNER")) return NextResponse.json({ error: "Only an owner may change an owner account" }, { status: 403 });
  if (parsed.data.role === "OWNER" && session.role !== "OWNER") return NextResponse.json({ error: "Only an owner may assign the owner role" }, { status: 403 });
  if (parsed.data.branchId && !await prisma.branch.findFirst({ where: { id: parsed.data.branchId, tenantId: session.tenantId, isActive: true } })) return NextResponse.json({ error: "Branch not found in this pharmacy" }, { status: 400 });
  if (parsed.data.groupId && !await prisma.adminGroup.findFirst({ where: { id: parsed.data.groupId, tenantId: session.tenantId } })) return NextResponse.json({ error: "User group not found in this pharmacy" }, { status: 400 });
  const resultingRole = parsed.data.role ?? target.role;
  const resultingBranchId = parsed.data.branchId === undefined ? target.branchId : parsed.data.branchId;
  if (!resultingBranchId) return NextResponse.json({ error: "User kasta waa in branch firfircoon loo qoondeeyo" }, { status: 400 });
  if (target.role === "OWNER" && (parsed.data.isActive === false || (parsed.data.role !== undefined && parsed.data.role !== "OWNER"))) {
    const ownerCount = await prisma.userProfile.count({ where: { tenantId: session.tenantId, role: "OWNER", isActive: true } });
    if (ownerCount <= 1) return NextResponse.json({ error: "Pharmacy must keep at least one active owner" }, { status: 409 });
  }
  const { password, ...fields } = parsed.data;
  const result = await prisma.userProfile.updateMany({ where: { id, tenantId: session.tenantId }, data: { ...fields, ...(password ? { passwordHash: hashPassword(password) } : {}) } });
  if (!result.count) return NextResponse.json({ error: "User not found" }, { status: 404 });
  return NextResponse.json({ data: await prisma.userProfile.findUnique({ where: { id }, select: { id: true, email: true, fullName: true, role: true, isActive: true, branchId: true, groupId: true } }) });
}

/** Deactivates a user account without deleting its audit history. */
export async function DELETE(req: NextRequest, { params }: Context) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "OWNER" && session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params; if (id === session.userId) return NextResponse.json({ error: "You cannot deactivate your own account" }, { status: 400 });
  const target = await prisma.userProfile.findFirst({ where: { id, tenantId: session.tenantId }, select: { role: true } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (target.role === "SUPER_ADMIN") return NextResponse.json({ error: "Platform administrator accounts cannot be managed here" }, { status: 403 });
  if (target.role === "OWNER") {
    if (session.role !== "OWNER") return NextResponse.json({ error: "Only an owner may deactivate another owner" }, { status: 403 });
    const ownerCount = await prisma.userProfile.count({ where: { tenantId: session.tenantId, role: "OWNER", isActive: true } });
    if (ownerCount <= 1) return NextResponse.json({ error: "Pharmacy must keep at least one active owner" }, { status: 409 });
  }
  const result = await prisma.userProfile.updateMany({ where: { id, tenantId: session.tenantId }, data: { isActive: false } });
  return result.count ? NextResponse.json({ data: { id, isActive: false } }) : NextResponse.json({ error: "User not found" }, { status: 404 });
}
