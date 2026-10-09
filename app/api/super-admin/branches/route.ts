import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const data = await prisma.branch.findMany({ where: { tenant: { slug: { not: "pharmacloud-platform" } } }, select: { id: true, name: true, isActive: true, createdAt: true, tenant: { select: { id: true, name: true, slug: true, isActive: true } }, _count: { select: { users: true, sales: true } } }, orderBy: [{ tenant: { name: "asc" } }, { name: "asc" }], take: 3000 });
  return NextResponse.json({ data });
}
