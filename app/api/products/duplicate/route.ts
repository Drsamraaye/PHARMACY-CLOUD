import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const mergeSchema = z.object({ keepProductId: z.string().min(1), duplicateProductId: z.string().min(1) }).refine((data) => data.keepProductId !== data.duplicateProductId, { message: "Choose two different products" });

/** Finds active catalog products sharing a barcode or case-insensitive name. */
export async function GET(req: NextRequest) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const products = await prisma.product.findMany({ where: { tenantId: session.tenantId, isActive: true, ...(session.branchId ? { branchId: session.branchId } : {}) }, select: { id: true, name: true, barcode: true, type: true, salePrice: true }, orderBy: { name: "asc" }, take: 2000 });
  const groups = new Map<string, typeof products>();
  for (const product of products) {
    const keys = [product.barcode?.trim().toLowerCase(), product.name.trim().toLowerCase()].filter(Boolean) as string[];
    for (const key of keys) { const group = groups.get(key) || []; group.push(product); groups.set(key, group); }
  }
  const seen = new Set<string>(); const data: { match: string; products: typeof products }[] = [];
  for (const [key, matches] of groups) { const unique = [...new Map(matches.map((item) => [item.id, item])).values()]; const signature = unique.map((item) => item.id).sort().join(":"); if (unique.length > 1 && !seen.has(signature)) { data.push({ match: key, products: unique }); seen.add(signature); } }
  return NextResponse.json({ data });
}

/** Moves the duplicate's remaining stock into the retained product and archives it atomically. */
export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let input: unknown;
  try { input = await req.json(); } catch { return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 }); }
  const parsed = mergeSchema.safeParse(input);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid merge request" }, { status: 400 });

  try {
    const result = await prisma.$transaction(async (tx) => {
      const where = { tenantId: session.tenantId, ...(session.branchId ? { branchId: session.branchId } : {}) };
      const [keep, duplicate] = await Promise.all([
        tx.product.findFirst({ where: { ...where, id: parsed.data.keepProductId, isActive: true }, select: { id: true, name: true, type: true } }),
        tx.product.findFirst({ where: { ...where, id: parsed.data.duplicateProductId, isActive: true }, select: { id: true, name: true, type: true } }),
      ]);
      if (!keep || !duplicate) throw new Error("PRODUCT_NOT_FOUND");
      if (keep.type !== duplicate.type) throw new Error("PRODUCT_TYPE_MISMATCH");

      const moved = await tx.productBatch.updateMany({ where: { productId: duplicate.id }, data: { productId: keep.id } });
      await tx.product.update({ where: { id: duplicate.id }, data: { isActive: false } });
      await tx.productHistory.createMany({ data: [
        { tenantId: session.tenantId, productId: keep.id, userId: session.userId, action: "DUPLICATE_MERGE", details: `Merged ${duplicate.name} (${duplicate.id}); moved ${moved.count} stock batches` },
        { tenantId: session.tenantId, productId: duplicate.id, userId: session.userId, action: "MERGED_INTO", details: `Merged into ${keep.name} (${keep.id})` },
      ] });
      return { keptProductId: keep.id, archivedProductId: duplicate.id, movedBatchCount: moved.count };
    });
    return NextResponse.json({ data: result });
  } catch (error) {
    if (error instanceof Error && error.message === "PRODUCT_NOT_FOUND") return NextResponse.json({ error: "One or both products were not found or are already archived" }, { status: 404 });
    if (error instanceof Error && error.message === "PRODUCT_TYPE_MISMATCH") return NextResponse.json({ error: "Products must have the same type to merge" }, { status: 400 });
    console.error("Product merge failed", error);
    return NextResponse.json({ error: "Could not merge products" }, { status: 500 });
  }
}
