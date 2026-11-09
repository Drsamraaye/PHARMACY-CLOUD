import { NextRequest, NextResponse } from "next/server";
import { collectionGET, collectionPATCH, collectionDELETE } from "@/lib/http/module-records";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { businessDateKey, businessDateRecord } from "@/lib/business-date";

export function GET(req: NextRequest) { return collectionGET(req, "expenses"); }
export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body: unknown = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "An expense record is required" }, { status: 400 });
  const record = body as Record<string, unknown>;
  const amount = Number(record.amount ?? record.totalAmount ?? 0);
  const paid = Number(record.paidAmount ?? 0);
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(paid) || paid < 0 || paid > amount) return NextResponse.json({ error: "Expense amounts must be valid and paid amount cannot exceed the total" }, { status: 400 });
  const sourceCurrency = String(record.currency ?? "USD").toUpperCase();
  const expenseDay = String(record.date ?? businessDateKey(new Date())).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expenseDay) || Number.isNaN(Date.parse(`${expenseDay}T00:00:00Z`))) return NextResponse.json({ error: "Enter a valid expense date" }, { status: 400 });
  let rate = 1;
  const currentRate = await prisma.exchangeRate.findFirst({ where: { tenantId: session.tenantId }, orderBy: { createdAt: "desc" } });
  const paymentMethod = String(record.paymentMethod ?? "Cash Dollar");
  const paymentCurrency = /shilling|slsh|somaliland/i.test(paymentMethod) ? "SLSh" : "USD";
  if (paymentCurrency === "SLSh" && !currentRate) return NextResponse.json({ error: "Set the centralized exchange rate before recording a shilling payment" }, { status: 400 });
  if (["SOS", "SLSH", "SOMALILAND SHILLING"].includes(sourceCurrency)) {
    if (!currentRate) return NextResponse.json({ error: "Set the centralized exchange rate before entering an SLSh expense" }, { status: 400 });
    rate = Number(currentRate.rate);
  } else if (sourceCurrency !== "USD") return NextResponse.json({ error: "Expenses must be entered in USD or converted from SLSh" }, { status: 400 });
  else if (currentRate) rate = Number(currentRate.rate);
  const round = (value: number) => Math.round(value * 100) / 100;
  const usdAmount = sourceCurrency === "USD" ? round(amount) : round(amount / rate);
  const usdPaid = sourceCurrency === "USD" ? round(paid) : round(paid / rate);
  const paymentAmount = paymentCurrency === "SLSh" ? round(usdPaid * rate) : usdPaid;
  const usdRecord = {
    ...record,
    currency: "USD",
    amount: usdAmount,
    totalAmount: usdAmount,
    paidAmount: usdPaid,
    generalBalance: round(usdAmount - usdPaid),
    usdAmount,
    sourceAmount: round(amount),
    sourcePaidAmount: round(paid),
    sourceCurrency: sourceCurrency === "USD" ? "USD" : "SLSh",
    exchangeRate: rate,
    paymentMethod,
    paymentCurrency,
    paymentAmount,
  };
  try {
  const created = await prisma.$transaction(async (tx) => {
    if (session.branchId && await tx.dailyCloseout.findFirst({ where: { tenantId: session.tenantId, branchId: session.branchId, businessDate: businessDateRecord(expenseDay) }, select: { id: true } })) throw new Error("This business day is closed; record the expense on an open business day.");
    return tx.moduleRecord.create({ data: { tenantId: session.tenantId, branchId: session.branchId, collection: "expenses", record: usdRecord as Prisma.InputJsonValue, createdBy: session.userId } });
  }, { isolationLevel: "Serializable" });
  return NextResponse.json({ data: { id: created.id, ...usdRecord, createdAt: created.createdAt, updatedAt: created.updatedAt } }, { status: 201 });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2034") return NextResponse.json({ error: "Transactions changed during expense entry. Refresh and retry." }, { status: 409 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Expense could not be saved" }, { status: 400 });
  }
}
export function PUT(req: NextRequest) { return collectionPATCH(req, "expenses"); }
export function PATCH(req: NextRequest) { return collectionPATCH(req, "expenses"); }
export function DELETE(req: NextRequest) { return collectionDELETE(req, "expenses"); }
