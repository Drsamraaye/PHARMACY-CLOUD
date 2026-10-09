import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const subscriptionSchema = z.object({
  tenantId: z.string().min(1),
  plan: z.enum(["TRIAL", "BASIC", "PRO", "ENTERPRISE"]),
  status: z.enum(["TRIALING", "ACTIVE", "PAST_DUE", "CANCELED", "SUSPENDED"]).default("ACTIVE"),
  trialDays: z.coerce.number().int().min(1).max(90).default(14),
});

/** Lists subscription history with the associated pharmacy for platform management. */
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const data = await prisma.subscription.findMany({
    where: { tenant: { slug: { not: "pharmacloud-platform" } } },
    select: { id: true, tenantId: true, plan: true, status: true, trialEnds: true, createdAt: true, tenant: { select: { id: true, name: true, slug: true, isActive: true } } },
    orderBy: { createdAt: "desc" }, take: 2000,
  });
  return NextResponse.json({ data });
}

/** Grants or upgrades a pharmacy plan, retaining prior subscription records as billing history. */
export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  let input: unknown;
  try { input = await req.json(); } catch { return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 }); }
  const parsed = subscriptionSchema.safeParse(input);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid subscription details" }, { status: 400 });
  const tenant = await prisma.tenant.findFirst({ where: { id: parsed.data.tenantId, slug: { not: "pharmacloud-platform" } }, select: { id: true } });
  if (!tenant) return NextResponse.json({ error: "Pharmacy not found" }, { status: 404 });
  const trialEnds = parsed.data.status === "TRIALING" ? new Date(Date.now() + parsed.data.trialDays * 86400000) : null;
  const data = await prisma.subscription.create({ data: { tenantId: tenant.id, plan: parsed.data.plan, status: parsed.data.status, trialEnds } });
  return NextResponse.json({ data }, { status: 201 });
}
