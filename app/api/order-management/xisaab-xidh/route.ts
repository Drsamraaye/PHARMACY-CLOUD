import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { businessDateBounds, businessDateKey, businessDateRecord } from "@/lib/business-date";
import type { Prisma } from "@/generated/prisma/client";

const paymentMethods = ["Cash Shilling", "Cash Dollar", "Zaad Shilling", "Zaad Dollar"] as const;
type Method = typeof paymentMethods[number];
type Totals = Record<Method, number>;
const emptyTotals = (): Totals => ({ "Cash Shilling": 0, "Cash Dollar": 0, "Zaad Shilling": 0, "Zaad Dollar": 0 });
const methodOf = (value: string | null | undefined): Method | null => paymentMethods.find((method) => method === value) ?? null;
const legacyMethod = (value: string | null | undefined): Method => methodOf(value) ?? (/zaad/i.test(value ?? "") ? "Zaad Dollar" : "Cash Dollar");
async function expectedBalances(tx: Prisma.TransactionClient, tenantId: string, branchId: string, date: string, start: Date, end: Date): Promise<Totals> {
  const totals = emptyTotals();
  const recorded = await tx.salePayment.findMany({ where: { tenantId, branchId, createdAt: { gte: start, lt: end } }, select: { method: true, currency: true, amount: true } });
  for (const payment of recorded) { const method = methodOf(payment.method); if (method) totals[method] += Number(payment.amount); }
  // Include old invoices that predate payment-line storage, only if no new lines exist.
  const legacy = await tx.sale.findMany({ where: { tenantId, branchId, createdAt: { gte: start, lt: end }, status: { not: "VOID" }, payments: { none: {} } }, select: { paymentMethod: true, paidAmount: true } });
  for (const sale of legacy) {
    if (Number(sale.paidAmount) > 0) totals[legacyMethod(sale.paymentMethod)] += Number(sale.paidAmount);
  }
  const [expenses, supplierPayments] = await Promise.all([
    tx.moduleRecord.findMany({ where: { tenantId, branchId, collection: "expenses", deletedAt: null }, orderBy: { createdAt: "desc" }, take: 10000 }),
    tx.moduleRecord.findMany({ where: { tenantId, branchId, collection: "supplier-bill-payments" }, orderBy: { createdAt: "desc" }, take: 10000 }),
  ]);
  for (const row of expenses) {
    const record = row.record as Record<string, unknown>;
    if (String(record.date ?? row.createdAt.toISOString().slice(0, 10)).slice(0, 10) !== date) continue;
    const methodName = String(record.paymentMethod ?? "Cash Dollar");
    const method = methodOf(methodName) ?? (/zaad/i.test(methodName) ? "Zaad Dollar" : "Cash Dollar");
    const localMethod = method.endsWith("Shilling");
    const storedCurrency = String(record.paymentCurrency ?? record.sourceCurrency ?? record.currency ?? "USD").toUpperCase();
    const legacyPaid = Number(record.paidAmount ?? 0);
    const paymentAmount = record.paymentAmount ?? (localMethod === ["SOS", "SLSh", "SLSH"].includes(storedCurrency) ? legacyPaid : 0);
    totals[method] -= Number(paymentAmount);
  }
  for (const row of supplierPayments) {
    const record = row.record as Record<string, unknown>;
    if (String(record.paymentDate ?? row.createdAt.toISOString().slice(0, 10)).slice(0, 10) !== date) continue;
    const methodName = String(record.paymentMethod ?? "Cash Dollar");
    const method = methodOf(methodName) ?? (/zaad/i.test(methodName) ? "Zaad Dollar" : "Cash Dollar");
    totals[method] -= Number(record.paymentAmount ?? record.amount ?? 0);
  }
  return totals;
}

