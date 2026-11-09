import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { businessDateKey, businessDateRecord } from "@/lib/business-date";

/** Lists sales that can receive a return credit note and previously returned lines. */
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (req.nextUrl.searchParams.get("sourceSales") === "true") {
    const sales = await prisma.sale.findMany({
      where: { tenantId: session.tenantId, type: { in: ["PHARMACY", "SERVICE", "LAB"] }, status: { not: "VOID" }, ...(session.branchId ? { branchId: session.branchId } : {}) },
      include: {
        patient: { select: { id: true, fullName: true, phone: true } },
        items: { include: { product: { select: { id: true, name: true, type: true } } } },
        creditNotes: { where: { kind: "RETURN" }, include: { items: { select: { productId: true, quantity: true } } } },
        refunds: { include: { items: { select: { productId: true, quantity: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    });
    return NextResponse.json({ data: sales.map((sale) => {
      const returned = new Map<string, number>();
      for (const note of sale.creditNotes) for (const item of note.items) returned.set(item.productId, (returned.get(item.productId) || 0) + item.quantity);
      for (const refund of sale.refunds) for (const item of refund.items) returned.set(item.productId, (returned.get(item.productId) || 0) + item.quantity);
      const creditAmount = sale.creditNotes.reduce((sum, note) => sum + Number(note.amount), 0);
      const availableDebt = Math.max(0, Number(sale.total) - Number(sale.paidAmount) - creditAmount);
      const subtotalCents = sale.items.reduce((sum, item) => sum + Math.round(Number(item.unitPrice) * 100) * item.quantity, 0);
      const saleTotalCents = Math.round(Number(sale.total) * 100);
      return {
        id: sale.id, date: sale.createdAt, type: sale.type, total: Number(sale.total), paidAmount: Number(sale.paidAmount),
        patient: sale.patient,
        items: sale.items.map((item) => ({ productId: item.productId, name: item.product.name, type: item.product.type, quantity: item.quantity, returnedQuantity: returned.get(item.productId) || 0, unitPrice: subtotalCents > 0 ? Math.round(Math.round(Number(item.unitPrice) * 100) * saleTotalCents / subtotalCents) / 100 : Number(item.unitPrice) })),
        creditAmount, remainingCredit: availableDebt,
      };
    }) });
  }

  const data = await prisma.creditNote.findMany({ where: { tenantId: session.tenantId }, include: { items: { include: { product: { select: { name: true, type: true } } } } }, orderBy: { createdAt: "desc" }, take: 1000 });
  return NextResponse.json({ data });
}

/** Records a return from a pharmacy customer, reduces its invoice debt and restores returned stock. */
export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = z.object({
    saleId: z.string().min(1),
    items: z.array(z.object({ productId: z.string().min(1), quantity: z.coerce.number().int().positive().max(1_000_000) })).min(1).max(500),
    notes: z.string().trim().max(1000).optional(),
  }).safeParse(await req.json().catch(() => null));
  if (!parsed.success || new Set(parsed.data?.items.map((item) => item.productId)).size !== parsed.data?.items.length) {
    return NextResponse.json({ error: "Dooro iibka oo geli tiro sax ah oo alaab ama adeeg ah." }, { status: 400 });
  }

  try {
    const data = await prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findFirst({
        where: { id: parsed.data.saleId, tenantId: session.tenantId, type: { in: ["PHARMACY", "SERVICE", "LAB"] }, status: { not: "VOID" }, ...(session.branchId ? { branchId: session.branchId } : {}) },
        include: { items: { include: { product: { select: { id: true, name: true, type: true, costPrice: true } } } }, creditNotes: { where: { kind: "RETURN" }, include: { items: true } }, refunds: { include: { items: true } } },
      });
      if (!sale) throw new Error("Iibka pharmacy-ga lama helin.");
      const businessDate = businessDateRecord(businessDateKey(new Date()));
      if (session.branchId && await tx.dailyCloseout.findFirst({ where: { tenantId: session.tenantId, branchId: session.branchId, businessDate }, select: { id: true } })) throw new Error("Maalintan waa la xiray; ku diiwaangeli credit note maalin furan.");

      const previouslyReturned = new Map<string, number>();
      for (const note of sale.creditNotes) for (const item of note.items) previouslyReturned.set(item.productId, (previouslyReturned.get(item.productId) || 0) + item.quantity);
      for (const refund of sale.refunds) for (const item of refund.items) previouslyReturned.set(item.productId, (previouslyReturned.get(item.productId) || 0) + item.quantity);
      const saleLines = new Map(sale.items.map((item) => [item.productId, item]));
      const subtotalCents = sale.items.reduce((sum, item) => sum + Math.round(Number(item.unitPrice) * 100) * item.quantity, 0);
      const totalCents = Math.round(Number(sale.total) * 100);
      const items = parsed.data.items.map((line) => {
        const sold = saleLines.get(line.productId);
        if (!sold) throw new Error("Alaabta ama adeegga la doortay kama mid aha iibkan.");
        if (line.quantity + (previouslyReturned.get(line.productId) || 0) > sold.quantity) throw new Error(`Tirada la celinayo waxay ka badan tahay tii la iibiyey: ${sold.product.name}.`);
        const originalUnitCents = Math.round(Number(sold.unitPrice) * 100);
        const netUnitCents = subtotalCents > 0 ? Math.round(originalUnitCents * totalCents / subtotalCents) : originalUnitCents;
        return { ...line, product: sold.product, unitPrice: netUnitCents / 100 };
      });
      const amountCents = items.reduce((sum, line) => sum + Math.round(line.unitPrice * 100) * line.quantity, 0);
      const paidCents = Math.round(Number(sale.paidAmount) * 100);
      const priorCreditsCents = sale.creditNotes.reduce((sum, note) => sum + Math.round(Number(note.amount) * 100), 0);
      const dueCents = Math.max(0, totalCents - paidCents - priorCreditsCents);
      if (amountCents > dueCents) throw new Error("Credit note-ku kama badnaan karo deynta aan weli la bixin.");

      const note = await tx.creditNote.create({ data: {
        tenantId: session.tenantId, saleId: sale.id, patientId: sale.patientId, kind: "RETURN",
        amount: amountCents / 100, remainingAmount: 0, status: "APPLIED",
        items: { create: items.map((line) => ({ productId: line.productId, quantity: line.quantity, unitPrice: line.unitPrice, costPrice: Number(line.product.costPrice) })) },
      } });
      await tx.sale.update({ where: { id: sale.id }, data: { status: paidCents + priorCreditsCents + amountCents >= totalCents ? "PAID" : "PARTIAL" } });

      for (const line of items) {
        if (line.product.type === "PHARMACY") {
          await tx.productBatch.create({ data: { productId: line.productId, quantity: line.quantity, costPrice: line.product.costPrice, batchNo: `CREDIT-${note.id.slice(-8)}` } });
          await tx.productHistory.create({ data: { tenantId: session.tenantId, productId: line.productId, userId: session.userId, action: "CREDIT_NOTE_RETURN", details: `${line.quantity} returned from sale ${sale.id}; credit note ${note.id}` } });
        }
      }
      if (parsed.data.notes) await tx.moduleRecord.create({ data: { tenantId: session.tenantId, branchId: session.branchId, collection: "credit-note-details", createdBy: session.userId, record: { creditNoteId: note.id, saleId: sale.id, notes: parsed.data.notes } } });
      return { ...note, amount: amountCents / 100, debtAfter: (dueCents - amountCents) / 100 };
    }, { isolationLevel: "Serializable" });
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Credit note lama samayn karin." }, { status: 400 });
  }
}
