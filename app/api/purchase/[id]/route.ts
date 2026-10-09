import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ id: string }> };
/** Reads one tenant purchase with supplier and received items. */
export async function GET(req: NextRequest, { params }: Context) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params; const data = await prisma.purchase.findFirst({ where: { id, tenantId: session.tenantId }, include: { supplier: true, items: { include: { product: true } } } });
  return data ? NextResponse.json({ data }) : NextResponse.json({ error: "Purchase not found" }, { status: 404 });
}

/** Voids a purchase record; inventory adjustments require a separate supplier return. */
export async function PUT(req: NextRequest, { params }: Context) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params; const result = await prisma.purchase.updateMany({ where: { id, tenantId: session.tenantId }, data: { status: "VOID" } });
  return result.count ? NextResponse.json({ data: await prisma.purchase.findUnique({ where: { id } }) }) : NextResponse.json({ error: "Purchase not found" }, { status: 404 });
}
