import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Returns archived products for the current tenant. */
export async function GET(req: NextRequest) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const search = req.nextUrl.searchParams.get("search")?.trim();
  const products = await prisma.product.findMany({ where: { tenantId: session.tenantId, ...(session.branchId ? { branchId: session.branchId } : {}), isActive: false, ...(search ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { barcode: { contains: search, mode: "insensitive" } }] } : {}) }, include: { batches: true }, orderBy: { archivedAt: "desc" }, take: 500 });
  const actorIds = [...new Set(products.map((product) => product.archivedBy).filter((id): id is string => Boolean(id)))];
  const actors = actorIds.length ? await prisma.userProfile.findMany({ where: { tenantId: session.tenantId, id: { in: actorIds } }, select: { id: true, fullName: true } }) : [];
  const names = new Map(actors.map((actor) => [actor.id, actor.fullName]));
  const data = products.map((product) => ({ ...product, quantity: product.batches.reduce((sum, batch) => sum + batch.quantity, 0), expiryDate: product.batches.filter((batch) => batch.expiryDate).sort((a, b) => a.expiryDate!.getTime() - b.expiryDate!.getTime())[0]?.expiryDate ?? null, archivedByName: product.archivedBy ? names.get(product.archivedBy) ?? "—" : "—" }));
  return NextResponse.json({ data });
}
