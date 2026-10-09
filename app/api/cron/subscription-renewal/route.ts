import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** Expires ended trials and reports trials ending within seven days for reminder delivery. */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const now = new Date(); const horizon = new Date(now); horizon.setDate(horizon.getDate() + 7);
  const expired = await prisma.subscription.updateMany({ where: { status: "TRIALING", trialEnds: { lt: now } }, data: { status: "EXPIRED" } });
  const upcoming = await prisma.subscription.findMany({ where: { status: "TRIALING", trialEnds: { gte: now, lte: horizon } }, include: { tenant: { select: { id: true, name: true } } }, orderBy: { trialEnds: "asc" } });
  return NextResponse.json({ data: { expiredTrials: expired.count, remindersDue: upcoming.map((subscription) => ({ tenant: subscription.tenant, trialEnds: subscription.trialEnds })) } });
}
