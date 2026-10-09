import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

type ExchangeRecord = Record<string, unknown>;
const recordOf = (value: unknown): ExchangeRecord => value && typeof value === "object" && !Array.isArray(value) ? value as ExchangeRecord : {};
const rateOf = (value: ExchangeRecord) => Number(value.newRate ?? value.rate ?? value.todayRate ?? value.exchangeRate ?? 0);

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await prisma.moduleRecord.findMany({ where: { tenantId: session.tenantId, collection: "setup/exchange-rate", deletedAt: null, ...(session.branchId ? { branchId: session.branchId } : {}) }, orderBy: { createdAt: "desc" }, take: 5000 });
  const userIds = [...new Set(rows.map(row => row.createdBy).filter((id): id is string => Boolean(id)))];
  const branchIds = [...new Set(rows.map(row => row.branchId).filter((id): id is string => Boolean(id)))];
  const [users, branches] = await Promise.all([
    prisma.userProfile.findMany({ where: { tenantId: session.tenantId, id: { in: userIds } }, select: { id: true, fullName: true } }),
    prisma.branch.findMany({ where: { tenantId: session.tenantId, id: { in: branchIds } }, select: { id: true, name: true } }),
  ]);
  const userNames = new Map(users.map(user => [user.id, user.fullName]));
  const branchNames = new Map(branches.map(branch => [branch.id, branch.name]));
  const history = rows.map((row, index) => {
    const value = recordOf(row.record);
    const newRate = rateOf(value);
    const olderValue = index + 1 < rows.length ? recordOf(rows[index + 1].record) : {};
    const previousRate = rateOf(olderValue);
    const oldRate = Number(value.oldRate ?? value.previousRate ?? (previousRate > 0 ? previousRate : newRate));
    return { id: row.id, updatedAt: row.createdAt, updatedBy: row.createdBy ? userNames.get(row.createdBy) || "—" : "—", branch: row.branchId ? branchNames.get(row.branchId) || "—" : "—", oldRate, newRate, difference: Number(value.difference ?? newRate - oldRate) };
  }).filter(row => row.newRate > 0);
  return NextResponse.json({ data: history.slice(0, 1), history, currentRate: history[0]?.newRate ?? null });
}

async function saveRate(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = z.object({ rate: z.coerce.number().positive().finite() }).safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid exchange rate greater than zero." }, { status: 400 });
  const previous = await prisma.moduleRecord.findFirst({ where: { tenantId: session.tenantId, collection: "setup/exchange-rate", deletedAt: null, ...(session.branchId ? { branchId: session.branchId } : {}) }, orderBy: { createdAt: "desc" } });
  const oldRate = previous ? rateOf(recordOf(previous.record)) : parsed.data.rate;
  const newRate = parsed.data.rate;
  const data = await prisma.moduleRecord.create({ data: { tenantId: session.tenantId, branchId: session.branchId, collection: "setup/exchange-rate", createdBy: session.userId, record: { rate: newRate, oldRate, newRate, difference: newRate - oldRate } as Prisma.InputJsonValue } });
  return NextResponse.json({ data: { id: data.id, rate: newRate, oldRate, newRate, difference: newRate - oldRate, updatedAt: data.createdAt } }, { status: 201 });
}

export const POST = saveRate;
export const PUT = saveRate;
