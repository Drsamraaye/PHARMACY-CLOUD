import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { createProductSchema } from "@/lib/validators/products.schema";

/** Lists products for the signed-in tenant, with search and type/activity filters. */
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const search = req.nextUrl.searchParams.get("search")?.trim() || "";
  const requestedType = req.nextUrl.searchParams.get("type");
  const type = ["PHARMACY", "LAB", "SERVICE"].includes(requestedType || "") ? requestedType! : undefined;
  const inactive = req.nextUrl.searchParams.get("inactive") === "true";
  const products = await prisma.product.findMany({ where: { tenantId: session.tenantId, ...(session.branchId ? { branchId: session.branchId } : {}), ...(type ? { type } : {}), isActive: !inactive, ...(search ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { barcode: { contains: search, mode: "insensitive" } }] } : {}) }, include: { batches: true, history: { orderBy: { createdAt: "asc" }, take: 1, select: { userId: true, createdAt: true } } }, orderBy: { name: "asc" }, take: 5000 });
  const userIds = [...new Set(products.flatMap((product) => product.history.map((entry) => entry.userId).filter((id): id is string => Boolean(id))))];
  const users = userIds.length ? await prisma.userProfile.findMany({ where: { id: { in: userIds }, tenantId: session.tenantId }, select: { id: true, fullName: true } }) : [];
  const userNames = new Map(users.map((user) => [user.id, user.fullName]));
  const data = products.map((product) => ({ ...product, quantity: product.batches.reduce((sum, batch) => sum + batch.quantity, 0), totalPurchase: product.batches.reduce((sum, batch) => sum + batch.quantity * Number(batch.costPrice), 0), expiryDate: product.batches.filter((batch) => batch.expiryDate).sort((a, b) => a.expiryDate!.getTime() - b.expiryDate!.getTime())[0]?.expiryDate ?? null, addedBy: userNames.get(product.history[0]?.userId ?? "") ?? "—" }));
  return NextResponse.json({ data });
}

/** Creates a product and its opening stock batch atomically. */
export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let input: unknown;
  try { input = await req.json(); } catch { return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 }); }
  if (Array.isArray(input)) {
    const parsedRows = z.array(createProductSchema).min(1).max(100).safeParse(input);
    if (!parsedRows.success) return NextResponse.json({ error: parsedRows.error.issues[0]?.message || "At least one valid product is required" }, { status: 400 });
    const products = await prisma.$transaction(async (tx) => Promise.all(parsedRows.data.map(async (body) => {
      const created = await tx.product.create({ data: { tenantId: session.tenantId, branchId: session.branchId, name: body.name, category: body.category || null, barcode: body.barcode || null, type: body.type, reorderPoint: body.reorderPoint, salePrice: body.salePrice, costPrice: body.costPrice } });
      if (body.quantity > 0 || body.expiryDate) await tx.productBatch.create({ data: { productId: created.id, quantity: body.quantity, costPrice: body.costPrice, expiryDate: body.expiryDate ? new Date(body.expiryDate) : null } });
      await tx.productHistory.create({ data: { tenantId: session.tenantId, productId: created.id, userId: session.userId, action: "CREATED", details: "Product created" } });
      return created;
    })));
    return NextResponse.json({ data: products }, { status: 201 });
  }
  const parsed = createProductSchema.safeParse(input);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid product" }, { status: 400 });
  const body = parsed.data;
  const product = await prisma.$transaction(async (tx) => {
    const created = await tx.product.create({ data: { tenantId: session.tenantId, branchId: session.branchId, name: body.name, category: body.category || null, barcode: body.barcode || null, type: body.type, reorderPoint: body.reorderPoint, salePrice: body.salePrice, costPrice: body.costPrice } });
    if (body.quantity > 0 || body.expiryDate) await tx.productBatch.create({ data: { productId: created.id, quantity: body.quantity, costPrice: body.costPrice, expiryDate: body.expiryDate ? new Date(body.expiryDate) : null } });
    await tx.productHistory.create({ data: { tenantId: session.tenantId, productId: created.id, userId: session.userId, action: "CREATED", details: "Product created" } });
    return created;
  });
  return NextResponse.json({ data: product }, { status: 201 });
}
