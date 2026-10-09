import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { createSale } from "@/lib/actions/sales.actions";
import type { Prisma } from "../../generated/prisma/client";

type SaleWithDetails = Prisma.SaleGetPayload<{ include: { patient: true; items: { include: { product: true } } } }>;
function visibleSale(sale: SaleWithDetails, pharmacist: boolean) {
  if (!pharmacist) return sale;
  return {
    ...sale,
    patient: sale.patient ? { id: sale.patient.id, fullName: sale.patient.fullName, phone: sale.patient.phone } : null,
    items: sale.items.map((item) => ({ ...item, product: item.product ? { id: item.product.id, name: item.product.name, salePrice: item.product.salePrice } : null })),
  };
}

/** Shared tenant-scoped handlers for the three point-of-sale routes. */
export async function listSales(req: NextRequest, type: "PHARMACY" | "LAB" | "SERVICE") {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const from = req.nextUrl.searchParams.get("from"); const to = req.nextUrl.searchParams.get("to");
  const sales = await prisma.sale.findMany({ where: { tenantId: session.tenantId, type, ...(session.branchId ? { branchId: session.branchId } : {}), ...(from || to ? { createdAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } } : {}) }, include: { patient: true, items: { include: { product: true } } }, orderBy: { createdAt: "desc" }, take: 500 });
  return NextResponse.json({ data: sales.map((sale) => visibleSale(sale, session.role === "PHARMACIST")) });
}

export async function postSale(req: NextRequest, type: "PHARMACY" | "LAB" | "SERVICE") {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { const sale = await createSale(session, type, await req.json()); return NextResponse.json({ data: visibleSale(sale, session.role === "PHARMACIST") }, { status: 201 }); }
  catch (error) { const message = error instanceof Error ? error.message : "Sale could not be created"; return NextResponse.json({ error: message }, { status: /not found|unavailable|exceed|insufficient|invalid|stock/i.test(message) ? 400 : 500 }); }
}
