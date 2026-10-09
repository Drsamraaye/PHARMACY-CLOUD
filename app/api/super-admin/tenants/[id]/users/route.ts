import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ id: string }> };
const userSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(200),
  role: z.enum(["OWNER", "ADMIN", "PHARMACIST", "DOCTOR", "RECEPTIONIST", "CASHIER", "ACCOUNTANT", "USER"]),
  branchId: z.string().optional(),
});
const userUpdateSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["OWNER", "ADMIN", "PHARMACIST", "DOCTOR", "RECEPTIONIST", "CASHIER", "ACCOUNTANT", "USER"]).optional(),
  branchId: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
}).refine((value) => value.role !== undefined || value.isActive !== undefined, "Choose a role or account status to update");

async function requireSuperAdmin(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (session.role !== "SUPER_ADMIN") return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { session };
}

/** Lists a pharmacy's users without exposing password hashes. */
export async function GET(req: NextRequest, { params }: Context) {
  const auth = await requireSuperAdmin(req);
  if (auth.error) return auth.error;
  const { id: tenantId } = await params;
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
  if (!tenant) return NextResponse.json({ error: "Pharmacy not found" }, { status: 404 });
  const data = await prisma.userProfile.findMany({
    where: { tenantId },
    select: { id: true, fullName: true, email: true, role: true, isActive: true, branchId: true, createdAt: true },
    orderBy: { fullName: "asc" },
  });
  return NextResponse.json({ data });
}

/** Adds a pharmacy staff account with a tenant-local email and securely hashed password. */
export async function POST(req: NextRequest, { params }: Context) {
  const auth = await requireSuperAdmin(req);
  if (auth.error) return auth.error;
  const { id: tenantId } = await params;
  let input: unknown;
  try { input = await req.json(); } catch { return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 }); }
  const parsed = userSchema.safeParse(input);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid user details" }, { status: 400 });
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
  if (!tenant) return NextResponse.json({ error: "Pharmacy not found" }, { status: 404 });
  const branch = parsed.data.branchId
    ? await prisma.branch.findFirst({ where: { id: parsed.data.branchId, tenantId, isActive: true }, select: { id: true } })
    : await prisma.branch.findFirst({ where: { tenantId, isActive: true }, orderBy: { createdAt: "asc" }, select: { id: true } });
  if (parsed.data.branchId && !branch) {
    return NextResponse.json({ error: "Branch does not belong to this pharmacy" }, { status: 400 });
  }
  if (!branch && parsed.data.role !== "OWNER") return NextResponse.json({ error: "This pharmacy needs an active branch before staff can be created" }, { status: 400 });
  try {
    const data = await prisma.userProfile.create({
      data: { tenantId, fullName: parsed.data.fullName, email: parsed.data.email.toLowerCase(), passwordHash: hashPassword(parsed.data.password), role: parsed.data.role, branchId: branch?.id },
      select: { id: true, fullName: true, email: true, role: true, isActive: true, branchId: true, createdAt: true },
    });
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error("Pharmacy user creation failed", error);
    return NextResponse.json({ error: "A user with this email already exists in the pharmacy" }, { status: 409 });
  }
}

/** Updates a pharmacy user's role or access state without allowing tenant changes. */
export async function PATCH(req: NextRequest, { params }: Context) {
  const auth = await requireSuperAdmin(req);
  if (auth.error) return auth.error;
  const { id: tenantId } = await params;
  let input: unknown;
  try { input = await req.json(); } catch { return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 }); }
  const parsed = userUpdateSchema.safeParse(input);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid user update" }, { status: 400 });
  const user = await prisma.userProfile.findFirst({ where: { id: parsed.data.userId, tenantId }, select: { id: true, role: true, branchId: true } });
  if (!user) return NextResponse.json({ error: "User not found in this pharmacy" }, { status: 404 });
  if (user.role === "SUPER_ADMIN") return NextResponse.json({ error: "Platform administrator accounts cannot be managed here" }, { status: 403 });
  if (parsed.data.branchId && !await prisma.branch.findFirst({ where: { id: parsed.data.branchId, tenantId, isActive: true }, select: { id: true } })) return NextResponse.json({ error: "Branch does not belong to this pharmacy" }, { status: 400 });
  const nextBranchId = parsed.data.branchId === undefined ? user.branchId : parsed.data.branchId;
  if (!nextBranchId && (parsed.data.role ?? user.role) !== "OWNER") return NextResponse.json({ error: "Staff users must be assigned to an active branch" }, { status: 400 });
  if (user.role === "OWNER" && (parsed.data.isActive === false || (parsed.data.role !== undefined && parsed.data.role !== "OWNER"))) {
    const activeOwners = await prisma.userProfile.count({ where: { tenantId, role: "OWNER", isActive: true } });
    if (activeOwners <= 1) return NextResponse.json({ error: "Pharmacy must keep at least one active owner" }, { status: 409 });
  }
  const { userId: _userId, ...update } = parsed.data;
  const data = await prisma.userProfile.update({ where: { id: user.id }, data: update, select: { id: true, fullName: true, email: true, role: true, isActive: true, branchId: true, createdAt: true } });
  return NextResponse.json({ data });
}
