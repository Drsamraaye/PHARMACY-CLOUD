import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Returns live platform totals and subscription/onboarding distributions. */
export async function GET(req: NextRequest) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const since = new Date(); since.setDate(since.getDate() - 30);
  const pharmacyFilter = { tenant: { slug: { not: "pharmacloud-platform" } } };
  const [pharmacies, subscriptions, sales, branches] = await Promise.all([
    prisma.tenant.findMany({ where: { slug: { not: "pharmacloud-platform" } }, select: { id: true, name: true, slug: true, isActive: true, createdAt: true, _count: { select: { users: true, branches: true } }, subscriptions: { select: { plan: true, status: true, trialEnds: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 } }, orderBy: { createdAt: "desc" }, take: 2000 }),
    prisma.subscription.groupBy({ by: ["status"], where: pharmacyFilter, _count: { _all: true } }),
    prisma.sale.aggregate({ where: { ...pharmacyFilter, createdAt: { gte: since }, status: { not: "VOID" } }, _sum: { total: true }, _count: { _all: true } }),
    prisma.branch.count({ where: { tenant: { slug: { not: "pharmacloud-platform" } } } }),
  ]);
  const latestSubscriptions = pharmacies.flatMap((tenant) => tenant.subscriptions.slice(0, 1));
  const planDistribution = Object.entries(latestSubscriptions.reduce<Record<string, number>>((counts, subscription) => { counts[subscription.plan] = (counts[subscription.plan] || 0) + 1; return counts; }, {})).map(([plan, count]) => ({ plan, count })).sort((a, b) => b.count - a.count);
  const trend = Array.from({ length: 6 }, (_, offset) => {
    const month = new Date(); month.setDate(1); month.setMonth(month.getMonth() - (5 - offset));
    const nextMonth = new Date(month); nextMonth.setMonth(nextMonth.getMonth() + 1);
    return { month: month.toLocaleDateString("en", { month: "short" }), count: pharmacies.filter((tenant) => tenant.createdAt >= month && tenant.createdAt < nextMonth).length };
  });
  const activeSubscriptions = Object.entries(Object.fromEntries(subscriptions.map((entry) => [entry.status, entry._count._all]))).filter(([status]) => ["ACTIVE", "TRIALING"].includes(status)).reduce((sum, [, count]) => sum + count, 0);
  const users = pharmacies.reduce((sum, tenant) => sum + tenant._count.users, 0);
  const activeTenants = pharmacies.filter((tenant) => tenant.isActive).length;
  return NextResponse.json({ data: { tenants: pharmacies.length, activeTenants, users, branches, subscriptions: Object.fromEntries(subscriptions.map((entry) => [entry.status, entry._count._all])), activeSubscriptions, planDistribution, onboardingTrend: trend, pharmacies: pharmacies.slice(0, 8), last30Days: { sales: Number(sales._sum.total || 0), transactions: sales._count._all } } });
}