/** Dual-currency daily report and immutable closeout history for the active branch. */
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.branchId) return NextResponse.json({ error: "Select an active branch before opening daily closeout." }, { status: 400 });
  const date = req.nextUrl.searchParams.get("date") || businessDateKey(new Date());
  let bounds: ReturnType<typeof businessDateBounds>;
  try { bounds = businessDateBounds(date); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid date" }, { status: 400 }); }
  const { start, end } = bounds;
  const [sales, salesWithCosts, dueSales, payments, refunds, creditNotes, expenses, accounts, history, rateRow, users] = await Promise.all([
    prisma.sale.aggregate({ where: { tenantId: session.tenantId, branchId: session.branchId, createdAt: { gte: start, lt: end }, status: { not: "VOID" } }, _sum: { total: true, discount: true }, _count: { _all: true } }),
    prisma.sale.findMany({ where: { tenantId: session.tenantId, branchId: session.branchId, createdAt: { gte: start, lt: end }, status: { not: "VOID" } }, select: { exchangeRate: true, total: true, items: { select: { quantity: true, costPrice: true } } } }),
    prisma.sale.findMany({ where: { tenantId: session.tenantId, branchId: session.branchId, createdAt: { lt: end }, status: { not: "VOID" } }, select: { total: true, paidAmount: true, refunds: { select: { amount: true, reflectedInSale: true } }, creditNotes: { where: { kind: "RETURN" }, select: { amount: true } } }, take: 10000 }),
    prisma.salePayment.findMany({ where: { tenantId: session.tenantId, branchId: session.branchId, createdAt: { gte: start, lt: end } }, select: { method: true, currency: true, amount: true, usdEquivalent: true } }),
    prisma.refund.findMany({ where: { tenantId: session.tenantId, sale: { branchId: session.branchId }, createdAt: { gte: start, lt: end } }, select: { amount: true, reflectedInSale: true, items: { select: { quantity: true, costPrice: true } } } }),
    prisma.creditNote.findMany({ where: { tenantId: session.tenantId, kind: "RETURN", sale: { branchId: session.branchId }, createdAt: { gte: start, lt: end } }, select: { amount: true, items: { select: { quantity: true, costPrice: true } } } }),
    prisma.moduleRecord.findMany({ where: { tenantId: session.tenantId, branchId: session.branchId, collection: "expenses", deletedAt: null }, orderBy: { createdAt: "desc" }, take: 10000 }),
    prisma.bankAccount.findMany({ where: { tenantId: session.tenantId, isActive: true, branchId: session.branchId }, select: { id: true, name: true, currency: true, balance: true }, orderBy: { name: "asc" } }),
    prisma.dailyCloseout.findMany({ where: { tenantId: session.tenantId, branchId: session.branchId, businessDate: bounds.record }, orderBy: { closedAt: "desc" } }),
    prisma.exchangeRate.findFirst({ where: { tenantId: session.tenantId }, orderBy: { createdAt: "desc" } }),
    prisma.userProfile.findMany({ where: { tenantId: session.tenantId, branchId: session.branchId }, select: { id: true, fullName: true, role: true } }),
  ]);
  const expected = await prisma.$transaction((tx) => expectedBalances(tx, session.tenantId, session.branchId!, date, start, end), { isolationLevel: "Serializable" });
  const legacySales = await prisma.sale.findMany({ where: { tenantId: session.tenantId, branchId: session.branchId, createdAt: { gte: start, lt: end }, status: { not: "VOID" }, payments: { none: {} } }, select: { paymentMethod: true, paidAmount: true } });
  const paymentSummary = paymentMethods.map((method) => ({ method, amount: payments.filter((p) => p.method === method).reduce((sum, p) => sum + Number(p.amount), 0) + legacySales.filter((sale) => Number(sale.paidAmount) > 0 && legacyMethod(sale.paymentMethod) === method).reduce((sum, sale) => sum + Number(sale.paidAmount), 0), currency: method.endsWith("Shilling") ? "SLSh" : "USD", transactions: payments.filter((p) => p.method === method).length }));
  const dayExpenses = expenses.filter((row) => { const record = row.record as Record<string, unknown>; return String(record.date ?? row.createdAt.toISOString().slice(0, 10)).slice(0, 10) === date; });
  const expenseRows = dayExpenses.map((row) => { const record = row.record as Record<string, unknown>; return { id: row.id, description: String(record.description ?? ""), type: String(record.type ?? ""), amount: Number(record.amount ?? 0), currency: String(record.currency ?? "USD"), user: users.find((user) => user.id === row.createdBy)?.fullName ?? "—", createdAt: row.createdAt }; });
  const expenseUsd = expenseRows.reduce((sum, row) => {
    const record = dayExpenses.find((item) => item.id === row.id)?.record as Record<string, unknown>;
    if (row.currency === "USD") return sum + row.amount;
    const snapshotRate = Number(record.exchangeRate ?? 0);
    return sum + (snapshotRate > 0 ? row.amount / snapshotRate : 0);
  }, 0);
  const salesUsd = Number(sales._sum.total ?? 0);
  const grossSalesUsd = salesUsd + Number(sales._sum.discount ?? 0);
  const costOfGoodsUsd = salesWithCosts.reduce((sum, sale) => sum + sale.items.reduce((itemSum, item) => itemSum + Number(item.costPrice) * item.quantity, 0), 0);
  const returnedCostUsd = refunds.filter((refund) => !refund.reflectedInSale).reduce((sum, refund) => sum + refund.items.reduce((itemSum, item) => itemSum + Number(item.costPrice) * item.quantity, 0), 0);
  const returnedCreditCostUsd = creditNotes.reduce((sum, note) => sum + note.items.reduce((itemSum, item) => itemSum + Number(item.costPrice) * item.quantity, 0), 0);
  const netCostOfGoodsUsd = Math.max(0, costOfGoodsUsd - returnedCostUsd);
  const paidUsd = payments.reduce((sum, payment) => sum + Number(payment.usdEquivalent), 0) + legacySales.reduce((sum, sale) => sum + Number(sale.paidAmount), 0);
  const refundUsd = refunds.reduce((sum, refund) => sum + Number(refund.amount), 0);
  const outstandingDebt = dueSales.reduce((sum, sale) => { const netTotal = Math.max(0, Number(sale.total) - sale.creditNotes.reduce((creditSum, credit) => creditSum + Number(credit.amount), 0)); return sum + Math.max(0, netTotal - Math.min(netTotal, Number(sale.paidAmount))); }, 0);
  const salesSlshEquivalent = salesWithCosts.reduce((sum, sale) => sum + Number(sale.total) * Number(sale.exchangeRate), 0);
  const costDataGaps = salesWithCosts.reduce((sum, sale) => sum + sale.items.filter((item) => Number(item.costPrice) === 0).length, 0);
  const netRefundUsd = refunds.filter((refund) => !refund.reflectedInSale).reduce((sum, refund) => sum + Number(refund.amount), 0);
  const creditNoteUsd = creditNotes.reduce((sum, note) => sum + Number(note.amount), 0);
  return NextResponse.json({ data: {
    date, sales: salesUsd, grossSalesUsd, salesUsdEquivalent: salesUsd, salesSLShEquivalent: salesSlshEquivalent, cashIn: paidUsd,
    discounts: Number(sales._sum.discount ?? 0), refunds: refundUsd, creditNotes: creditNoteUsd, outstandingDebt, expenseTotal: expenseUsd, costOfGoodsUsd: netCostOfGoodsUsd,
    net: salesUsd - netRefundUsd - creditNoteUsd - netCostOfGoodsUsd + returnedCreditCostUsd - expenseUsd, costDataGaps, transactions: sales._count._all, exchangeRate: rateRow ? Number(rateRow.rate) : null,
    paymentSummary, expected, expenses: expenseRows, accounts: accounts.map((account) => ({ ...account, balance: Number(account.balance) })),
    reconciliations: history.map((item) => ({ ...item, businessDate: item.businessDate.toISOString().slice(0, 10), exchangeRate: Number(item.exchangeRate) })),
  } });
}

