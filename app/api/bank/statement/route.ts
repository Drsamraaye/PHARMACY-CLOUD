import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const signedAmount = (type: string, amount: number) => type === "DEPOSIT" || type === "TRANSFER_IN" ? amount : -amount;
const dateStart = (value: string) => new Date(value + "T00:00:00.000Z");
const dateEnd = (value: string) => new Date(value + "T23:59:59.999Z");

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const params = req.nextUrl.searchParams;
  const requestedBranch = params.get("branchId") || "";
  const branchId = session.role === "OWNER" ? requestedBranch : session.branchId ?? "";
  const branchScope = branchId ? { branchId } : {};
  const accountId = params.get("accountId") || "";
  const userId = params.get("userId") || "";
  const from = params.get("from") || "";
  const to = params.get("to") || "";
  const [accounts, branches, users] = await Promise.all([
    prisma.bankAccount.findMany({ where: { tenantId: session.tenantId, isActive: true, ...branchScope }, select: { id: true, name: true, currency: true, branchId: true, balance: true }, orderBy: { name: "asc" } }),
    prisma.branch.findMany({ where: { tenantId: session.tenantId, isActive: true, ...(session.role === "OWNER" ? (branchId ? { id: branchId } : {}) : { id: session.branchId ?? "__none__" }) }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.userProfile.findMany({ where: { tenantId: session.tenantId, isActive: true, ...(branchId ? { branchId } : session.role === "OWNER" ? {} : { branchId: "__none__" }) }, select: { id: true, fullName: true }, orderBy: { fullName: "asc" } }),
  ]);
  const accountWhere = { tenantId: session.tenantId, bankAccount: { tenantId: session.tenantId, ...branchScope }, ...(accountId ? { bankAccountId: accountId } : {}) };
  const filterWhere = { ...accountWhere, ...(userId ? { createdBy: userId } : {}), ...(from || to ? { createdAt: { ...(from ? { gte: dateStart(from) } : {}), ...(to ? { lte: dateEnd(to) } : {}) } } : {}) };
  const [transactions, openingEntries] = await Promise.all([
    prisma.bankTransaction.findMany({ where: filterWhere, include: { bankAccount: { select: { id: true, name: true, currency: true, branchId: true } } }, orderBy: { createdAt: "asc" }, take: 5000 }),
    from ? prisma.bankTransaction.findMany({ where: { ...accountWhere, ...(userId ? { createdBy: userId } : {}), createdAt: { lt: dateStart(from) } }, select: { bankAccountId: true, amount: true, type: true } }) : Promise.resolve([]),
  ]);
  const userIds = [...new Set(transactions.map(row => row.createdBy).filter((id): id is string => Boolean(id)))];
  const transactionUsers = userIds.length ? await prisma.userProfile.findMany({ where: { tenantId: session.tenantId, id: { in: userIds } }, select: { id: true, fullName: true } }) : [];
  const userNames = new Map(transactionUsers.map(user => [user.id, user.fullName]));
  const balances = new Map<string, number>();
  for (const account of accounts) balances.set(account.id, 0);
  for (const entry of openingEntries) balances.set(entry.bankAccountId, (balances.get(entry.bankAccountId) ?? 0) + signedAmount(entry.type, Number(entry.amount)));
  const data = transactions.map(row => {
    const openingBalance = balances.get(row.bankAccountId) ?? 0;
    const amount = Number(row.amount);
    const change = signedAmount(row.type, amount);
    const balance = openingBalance + change;
    balances.set(row.bankAccountId, balance);
    const outgoing = row.type === "WITHDRAWAL" || row.type === "TRANSFER_OUT";
    return { id: row.id, date: row.createdAt, transactionId: row.id.slice(-8).toUpperCase(), user: row.createdBy ? userNames.get(row.createdBy) ?? "—" : "—", account: row.bankAccount.name, description: row.description ?? row.type.replaceAll("_", " "), openingBalance, withdrawals: outgoing ? amount : 0, deposits: outgoing ? 0 : amount, balance, currency: row.bankAccount.currency, branchId: row.bankAccount.branchId };
  });
  const totals = data.reduce((sum, row) => ({ withdrawals: sum.withdrawals + row.withdrawals, deposits: sum.deposits + row.deposits }), { withdrawals: 0, deposits: 0 });
  const closingBalance = [...balances.values()].reduce((sum, value) => sum + value, 0);
  return NextResponse.json({ data, accounts: accounts.map(({ id, name, branchId, currency }) => ({ id, name, branchId, currency })), branches, users, totals: { ...totals, balance: closingBalance } });
}
