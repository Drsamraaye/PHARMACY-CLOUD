import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** Cron endpoint that reports stock batches nearing expiry; guarded by CRON_SECRET. */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const now = new Date(); const horizon = new Date(now); horizon.setDate(horizon.getDate() + 90);
  const batches = await prisma.productBatch.findMany({ where: { expiryDate: { gte: now, lte: horizon }, quantity: { gt: 0 }, product: { isActive: true } }, include: { product: { select: { id: true, tenantId: true, name: true } } }, orderBy: { expiryDate: "asc" }, take: 5000 });
  return NextResponse.json({ data: batches.map((batch) => ({ tenantId: batch.product.tenantId, product: batch.product.name, productId: batch.product.id, quantity: batch.quantity, expiryDate: batch.expiryDate })) });
}
