import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "../../generated/prisma/client";

type RecordObject = Record<string, unknown>;
function asObject(value: unknown): RecordObject | null { return value && typeof value === "object" && !Array.isArray(value) ? value as RecordObject : null; }
function present(row: { id: string; record: unknown; createdAt: Date; updatedAt: Date }) { return { id: row.id, ...(asObject(row.record) || { value: row.record }), createdAt: row.createdAt, updatedAt: row.updatedAt }; }

/** Provides tenant-isolated CRUD storage for configurable workflows without dedicated tables. */
export async function collectionGET(req: NextRequest, collection: string) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const search = req.nextUrl.searchParams.get("search")?.toLowerCase();
  const rows = await prisma.moduleRecord.findMany({ where: { tenantId: session.tenantId, collection, deletedAt: null, ...(session.branchId ? { branchId: session.branchId } : {}) }, orderBy: { createdAt: "desc" }, take: 1000 });
  let data: RecordObject[] = rows.map(present);
  if (session.role === "PHARMACIST" && collection === "setup/payment-methods") {
    data = data.map((row) => ({ id: row.id, name: typeof row.name === "string" ? row.name : undefined, method: typeof row.method === "string" ? row.method : undefined }));
  }
  if (search) data = data.filter((row) => JSON.stringify(row).toLowerCase().includes(search));
  return NextResponse.json({ data });
}

export async function collectionPOST(req: NextRequest, collection: string) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const record = asObject(await req.json()); if (!record) return NextResponse.json({ error: "A record object is required" }, { status: 400 });
  const created = await prisma.moduleRecord.create({ data: { tenantId: session.tenantId, branchId: session.branchId, collection, record: record as Prisma.InputJsonValue, createdBy: session.userId } });
  return NextResponse.json({ data: present(created) }, { status: 201 });
}

export async function collectionPATCH(req: NextRequest, collection: string) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = asObject(await req.json()); if (!body || typeof body.id !== "string") return NextResponse.json({ error: "Record id is required" }, { status: 400 });
  const existing = await prisma.moduleRecord.findFirst({ where: { id: body.id, tenantId: session.tenantId, collection, ...(session.branchId ? { branchId: session.branchId } : {}), deletedAt: null } });
  if (!existing) return NextResponse.json({ error: "Record not found" }, { status: 404 });
  const updates = asObject(body.data) || Object.fromEntries(Object.entries(body).filter(([key]) => key !== "id"));
  const record = { ...(asObject(existing.record) || {}), ...updates };
  const saved = await prisma.moduleRecord.update({ where: { id: existing.id }, data: { record: record as Prisma.InputJsonValue } });
  return NextResponse.json({ data: present(saved) });
}

export async function collectionDELETE(req: NextRequest, collection: string) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = asObject(await req.json().catch(() => ({}))); const id = String(body?.id || req.nextUrl.searchParams.get("id") || "");
  if (!id) return NextResponse.json({ error: "Record id is required" }, { status: 400 });
  const result = await prisma.moduleRecord.updateMany({ where: { id, tenantId: session.tenantId, collection, ...(session.branchId ? { branchId: session.branchId } : {}), deletedAt: null }, data: { deletedAt: new Date() } });
  return result.count ? NextResponse.json({ data: { id, deleted: true } }) : NextResponse.json({ error: "Record not found" }, { status: 404 });
}

export async function itemGET(req: NextRequest, id: string, collection: string) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const row = await prisma.moduleRecord.findFirst({ where: { id, tenantId: session.tenantId, collection, ...(session.branchId ? { branchId: session.branchId } : {}), deletedAt: null } });
  return row ? NextResponse.json({ data: present(row) }) : NextResponse.json({ error: "Record not found" }, { status: 404 });
}

export async function itemPATCH(req: NextRequest, id: string, collection: string) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const patch = asObject(await req.json()); if (!patch) return NextResponse.json({ error: "A record object is required" }, { status: 400 });
  const row = await prisma.moduleRecord.findFirst({ where: { id, tenantId: session.tenantId, collection, ...(session.branchId ? { branchId: session.branchId } : {}), deletedAt: null } });
  if (!row) return NextResponse.json({ error: "Record not found" }, { status: 404 });
  const record = { ...(asObject(row.record) || {}), ...patch };
  return NextResponse.json({ data: present(await prisma.moduleRecord.update({ where: { id }, data: { record: record as Prisma.InputJsonValue } })) });
}

export async function itemDELETE(req: NextRequest, id: string, collection: string) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await prisma.moduleRecord.updateMany({ where: { id, tenantId: session.tenantId, collection, ...(session.branchId ? { branchId: session.branchId } : {}), deletedAt: null }, data: { deletedAt: new Date() } });
  return result.count ? NextResponse.json({ data: { id, deleted: true } }) : NextResponse.json({ error: "Record not found" }, { status: 404 });
}
