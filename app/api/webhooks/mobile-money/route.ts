import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

/** Verifies a signed mobile-money callback and applies its payment once to a sale. */
export async function POST(req: NextRequest) {
  const secret = process.env.MOBILE_MONEY_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Mobile money webhook is not configured" }, { status: 503 });
  const raw = await req.text(); const signature = req.headers.get("x-webhook-signature") || "";
  const expected = createHmac("sha256", secret).update(raw).digest();
  let supplied: Buffer; try { supplied = Buffer.from(signature, "hex"); } catch { supplied = Buffer.alloc(0); }
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
  let payload: unknown; try { payload = JSON.parse(raw); } catch { return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 }); }
  const parsed = z.object({ saleId: z.string(), amount: z.coerce.number().positive(), reference: z.string().min(1), status: z.enum(["SUCCESS", "FAILED", "PENDING"]) }).safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payment callback" }, { status: 400 });
  if (parsed.data.status !== "SUCCESS") return NextResponse.json({ received: true });
  try {
    await prisma.$transaction(async (tx) => {
      if (await tx.moduleRecord.findUnique({ where: { externalRef: parsed.data.reference } })) return;
      const sale = await tx.sale.findUnique({ where: { id: parsed.data.saleId } });
      if (!sale || sale.status === "VOID" || parsed.data.amount > Number(sale.total) - Number(sale.paidAmount)) throw new Error("Sale not found or payment exceeds balance");
      const amount = Math.round((Number(sale.paidAmount) + parsed.data.amount) * 100) / 100;
      const updated = await tx.sale.updateMany({ where: { id: sale.id, paidAmount: sale.paidAmount }, data: { paidAmount: amount, status: amount >= Number(sale.total) ? "PAID" : "PARTIAL" } });
      if (!updated.count) throw new Error("Sale balance changed; callback can be retried");
      await tx.moduleRecord.create({ data: { tenantId: sale.tenantId, branchId: sale.branchId, collection: "mobile-money-payments", externalRef: parsed.data.reference, record: { saleId: sale.id, amount: parsed.data.amount, reference: parsed.data.reference } } });
    }, { isolationLevel: "Serializable" });
    return NextResponse.json({ received: true });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Payment could not be applied" }, { status: 400 }); }
}
