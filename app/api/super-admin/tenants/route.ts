import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";

const provisionSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().min(2).max(60).regex(/^[a-z0-9-]+$/),
  ownerName: z.string().trim().min(2).max(120),
  ownerEmail: z.string().trim().email().max(254),
  ownerPassword: z.string().min(8).max(200),
  trialDays: z.coerce.number().int().min(0).max(90).default(14),
});

/** Lists platform tenants and their active user totals. */
export async function GET(req: NextRequest) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const data = await prisma.tenant.findMany({
    select: {
      id: true, name: true, slug: true, isActive: true, createdAt: true,
      _count: { select: { users: true } },
      subscriptions: { select: { id: true, plan: true, status: true, trialEnds: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" }, take: 1000,
  });
  return NextResponse.json({ data });
}

/** Provisions a tenant workspace and its initial branch. */
export async function POST(req: NextRequest) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  let input: unknown;
  try { input = await req.json(); } catch { return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 }); }
  const parsed = provisionSchema.safeParse(input);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid pharmacy details" }, { status: 400 });
  const values = parsed.data;
  const trialEnds = values.trialDays > 0 ? new Date(Date.now() + values.trialDays * 86400000) : null;
  try {
    const data = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({ data: { name: values.name, slug: values.slug } });
      const branch = await tx.branch.create({ data: { tenantId: tenant.id, name: "Main Branch" } });
      await tx.userProfile.create({ data: { tenantId: tenant.id, branchId: branch.id, email: values.ownerEmail.toLowerCase(), fullName: values.ownerName, passwordHash: hashPassword(values.ownerPassword), role: "OWNER" } });
      await tx.subscription.create({ data: { tenantId: tenant.id, plan: values.trialDays > 0 ? "TRIAL" : "BASIC", status: values.trialDays > 0 ? "TRIALING" : "ACTIVE", trialEnds } });
      return { id: tenant.id, name: tenant.name, slug: tenant.slug, isActive: tenant.isActive, createdAt: tenant.createdAt };
    });
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error("Pharmacy provisioning failed", error);
    return NextResponse.json({ error: "That pharmacy slug or owner email is already in use" }, { status: 409 });
  }
}
