import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { businessDateKey, businessDateRecord } from "@/lib/business-date";

/** Lists open invoices for one customer so a receipt can target specific debt. */
export async function GET(req: NextRequest) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const patientId = req.nextUrl.searchParams.get("patientId"); if (!patientId) return NextResponse.json({ data: [] });
  const branchId = session.role === "OWNER" || session.role === "ADMIN" ? (req.nextUrl.searchParams.get("branchId") || session.branchId || undefined) : (session.branchId || undefined);
  const sales = await prisma.sale.findMany({ where: { tenantId: session.tenantId, patientId, status: { not: "VOID" }, ...(branchId ? { branchId } : {}) }, include: { creditNotes: { where: { kind: "RETURN" }, select: { amount: true } } }, orderBy: { createdAt: "asc" } });
  const data = sales.map((sale) => { const total = Number(sale.total); const paid = Number(sale.paidAmount); const credits = sale.creditNotes.reduce((sum, item) => sum + Number(item.amount), 0); return { id: sale.id, invoiceNumber: sale.id.slice(-8).toUpperCase(), saleDate: sale.createdAt, originalAmount: total, paidAmount: paid, remainingBalance: Math.max(0, total - paid - credits), currency: "USD" }; }).filter((sale) => sale.remainingBalance > 0);
  return NextResponse.json({ data });
}

/** Records a customer receipt and applies it to oldest outstanding sales first. */
export async function POST(req: NextRequest) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = z.object({ patientId: z.string().min(1), amount: z.coerce.number().positive().finite(), paymentMethod: z.enum(["Cash Shilling", "Cash Dollar", "Zaad Shilling", "Zaad Dollar"]), accountId: z.string().optional(), branchId: z.string().optional(), saleIds: z.array(z.string()).optional() }).safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Patient and a positive payment amount are required" }, { status: 400 });
  const branchId = session.role === "OWNER" || session.role === "ADMIN" ? (parsed.data.branchId || session.branchId || undefined) : (session.branchId || undefined);
  try {
    const receipt = await prisma.$transaction(async (tx) => {
      const paymentDay = businessDateKey(new Date());
      if (branchId && await tx.dailyCloseout.findFirst({ where: { tenantId: session.tenantId, branchId, businessDate: businessDateRecord(paymentDay) }, select: { id: true } })) throw new Error("This business day is closed; record the receipt on an open business day.");
      const patient = await tx.patient.findFirst({ where: { id: parsed.data.patientId, tenantId: session.tenantId, deletedAt: null }, select: { id: true } });
      if (!patient) throw new Error("Patient not found");
      const sales = await tx.sale.findMany({ where: { tenantId: session.tenantId, patientId: patient.id, status: { not: "VOID" }, ...(branchId ? { branchId } : {}), ...(parsed.data.saleIds?.length ? { id: { in: parsed.data.saleIds } } : {}) }, include: { creditNotes: { where: { kind: "RETURN" }, select: { amount: true } } }, orderBy: { createdAt: "asc" } });
      const currency = parsed.data.paymentMethod.endsWith("Shilling") ? "SLSh" : "USD";
      const rateRow = await tx.exchangeRate.findFirst({ where: { tenantId: session.tenantId }, orderBy: { createdAt: "desc" } });
      if (currency === "SLSh" && !rateRow) throw new Error("Set the centralized exchange rate before receiving shilling payments");
      const rate = rateRow ? Number(rateRow.rate) : 1;
      const rateMicros = BigInt(Math.round(rate * 1_000_000));
      const amountCents = Math.round(parsed.data.amount * 100);
      let remainingUsdCents = currency === "USD" ? amountCents : Number((BigInt(amountCents) * 1_000_000n + rateMicros / 2n) / rateMicros);
      const creditsFor = (sale: typeof sales[number]) => sale.creditNotes.reduce((sum, note) => sum + Math.round(Number(note.amount) * 100), 0);
      const dueCents = sales.reduce((sum, sale) => sum + Math.max(0, Math.round(Number(sale.total) * 100) - Math.round(Number(sale.paidAmount) * 100) - creditsFor(sale)), 0);
      if (remainingUsdCents > dueCents) throw new Error("Payment exceeds the outstanding balance");
      let remainingOriginalCents = amountCents;
      let appliedUsdCents = 0;
      const allocations: { saleId: string; invoiceNumber: string; amountUsd: number }[] = [];
      for (const sale of sales) {
        if (remainingUsdCents <= 0) break;
        const outstandingCents = Math.max(0, Math.round(Number(sale.total) * 100) - Math.round(Number(sale.paidAmount) * 100) - creditsFor(sale)); if (!outstandingCents) continue;
        const appliedUsd = Math.min(remainingUsdCents, outstandingCents); const paidCents = Math.round(Number(sale.paidAmount) * 100) + appliedUsd;
        const settledTotalCents = Math.round(Number(sale.total) * 100) - creditsFor(sale);
        const update = await tx.sale.updateMany({ where: { id: sale.id, tenantId: session.tenantId, paidAmount: sale.paidAmount }, data: { paidAmount: paidCents / 100, status: paidCents >= settledTotalCents ? "PAID" : "PARTIAL" } });
        if (!update.count) throw new Error("The balance changed during payment. Please retry.");
        const isLastLine = appliedUsd === remainingUsdCents;
        const localCents = currency === "USD" ? appliedUsd : isLastLine ? remainingOriginalCents : Math.round(appliedUsd * rate);
        await tx.salePayment.create({ data: { tenantId: session.tenantId, branchId: sale.branchId, saleId: sale.id, userId: session.userId, method: parsed.data.paymentMethod, currency, amount: localCents / 100, exchangeRate: rate.toFixed(6), usdEquivalent: appliedUsd / 100 } });
        remainingOriginalCents -= localCents;
        appliedUsdCents += appliedUsd;
        allocations.push({ saleId: sale.id, invoiceNumber: sale.id.slice(-8).toUpperCase(), amountUsd: appliedUsd / 100 });
        remainingUsdCents -= appliedUsd;
      }
      if (parsed.data.accountId) {
        const account = await tx.bankAccount.findFirst({ where: { id: parsed.data.accountId, tenantId: session.tenantId, isActive: true, ...(branchId ? { branchId } : {}) } });
        if (!account) throw new Error("Payment account not found in this branch");
        const accountAmountCents = account.currency === currency ? amountCents : account.currency === "USD" ? appliedUsdCents : Number((BigInt(appliedUsdCents) * rateMicros + 500_000n) / 1_000_000n);
        await tx.bankAccount.update({ where: { id: account.id }, data: { balance: { increment: accountAmountCents / 100 } } });
        await tx.bankTransaction.create({ data: { tenantId: session.tenantId, bankAccountId: account.id, type: "DEPOSIT", amount: accountAmountCents / 100, description: "Customer invoice payment", reference: `RECEIPT-${patient.id}`, createdBy: session.userId } });
      }
      const record = { patientId: patient.id, amount: parsed.data.amount, currency, exchangeRate: rate, usdEquivalent: appliedUsdCents / 100, paymentMethod: parsed.data.paymentMethod, accountId: parsed.data.accountId || null, userId: session.userId, allocations };
      return tx.moduleRecord.create({ data: { tenantId: session.tenantId, branchId, collection: "customer-receipts", record, createdBy: session.userId } });
    }, { isolationLevel: "Serializable" });
    return NextResponse.json({ data: { id: receipt.id, ...receipt.record as object } }, { status: 201 });
  } catch (error) { const message = error instanceof Error ? error.message : "Payment could not be recorded"; return NextResponse.json({ error: message }, { status: 400 }); }
}
