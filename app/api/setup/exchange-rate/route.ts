import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [rates, legacy] = await Promise.all([prisma.exchangeRate.findMany({
    where: { tenantId: session.tenantId }, orderBy: { createdAt: "desc" }, take: 500,
  }), prisma.moduleRecord.findMany({ where: { tenantId: session.tenantId, collection: "setup/exchange-rate", deletedAt: null }, orderBy: { createdAt: "desc" }, take: 500 })]);
  const userIds = [...new Set([...rates.map((row) => row.updatedBy), ...legacy.map((row) => row.createdBy)].filter((id): id is string => Boolean(id)))];
  const users = await prisma.userProfile.findMany({ where: { tenantId: session.tenantId, id: { in: userIds } }, select: { id: true, fullName: true } });
  const names = new Map(users.map((user) => [user.id, user.fullName]));
  const legacyHistory = legacy.flatMap((row) => {
    const value = row.record && typeof row.record === "object" && !Array.isArray(row.record) ? row.record as Record<string, unknown> : {};
    const newRate = Number(value.newRate ?? value.rate ?? value.todayRate ?? value.exchangeRate ?? 0);
    return newRate > 0 ? [{ id: row.id, newRate, updatedAt: row.createdAt, updatedBy: row.createdBy ? names.get(row.createdBy) ?? "—" : "—", branch: "Legacy rate" }] : [];
  });
  const rateHistory = rates.map((row) => ({ id: row.id, newRate: Number(row.rate), updatedAt: row.createdAt, updatedBy: row.updatedBy ? names.get(row.updatedBy) ?? "—" : "—", branch: "All branches" }));
  const history = [...rateHistory, ...legacyHistory].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  const current = rates[0]?.rate ?? legacyHistory[0]?.newRate ?? null;
  return NextResponse.json({ data: history.slice(0, 1), history, currentRate: current });
}

async function saveRate(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["OWNER", "ADMIN", "SUPER_ADMIN"].includes(session.role)) return NextResponse.json({ error: "Only an owner or admin can update the centralized exchange rate." }, { status: 403 });
  const parsed = z.object({ rate: z.coerce.number().finite().min(0.000001).max(1_000_000_000) }).safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid exchange rate greater than zero." }, { status: 400 });
  const previous = await prisma.exchangeRate.findFirst({ where: { tenantId: session.tenantId }, orderBy: { createdAt: "desc" } });
  const rate = parsed.data.rate.toFixed(6);
  const row = await prisma.exchangeRate.create({ data: { tenantId: session.tenantId, rate, updatedBy: session.userId } });
  return NextResponse.json({ data: { id: row.id, newRate: Number(row.rate), oldRate: previous ? Number(previous.rate) : Number(row.rate), updatedAt: row.createdAt, updatedBy: session.fullName, branch: "All branches" }, currentRate: Number(row.rate) }, { status: 201 });
}

export const POST = saveRate;
export const PUT = saveRate;