/** Finalizes a branch/day cash reconciliation. Notes are required for discrepancies. */
export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.branchId) return NextResponse.json({ error: "An active branch is required to close the day." }, { status: 400 });
  const schema = z.object({ date: z.string(), actualCashSLSh: z.coerce.number().finite().min(0), actualCashUSD: z.coerce.number().finite().min(0), actualZaadSLSh: z.coerce.number().finite().min(0), actualZaadUSD: z.coerce.number().finite().min(0), notes: z.string().max(2000).optional() });
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Enter valid actual balances for all four payment methods." }, { status: 400 });
  let bounds: ReturnType<typeof businessDateBounds>;
  try { bounds = businessDateBounds(parsed.data.date); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid date" }, { status: 400 }); }
  try {
    const result = await prisma.$transaction(async (tx) => {
      const rateRow = await tx.exchangeRate.findFirst({ where: { tenantId: session.tenantId }, orderBy: { createdAt: "desc" } });
      if (!rateRow) throw Object.assign(new Error("Set the centralized exchange rate before closing the day."), { httpStatus: 400 });
      const expected = await expectedBalances(tx, session.tenantId, session.branchId!, parsed.data.date, bounds.start, bounds.end);
      const actual: Totals = { "Cash Shilling": parsed.data.actualCashSLSh, "Cash Dollar": parsed.data.actualCashUSD, "Zaad Shilling": parsed.data.actualZaadSLSh, "Zaad Dollar": parsed.data.actualZaadUSD };
      const differences = Object.fromEntries(paymentMethods.map((method) => [method, Math.round((actual[method] - expected[method]) * 100) / 100])) as Totals;
      const hasDifference = paymentMethods.some((method) => differences[method] !== 0);
      if (hasDifference && !parsed.data.notes?.trim()) throw Object.assign(new Error("Add an explanatory note before finalizing a closeout with a discrepancy."), { httpStatus: 400 });
      const rate = Number(rateRow.rate);
      const closeoutInput = {
        tenantId: session.tenantId, branchId: session.branchId!, businessDate: bounds.record, closedBy: session.userId, exchangeRate: rateRow.rate,
        expectedCashSLSh: expected["Cash Shilling"], expectedCashUSD: expected["Cash Dollar"], expectedZaadSLSh: expected["Zaad Shilling"], expectedZaadUSD: expected["Zaad Dollar"],
        actualCashSLSh: actual["Cash Shilling"], actualCashUSD: actual["Cash Dollar"], actualZaadSLSh: actual["Zaad Shilling"], actualZaadUSD: actual["Zaad Dollar"],
        differenceCashSLSh: differences["Cash Shilling"], differenceCashUSD: differences["Cash Dollar"], differenceZaadSLSh: differences["Zaad Shilling"], differenceZaadUSD: differences["Zaad Dollar"],
        notes: parsed.data.notes?.trim() || null, status: hasDifference ? "DISCREPANCY" : "BALANCED",
      };
      const created = await tx.dailyCloseout.create({ data: closeoutInput });
      if (hasDifference) {
        const managers = await tx.userProfile.findMany({ where: { tenantId: session.tenantId, branchId: session.branchId, isActive: true, role: { in: ["OWNER", "ADMIN"] } }, select: { id: true } });
        for (const manager of managers) await tx.moduleRecord.create({ data: { tenantId: session.tenantId, branchId: session.branchId, collection: "manager-notifications", createdBy: session.userId, record: { recipientId: manager.id, type: "CLOSEOUT_DISCREPANCY", closeoutId: created.id, businessDate: parsed.data.date, status: created.status, differences, notes: closeoutInput.notes, message: `A closeout discrepancy was recorded for ${parsed.data.date}.` } } });
      }
      return { created, rate, actual };
    }, { isolationLevel: "Serializable" });
    return NextResponse.json({ data: { ...result.created, exchangeRate: result.rate, slshUsdEquivalent: (result.actual["Cash Shilling"] + result.actual["Zaad Shilling"]) / result.rate, usdEquivalent: result.actual["Cash Dollar"] + result.actual["Zaad Dollar"] + (result.actual["Cash Shilling"] + result.actual["Zaad Shilling"]) / result.rate } }, { status: 201 });
  } catch (error) {
    if (typeof error === "object" && error !== null && "httpStatus" in error) return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid closeout" }, { status: Number(error.httpStatus) });
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") return NextResponse.json({ error: "This branch already has a finalized closeout for that business date." }, { status: 409 });
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2034") return NextResponse.json({ error: "Transactions changed while closing the day. Refresh the report and retry." }, { status: 409 });
    console.error("Daily closeout failed", error);
    return NextResponse.json({ error: "Could not finalize the closeout." }, { status: 500 });
  }
}
