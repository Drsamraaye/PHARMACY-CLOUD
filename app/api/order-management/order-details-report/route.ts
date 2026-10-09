import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Returns real, branch-scoped orders with their product and payment details. */
export async function GET(req: NextRequest) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const params = req.nextUrl.searchParams; const from = params.get("from"); const to = params.get("to"); const customerId = params.get("customerId") || ""; const orderType = params.get("orderType") || "ALL"; const balanceFilter = params.get("balance") || "ALL";
  const sales = await prisma.sale.findMany({ where: { tenantId: session.tenantId, status: { not: "VOID" }, ...(session.branchId ? { branchId: session.branchId } : {}), ...(customerId ? { patientId: customerId } : {}), ...(orderType !== "ALL" ? { type: orderType } : {}), ...(from || to ? { createdAt: { ...(from ? { gte: new Date(`${from}T00:00:00.000Z`) } : {}), ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}) } } : {}) }, include: { patient: { select: { id: true, fullName: true, phone: true } }, items: { include: { product: { select: { name: true } } } } }, orderBy: { createdAt: "desc" }, take: 2000 });
  const all = sales.map((sale) => { const total = Number(sale.total); const paid = Number(sale.paidAmount); return { id: sale.id, date: sale.createdAt, customerId: sale.patientId, customer: sale.patient?.fullName ?? "Walk-in customer", phone: sale.patient?.phone ?? "—", type: sale.type, totalQuantity: sale.items.reduce((sum, item) => sum + item.quantity, 0), discount: Number(sale.discount), paid, total, balance: Math.max(0, total - paid), status: sale.status, paymentMethod: sale.paymentMethod || "Unspecified", items: sale.items.map((item) => ({ id: item.id, name: item.product.name, quantity: item.quantity, price: Number(item.unitPrice), total: Number(item.unitPrice) * item.quantity })) }; });
  const data = all.filter((sale) => balanceFilter === "ALL" || (balanceFilter === "DUE" ? sale.balance > 0 : balanceFilter === "PAID" ? sale.balance === 0 : true));
  const paymentMethods = [...new Set(all.map((sale) => sale.paymentMethod))].map((method) => ({ method, amount: all.filter((sale) => sale.paymentMethod === method).reduce((sum, sale) => sum + sale.paid, 0) }));
  const patients = await prisma.patient.findMany({ where: { tenantId: session.tenantId, deletedAt: null, ...(session.branchId ? { branchId: session.branchId } : {}) }, select: { id: true, fullName: true }, orderBy: { fullName: "asc" }, take: 1000 });
  return NextResponse.json({ data, options: { patients, paymentMethods, total: data.reduce((sum, sale) => sum + sale.total, 0), paid: data.reduce((sum, sale) => sum + sale.paid, 0), balance: data.reduce((sum, sale) => sum + sale.balance, 0) } });
}
