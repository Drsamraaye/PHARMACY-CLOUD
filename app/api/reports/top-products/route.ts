import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const dateAt = (value: string, end = false) => {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (end) date.setHours(23, 59, 59, 999);
  else date.setHours(0, 0, 0, 0);
  return date;
};

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const params = req.nextUrl.searchParams;
  const now = new Date();
  const fromValue = params.get("from") || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const toValue = params.get("to") || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const search = (params.get("search") || "").trim().toLocaleLowerCase();
  const canChoose = session.role === "OWNER" || session.role === "ADMIN";
  const selectedBranch = canChoose ? (params.get("branchId") || "") : (session.branchId || "");
  const branchFilter = selectedBranch ? { branchId: selectedBranch } : session.branchId ? { branchId: session.branchId } : {};
  const from = dateAt(fromValue);
  const to = dateAt(toValue, true);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) return NextResponse.json({ error: "Invalid date range" }, { status: 400 });

  const [items, branches] = await Promise.all([
    prisma.saleItem.findMany({
      where: { sale: { tenantId: session.tenantId, ...branchFilter, status: { not: "VOID" }, createdAt: { gte: from, lte: to } } },
      select: { productId: true, quantity: true, unitPrice: true, product: { select: { name: true, type: true, costPrice: true } } },
      take: 50000,
    }),
    canChoose ? prisma.branch.findMany({ where: { tenantId: session.tenantId, isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }) : Promise.resolve([]),
  ]);
  const grouped = new Map<string, { productId: string; name: string; type: string; quantity: number; sales: number; cost: number; transactions: number }>();
  for (const item of items) {
    const product = grouped.get(item.productId) ?? { productId: item.productId, name: item.product.name, type: item.product.type, quantity: 0, sales: 0, cost: 0, transactions: 0 };
    product.quantity += item.quantity;
    product.sales += Number(item.unitPrice) * item.quantity;
    product.cost += Number(item.product.costPrice) * item.quantity;
    product.transactions += 1;
    grouped.set(item.productId, product);
  }
  const allProducts = [...grouped.values()].sort((a, b) => b.quantity - a.quantity || b.sales - a.sales);
  const filtered = search ? allProducts.filter(product => product.name.toLocaleLowerCase().includes(search)) : allProducts;
  const data = filtered.slice(0, 500).map(product => ({ ...product, profit: product.sales - product.cost }));
  return NextResponse.json({ data, options: { branches }, range: { from: fromValue, to: toValue } });
}
