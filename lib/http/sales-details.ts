import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type SaleType = "PHARMACY" | "LAB";
type Context = { params: Promise<{ id: string }> };

/** Fetches a tenant sale with its customer and line items. */
export async function saleById(req: NextRequest, context: Context, type: SaleType) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params; const data = await prisma.sale.findFirst({ where: { id, tenantId: session.tenantId, type }, include: { patient: true, items: { include: { product: true } } } });
  return data ? NextResponse.json({ data }) : NextResponse.json({ error: "Sale not found" }, { status: 404 });
}

/** Voids a sale and restores returned pharmacy quantities in one transaction. */
export async function voidSale(req: NextRequest, context: Context, type: SaleType) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  try {
    const data = await prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findFirst({ where: { id, tenantId: session.tenantId, type }, include: { items: { include: { product: true } }, refunds: true } });
      if (!sale) throw new Error("Sale not found");
      if (sale.status === "VOID") return sale;
      if (sale.refunds.length) throw new Error("A sale with refunds cannot be voided");
      if (type === "PHARMACY") for (const item of sale.items) await tx.productBatch.create({ data: { productId: item.productId, quantity: item.quantity, costPrice: item.product.costPrice, batchNo: `VOID-${sale.id.slice(-8)}` } });
      return tx.sale.update({ where: { id: sale.id }, data: { status: "VOID" }, include: { items: { include: { product: true } } } });
    }, { isolationLevel: "Serializable" });
    return NextResponse.json({ data });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Sale could not be voided" }, { status: 400 }); }
}
