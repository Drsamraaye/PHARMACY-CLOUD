import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Detailed branch-scoped order report with available filters and audit history. */
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = req.nextUrl.searchParams;
  const from = params.get("from");
  const to = params.get("to");
  const customerId = params.get("customerId") || "";
  const userId = params.get("userId") || "";
  const paymentMethod = params.get("paymentMethod") || "";
  const type = params.get("type") || "ALL";
  const category = params.get("category") || "";
  const balance = params.get("balance") || "ALL";

  const dateRange = from || to ? {
    createdAt: {
      ...(from ? { gte: new Date(`${from}T00:00:00.000Z`) } : {}),
      ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
    },
  } : {};
  const [sales, patients, users, categories] = await Promise.all([
    prisma.sale.findMany({
      where: {
        tenantId: session.tenantId,
        status: { not: "VOID" },
        ...(session.branchId ? { branchId: session.branchId } : {}),
        ...(customerId ? { patientId: customerId } : {}),
        ...(userId ? { userId } : {}),
        ...(paymentMethod ? { paymentMethod } : {}),
        ...(type !== "ALL" ? { type } : {}),
        ...(category ? { items: { some: { product: { category } } } } : {}),
        ...dateRange,
      },
      include: {
        patient: { select: { id: true, fullName: true, phone: true } },
        items: { include: { product: { select: { name: true, category: true } } } },
        refunds: { select: { id: true, amount: true, reason: true, createdAt: true } },
        creditNotes: { select: { id: true, amount: true, remainingAmount: true, status: true, createdAt: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 2000,
    }),
    prisma.patient.findMany({
      where: { tenantId: session.tenantId, deletedAt: null, ...(session.branchId ? { branchId: session.branchId } : {}) },
      select: { id: true, fullName: true }, orderBy: { fullName: "asc" }, take: 1000,
    }),
    prisma.userProfile.findMany({
      where: { tenantId: session.tenantId, isActive: true, ...(session.branchId ? { branchId: session.branchId } : {}) },
      select: { id: true, fullName: true, role: true }, orderBy: { fullName: "asc" }, take: 500,
    }),
    prisma.product.findMany({
      where: { tenantId: session.tenantId, ...(session.branchId ? { branchId: session.branchId } : {}), category: { not: null } },
      select: { category: true }, distinct: ["category"], orderBy: { category: "asc" },
    }),
  ]);

  const userById = new Map(users.map((user) => [user.id, user.fullName]));
  const all = sales.map((sale) => {
    const total = Number(sale.total);
    const paid = Number(sale.paidAmount);
    return {
      id: sale.id,
      date: sale.createdAt,
      customerId: sale.patientId,
      customer: sale.patient?.fullName ?? "Walk-in customer",
      phone: sale.patient?.phone ?? "—",
      user: userById.get(sale.userId ?? "") ?? "—",
      type: sale.type,
      quantity: sale.items.reduce((sum, item) => sum + item.quantity, 0),
      discount: Number(sale.discount),
      paid,
      total,
      balance: Math.max(0, total - paid),
      status: sale.status,
      paymentMethod: sale.paymentMethod || "Unspecified",
      items: sale.items.map((item) => ({ id: item.id, name: item.product.name, category: item.product.category, quantity: item.quantity, price: Number(item.unitPrice), total: Number(item.unitPrice) * item.quantity })),
      refunds: sale.refunds.map((refund) => ({ id: refund.id, amount: Number(refund.amount), reason: refund.reason, date: refund.createdAt })),
      creditNotes: sale.creditNotes.map((credit) => ({ id: credit.id, amount: Number(credit.amount), remainingAmount: Number(credit.remainingAmount), status: credit.status, date: credit.createdAt })),
    };
  });
  const data = all.filter((sale) => balance === "ALL" || (balance === "DUE" ? sale.balance > 0 : balance === "PAID" ? sale.balance === 0 : true));
  const paymentMethods = [...new Set(all.map((sale) => sale.paymentMethod))].map((method) => ({ method, amount: all.filter((sale) => sale.paymentMethod === method).reduce((sum, sale) => sum + sale.paid, 0) }));

  return NextResponse.json({
    data,
    options: {
      patients,
      users,
      doctors: users.filter((user) => user.role.toUpperCase() === "DOCTOR"),
      categories: categories.map((item) => item.category).filter((value): value is string => Boolean(value)),
      paymentMethods,
      total: data.reduce((sum, sale) => sum + sale.total, 0),
      paid: data.reduce((sum, sale) => sum + sale.paid, 0),
      balance: data.reduce((sum, sale) => sum + sale.balance, 0),
    },
  });
}
