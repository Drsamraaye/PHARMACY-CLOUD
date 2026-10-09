import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Lists permission groups belonging to the current tenant. */
export async function GET(req: NextRequest) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const data = await prisma.adminGroup.findMany({ where: { tenantId: session.tenantId }, include: { _count: { select: { users: true, privileges: true } } }, orderBy: { name: "asc" } });
  return NextResponse.json({ data });
}

/** Creates an empty permission group for the tenant. */
export async function POST(req: NextRequest) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "OWNER" && session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = z.object({ name: z.string().trim().min(2).max(80) }).safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Group name is required" }, { status: 400 });
  try { const data = await prisma.adminGroup.create({ data: { tenantId: session.tenantId, name: parsed.data.name } }); return NextResponse.json({ data }, { status: 201 }); }
  catch { return NextResponse.json({ error: "A group with this name already exists" }, { status: 409 }); }
}

export async function PUT(req: NextRequest) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "OWNER" && session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = z.object({ id: z.string().min(1), name: z.string().trim().min(2).max(80) }).safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Group id and name are required" }, { status: 400 });
  const existing = await prisma.adminGroup.findFirst({ where: { id: parsed.data.id, tenantId: session.tenantId } });
  if (!existing) return NextResponse.json({ error: "Group not found" }, { status: 404 });
  try { const data = await prisma.adminGroup.update({ where: { id: existing.id }, data: { name: parsed.data.name } }); return NextResponse.json({ data }); }
  catch { return NextResponse.json({ error: "A group with this name already exists" }, { status: 409 }); }
}

export async function DELETE(req: NextRequest) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "OWNER" && session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const id = req.nextUrl.searchParams.get("id") || String((await req.json().catch(() => ({}))).id || "");
  if (!id) return NextResponse.json({ error: "Group id is required" }, { status: 400 });
  const group = await prisma.adminGroup.findFirst({ where: { id, tenantId: session.tenantId } });
  if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });
  await prisma.adminGroup.delete({ where: { id } });
  return NextResponse.json({ data: { id, deleted: true } });
}
