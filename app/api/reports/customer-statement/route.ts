import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = req.nextUrl.searchParams;
  const start = params.get("from") || "";
  const end = params.get("to") || "";
  const patientId = params.get("patientId") || "";
  const selectedUser = params.get("userId") || "";
  const type = params.get("type") || "";
  const balance = params.get("balance") || "all";
  const canChoose = session.role === "OWNER" || session.role === "ADMIN";
  const branchId = canChoose ? (params.get("branchId") || "") : (session.branchId || "");
  const branchFilter = branchId ? { branchId } : session.branchId ? { branchId: session.branchId } : {};
  const dateFilter = start || end ? { createdAt: { ...(start ? { gte: new Date(`${start}T00:00:00`) } : {}), ...(end ? { lte: new Date(`${end}T23:59:59.999`) } : {}) } } : {};

  const [sales, patients, users, branches] = await Promise.all([
    prisma.sale.findMany({
      where: { tenantId: session.tenantId, ...branchFilter, status: { not: "VOID" }, ...dateFilter, ...(patientId ? { patientId } : {}), ...(selectedUser ? { userId: selectedUser } : {}), ...(type ? { type } : {}) },
      select: { id: true, patientId: true, userId: true, branchId: true, type: true, total: true, paidAmount: true, createdAt: true, patient: { select: { fullName: true } } },
      orderBy: { createdAt: "asc" },
      take: 5000,
    }),
    prisma.patient.findMany({ where: { tenantId: session.tenantId }, select: { id: true, fullName: true }, orderBy: { fullName: "asc" }, take: 2000 }),
    canChoose ? prisma.userProfile.findMany({ where: { tenantId: session.tenantId, isActive: true, ...(branchId ? { branchId } : {}) }, select: { id: true, fullName: true }, orderBy: { fullName: "asc" } }) : Promise.resolve([]),
    canChoose ? prisma.branch.findMany({ where: { tenantId: session.tenantId, isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }) : Promise.resolve([]),
  ]);

  const userIds = [...new Set(sales.map(sale => sale.userId).filter((id): id is string => Boolean(id)))];
  const branchIds = [...new Set(sales.map(sale => sale.branchId).filter((id): id is string => Boolean(id)))];
  const [saleUsers, saleBranches] = await Promise.all([
    userIds.length ? prisma.userProfile.findMany({ where: { tenantId: session.tenantId, id: { in: userIds } }, select: { id: true, fullName: true } }) : Promise.resolve([]),
    branchIds.length ? prisma.branch.findMany({ where: { tenantId: session.tenantId, id: { in: branchIds } }, select: { id: true, name: true } }) : Promise.resolve([]),
  ]);
  const userById = new Map(saleUsers.map(user => [user.id, user.fullName]));
  const branchById = new Map(saleBranches.map(branch => [branch.id, branch.name]));
  const running = new Map<string, number>();
  const data = sales.map(sale => {
    const customerKey = sale.patientId || "walk-in";
    const total = Number(sale.total);
    const paid = Number(sale.paidAmount);
    const due = Math.max(0, total - paid);
    const currentBalance = (running.get(customerKey) || 0) + due;
    running.set(customerKey, currentBalance);
    return {
      id: sale.id,
      date: sale.createdAt,
      patientId: sale.patientId,
      patient: sale.patient?.fullName || "Walk-in customer",
      user: sale.userId ? userById.get(sale.userId) || "—" : "—",
      branch: sale.branchId ? branchById.get(sale.branchId) || "—" : "—",
      type: sale.type || "New Order",
      income: total,
      paid,
      balance: currentBalance,
    };
  }).filter(row => balance !== "due" || row.balance > 0).filter(row => balance !== "paid" || row.balance === 0);

  return NextResponse.json({ data, options: { patients, users, branches, types: [...new Set(sales.map(sale => sale.type).filter(Boolean))] } });
}
