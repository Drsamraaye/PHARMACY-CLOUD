import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const tenantId = req.nextUrl.searchParams.get("tenantId") || undefined;
  const data = await prisma.userProfile.findMany({ where: { tenant: { slug: { not: "pharmacloud-platform" } }, ...(tenantId ? { tenantId } : {}) }, select: { id: true, tenantId: true, fullName: true, email: true, role: true, isActive: true, createdAt: true, tenant: { select: { name: true, slug: true, isActive: true } }, branch: { select: { name: true } } }, orderBy: [{ tenant: { name: "asc" } }, { fullName: "asc" }], take: 5000 });
  return NextResponse.json({ data });
}
