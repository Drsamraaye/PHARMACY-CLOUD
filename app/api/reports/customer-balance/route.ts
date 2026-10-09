import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const params = req.nextUrl.searchParams;
  const canChoose = session.role === "OWNER" || session.role === "ADMIN";
  const branchId = canChoose ? (params.get("branchId") || "") : (session.branchId || "");
  const userId = params.get("userId") || "";
  const branchFilter = branchId ? { branchId } : session.branchId ? { branchId: session.branchId } : {};
  const [sales, branches, users] = await Promise.all([
    prisma.sale.findMany({
      where: { tenantId: session.tenantId, ...branchFilter, status: { not: "VOID" }, patientId: { not: null }, ...(userId ? { userId } : {}) },
      select: { patientId: true, userId: true, total: true, paidAmount: true, patient: { select: { id: true, fullName: true, phone: true } } },
      take: 10000,
    }),
    canChoose ? prisma.branch.findMany({ where: { tenantId: session.tenantId, isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }) : Promise.resolve([]),
    canChoose ? prisma.userProfile.findMany({ where: { tenantId: session.tenantId, isActive: true, ...(branchId ? { branchId } : {}) }, select: { id: true, fullName: true }, orderBy: { fullName: "asc" } }) : Promise.resolve([]),
  ]);
  const grouped = new Map<string, { id: string; name: string; phone: string; balance: number; transactions: number }>();
  for (const sale of sales) {
    if (!sale.patient) continue;
    const due = Math.max(0, Number(sale.total) - Number(sale.paidAmount));
    if (due <= 0) continue;
    const item = grouped.get(sale.patient.id) ?? { id: sale.patient.id, name: sale.patient.fullName, phone: sale.patient.phone || "—", balance: 0, transactions: 0 };
    item.balance += due;
    item.transactions += 1;
    grouped.set(sale.patient.id, item);
  }
  const data = [...grouped.values()].sort((a, b) => b.balance - a.balance);
  return NextResponse.json({ data, options: { branches, users }, totals: { balance: data.reduce((sum, item) => sum + item.balance, 0), customers: data.length, transactions: data.reduce((sum, item) => sum + item.transactions, 0) } });
}
