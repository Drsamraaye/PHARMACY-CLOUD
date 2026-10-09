import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Reads all permission grants, optionally limited to one tenant group. */
export async function GET(req: NextRequest) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const groupId = req.nextUrl.searchParams.get("groupId");
  const groups = await prisma.adminGroup.findMany({ where: { tenantId: session.tenantId, ...(groupId ? { id: groupId } : {}) }, include: { privileges: true }, orderBy: { name: "asc" } });
  return NextResponse.json({ data: groups });
}

/** Replaces one group's permission matrix atomically. */
export async function PUT(req: NextRequest) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "OWNER" && session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = z.object({ groupId: z.string(), privileges: z.array(z.object({ key: z.string().min(1), allowed: z.boolean() })) }).safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "A group and valid permission list are required" }, { status: 400 });
  const group = await prisma.adminGroup.findFirst({ where: { id: parsed.data.groupId, tenantId: session.tenantId } });
  if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });
  const unique = [...new Map(parsed.data.privileges.map((item) => [item.key, item])).values()];
  const data = await prisma.$transaction(async (tx) => { await tx.privilege.deleteMany({ where: { groupId: group.id } }); if (unique.length) await tx.privilege.createMany({ data: unique.map((item) => ({ ...item, groupId: group.id })) }); return tx.privilege.findMany({ where: { groupId: group.id }, orderBy: { key: "asc" } }); });
  return NextResponse.json({ data });
}
