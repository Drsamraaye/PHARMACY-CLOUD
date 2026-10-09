import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Builds actionable platform notices from current tenant and subscription state. */
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const now = new Date(); const week = new Date(now); week.setDate(week.getDate() + 7);
  const [inactiveTenants, pastDue, trials, inactiveUsers] = await Promise.all([
    prisma.tenant.findMany({ where: { slug: { not: "pharmacloud-platform" }, isActive: false }, select: { id: true, name: true, slug: true, createdAt: true }, take: 200, orderBy: { createdAt: "desc" } }),
    prisma.subscription.findMany({ where: { status: "PAST_DUE", tenant: { slug: { not: "pharmacloud-platform" } } }, select: { id: true, plan: true, createdAt: true, tenant: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" }, take: 200 }),
    prisma.subscription.findMany({ where: { status: "TRIALING", trialEnds: { gte: now, lte: week }, tenant: { slug: { not: "pharmacloud-platform" }, isActive: true } }, select: { id: true, plan: true, trialEnds: true, tenant: { select: { id: true, name: true } } }, orderBy: { trialEnds: "asc" }, take: 200 }),
    prisma.userProfile.count({ where: { isActive: false, tenant: { slug: { not: "pharmacloud-platform" } } } }),
  ]);
  const alerts = [
    ...inactiveTenants.map((tenant) => ({ id: `tenant-${tenant.id}`, kind: "PHARMACY_INACTIVE", title: `${tenant.name} is inactive`, detail: `Workspace ${tenant.slug} is currently suspended.`, createdAt: tenant.createdAt, href: "/tenants", severity: "warning" })),
    ...pastDue.map((subscription) => ({ id: `past-due-${subscription.id}`, kind: "PAYMENT_PAST_DUE", title: `${subscription.tenant.name} has a past-due subscription`, detail: `${subscription.plan} · recorded ${subscription.createdAt.toLocaleDateString()}`, createdAt: subscription.createdAt, href: "/subscriptions", severity: "critical" })),
    ...trials.map((subscription) => ({ id: `trial-${subscription.id}`, kind: "TRIAL_ENDING", title: `${subscription.tenant.name} trial is ending`, detail: `Trial ends ${subscription.trialEnds?.toLocaleDateString() ?? "soon"}.`, createdAt: subscription.trialEnds ?? now, href: "/subscriptions", severity: "info" })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return NextResponse.json({ data: { alerts, summary: { inactivePharmacies: inactiveTenants.length, pastDueSubscriptions: pastDue.length, trialsEnding: trials.length, inactiveUsers } } });
}
