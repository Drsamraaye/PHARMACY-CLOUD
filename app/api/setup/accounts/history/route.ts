import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const params = req.nextUrl.searchParams;
  const fromDate = params.get("fromDate");
  const toDate = params.get("toDate");
  const branchScope = session.branchId ? { branchId: session.branchId } : {};
  const accounts = await prisma.bankAccount.findMany({ where: { tenantId: session.tenantId, ...branchScope }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  const chartRows = await prisma.moduleRecord.findMany({ where: { tenantId: session.tenantId, collection: "setup/accounts", deletedAt: null, ...branchScope }, orderBy: { createdAt: "desc" }, take: 1000 });
  const chartAccounts = chartRows.map(row => { const value = row.record && typeof row.record === "object" && !Array.isArray(row.record) ? row.record as Record<string, unknown> : {}; return { id: row.id, name: String(value.name ?? value.accountName ?? "Account") }; });
  const chartMap = new Map(chartAccounts.map(account => [account.id, account]));
  const transactions = await prisma.bankTransaction.findMany({
    where: { tenantId: session.tenantId, bankAccount: { tenantId: session.tenantId, ...branchScope }, ...(fromDate || toDate ? { createdAt: { ...(fromDate ? { gte: new Date(`${fromDate}T00:00:00.000Z`) } : {}), ...(toDate ? { lte: new Date(`${toDate}T23:59:59.999Z`) } : {}) } } : {}) },
    include: { bankAccount: { include: { branch: { select: { id: true, name: true } } } } },
    orderBy: { createdAt: "desc" }, take: 2000,
  });
  const accountMap = new Map(accounts.map(account => [account.id, account]));
  const userIds = [...new Set(transactions.map(row => row.createdBy).filter((id): id is string => Boolean(id)))];
  const users = await prisma.userProfile.findMany({ where: { tenantId: session.tenantId, id: { in: userIds } }, select: { id: true, fullName: true } });
  const userMap = new Map(users.map(user => [user.id, user.fullName]));
  const output = transactions.flatMap(transaction => {
    const current = transaction.bankAccount;
    const referenceAccount = transaction.reference ? accountMap.get(transaction.reference) : undefined;
    const ledgerAccount = transaction.reference ? chartMap.get(transaction.reference) : undefined;
    const pairedOut = transaction.type === "TRANSFER_IN" ? transactions.find(other => other.type === "TRANSFER_OUT" && ((other.reference && other.reference === transaction.reference) || (other.bankAccountId === transaction.reference && other.reference === transaction.bankAccountId)) && other.amount.toString() === transaction.amount.toString()) : undefined;
    const pairedIn = transaction.type === "TRANSFER_OUT" ? transactions.find(other => other.type === "TRANSFER_IN" && ((other.reference && other.reference === transaction.reference) || (other.bankAccountId === transaction.reference && other.reference === transaction.bankAccountId)) && other.amount.toString() === transaction.amount.toString()) : undefined;
    let fromAccount = "—", toAccount = "—", fromAccountId = "", toAccountId = "";
    let fromBank = "—", toBank = "—", fromBankId = "", toBankId = "";
    if (transaction.type === "TRANSFER_OUT") { fromBank = current.name; fromBankId = current.id; toBank = pairedIn?.bankAccount.name ?? referenceAccount?.name ?? "—"; toBankId = pairedIn?.bankAccountId ?? referenceAccount?.id ?? ""; }
    else if (transaction.type === "TRANSFER_IN") { fromBank = pairedOut?.bankAccount.name ?? referenceAccount?.name ?? "—"; fromBankId = pairedOut?.bankAccountId ?? referenceAccount?.id ?? ""; toBank = current.name; toBankId = current.id; }
    else if (transaction.type === "WITHDRAWAL") { fromBank = current.name; fromBankId = current.id; toAccount = ledgerAccount?.name ?? "—"; toAccountId = ledgerAccount?.id ?? ""; }
    else { fromAccount = ledgerAccount?.name ?? "—"; fromAccountId = ledgerAccount?.id ?? ""; toBank = current.name; toBankId = current.id; }
    const isPairedTransferIn = transaction.type === "TRANSFER_IN" && Boolean(pairedOut);
    if (isPairedTransferIn) return [];
    if (params.get("fromAccountId") && fromAccountId !== params.get("fromAccountId")) return [];
    if (params.get("toAccountId") && toAccountId !== params.get("toAccountId")) return [];
    if (params.get("fromBankId") && fromBankId !== params.get("fromBankId")) return [];
    if (params.get("toBankId") && toBankId !== params.get("toBankId")) return [];
    return [{ id: transaction.id, date: transaction.createdAt, fromAccount, fromBank, toAccount, toBank, user: transaction.createdBy ? userMap.get(transaction.createdBy) ?? "—" : "—", amount: transaction.amount.toString(), currency: current.currency, type: transaction.type, description: transaction.description }];
  });
  return NextResponse.json({ data: output, accounts: accounts.map(({ id, name }) => ({ id, name })), chartAccounts });
}
