import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
type Context = { params: Promise<{ id: string }> };

/** Reads a tenant and the latest subscription record. */
export async function GET(req: NextRequest, { params }: Context) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params; const data = await prisma.tenant.findUnique({ where: { id }, include: { branches: true, subscriptions: { orderBy: { createdAt: "desc" } } } });
  return data ? NextResponse.json({ data }) : NextResponse.json({ error: "Tenant not found" }, { status: 404 });
}

/** Activates or suspends a platform tenant. */
export async function PUT(req: NextRequest, { params }: Context) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = z.object({ isActive: z.boolean(), name: z.string().trim().min(2).optional() }).safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Provide isActive and optional tenant name" }, { status: 400 });
  const { id } = await params; const result = await prisma.tenant.updateMany({ where: { id }, data: parsed.data });
  return result.count ? NextResponse.json({ data: await prisma.tenant.findUnique({ where: { id } }) }) : NextResponse.json({ error: "Tenant not found" }, { status: 404 });
}
