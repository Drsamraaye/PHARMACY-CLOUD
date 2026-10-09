import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Lists tenant users without exposing password hashes. */
export async function GET(req: NextRequest) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "OWNER" && session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const data = await prisma.userProfile.findMany({ where: { tenantId: session.tenantId }, select: { id: true, email: true, fullName: true, role: true, isActive: true, branchId: true, groupId: true, createdAt: true }, orderBy: { fullName: "asc" } });
  return NextResponse.json({ data });
}

/** Creates a tenant user with a securely hashed password and optional group. */
export async function POST(req: NextRequest) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(["OWNER", "ADMIN"].includes(session.role))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = z.object({ email: z.string().email(), fullName: z.string().trim().min(2), password: z.string().min(8), role: z.enum(["OWNER", "ADMIN", "PHARMACIST", "DOCTOR", "RECEPTIONIST", "CASHIER", "ACCOUNTANT", "USER"]).default("USER"), branchId: z.string().optional(), groupId: z.string().optional() }).safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid user" }, { status: 400 });
  const input = parsed.data;
  if (input.role === "OWNER" && session.role !== "OWNER") return NextResponse.json({ error: "Only an owner may create another owner" }, { status: 403 });
  if (!input.branchId) return NextResponse.json({ error: "Dooro branch-ka user-kan loo qoondeynayo." }, { status: 400 });
  if (!await prisma.branch.findFirst({ where: { id: input.branchId, tenantId: session.tenantId, isActive: true } })) return NextResponse.json({ error: "Branch not found or inactive" }, { status: 400 });
  if (input.groupId && !await prisma.adminGroup.findFirst({ where: { id: input.groupId, tenantId: session.tenantId } })) return NextResponse.json({ error: "User group not found" }, { status: 400 });
  try { const data = await prisma.userProfile.create({ data: { tenantId: session.tenantId, email: input.email.toLowerCase(), fullName: input.fullName, passwordHash: hashPassword(input.password), role: input.role, branchId: input.branchId, groupId: input.groupId }, select: { id: true, email: true, fullName: true, role: true, branchId: true, groupId: true } }); return NextResponse.json({ data }, { status: 201 }); }
  catch { return NextResponse.json({ error: "A user with this email already exists in the tenant" }, { status: 409 }); }
}
