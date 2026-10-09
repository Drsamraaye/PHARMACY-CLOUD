import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function filters(req: NextRequest, tenantId: string, branchId: string | null) {
  const from = req.nextUrl.searchParams.get("from"); const to = req.nextUrl.searchParams.get("to");
  const type = req.nextUrl.searchParams.get("type"); const patientId = req.nextUrl.searchParams.get("customerId") || req.nextUrl.searchParams.get("patientId");
  return { tenantId, ...(branchId ? { branchId } : {}), ...(type ? { type } : {}), ...(patientId ? { patientId } : {}), ...(from || to ? { createdAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } } : {}) };
}

export async function salesList(req: NextRequest, detail = false) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const data = await prisma.sale.findMany({ where: filters(req, session.tenantId, session.branchId), include: { patient: true, ...(detail ? { items: { include: { product: true } } } : {}) }, orderBy: { createdAt: "desc" }, take: 1000 });
  return NextResponse.json({ data });
}

export async function saleItemsList(req: NextRequest) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const items = await prisma.saleItem.findMany({ where: { sale: filters(req, session.tenantId, session.branchId) }, include: { product: true, sale: { include: { patient: true } } }, orderBy: { sale: { createdAt: "desc" } }, take: 3000 });
  return NextResponse.json({ data: items });
}

export async function patientSalesReport(req: NextRequest) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const patientId = req.nextUrl.searchParams.get("patientId");
  const search = req.nextUrl.searchParams.get("search")?.trim();
  const patients = await prisma.patient.findMany({ where: { tenantId: session.tenantId, deletedAt: null, ...(session.branchId ? { branchId: session.branchId } : {}), ...(patientId ? { id: patientId } : {}), ...(search ? { AND: [{ OR: [{ fullName: { contains: search, mode: "insensitive" } }, { phone: { contains: search } }] }] } : {}) }, include: { sales: { where: { ...(session.branchId ? { branchId: session.branchId } : {}) }, orderBy: { createdAt: "desc" }, take: 100 } }, orderBy: { fullName: "asc" }, take: 1000 });
  return NextResponse.json({ data: patients.map(({ sales, ...patient }) => ({ ...patient, sales: sales.map((sale) => ({ id: sale.id, date: sale.createdAt, total: Number(sale.total), paidAmount: Number(sale.paidAmount), status: sale.status, type: sale.type })), purchases: sales.length, totalSpent: sales.reduce((sum, sale) => sum + Number(sale.total), 0), lastVisit: sales[0]?.createdAt ?? null })) });
}

export async function customersDue(req: NextRequest) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const patientId = req.nextUrl.searchParams.get("patientId") || "";
  const from = req.nextUrl.searchParams.get("from"); const to = req.nextUrl.searchParams.get("to");
  const [patients, sales, users] = await Promise.all([
    prisma.patient.findMany({ where: { tenantId: session.tenantId, deletedAt: null, ...(session.branchId ? { branchId: session.branchId } : {}) }, select: { id: true, fullName: true, phone: true }, orderBy: { fullName: "asc" }, take: 1000 }),
    prisma.sale.findMany({ where: { tenantId: session.tenantId, status: { not: "VOID" }, patientId: { not: null }, ...(session.branchId ? { branchId: session.branchId } : {}), ...(patientId ? { patientId } : {}), ...(from || to ? { createdAt: { ...(from ? { gte: new Date(`${from}T00:00:00.000Z`) } : {}), ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}) } } : {}) }, include: { items: { include: { product: { select: { name: true } } } } }, orderBy: { createdAt: "asc" }, take: 3000 }),
    prisma.userProfile.findMany({ where: { tenantId: session.tenantId }, select: { id: true, fullName: true } }),
  ]);
  const patientById = new Map(patients.map((patient) => [patient.id, patient]));
  const userById = new Map(users.map((user) => [user.id, user.fullName]));
  const grouped = new Map<string, typeof sales>();
  for (const sale of sales) {
    if (!sale.patientId) continue;
    grouped.set(sale.patientId, [...(grouped.get(sale.patientId) ?? []), sale]);
  }
  const data = [...grouped.entries()].map(([id, invoices]) => {
    return { patient: patientById.get(id) ?? null, total: invoices.reduce((sum, invoice) => sum + Number(invoice.total), 0), paid: invoices.reduce((sum, invoice) => sum + Number(invoice.paidAmount), 0), balance: invoices.reduce((sum, invoice) => sum + Math.max(0, Number(invoice.total) - Number(invoice.paidAmount)), 0), invoices: invoices.map((invoice) => ({ id: invoice.id, invoiceNo: invoice.id.slice(-6).toUpperCase(), date: invoice.createdAt, total: Number(invoice.total), paid: Number(invoice.paidAmount), balance: Math.max(0, Number(invoice.total) - Number(invoice.paidAmount)), user: userById.get(invoice.userId ?? "") ?? "—", method: invoice.paymentMethod || "—", items: invoice.items.map((item) => ({ name: item.product.name, quantity: item.quantity })) })) };
  });
  return NextResponse.json({ data, options: { patients } });
}
