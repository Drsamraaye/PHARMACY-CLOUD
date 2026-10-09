import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "../../../../generated/prisma/client";

function recordObject(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }

export async function GET(req: NextRequest) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const requestedBranch = req.nextUrl.searchParams.get("branchId") || "";
  const branchId = session.branchId || requestedBranch;
  if (session.branchId && requestedBranch && requestedBranch !== session.branchId) return NextResponse.json({ error: "Branch access denied" }, { status: 403 });
  if (branchId && !await prisma.branch.findFirst({ where: { id: branchId, tenantId: session.tenantId, isActive: true } })) return NextResponse.json({ error: "Branch not found" }, { status: 404 });
  const [branches, products, sections, assignmentRows] = await Promise.all([
    prisma.branch.findMany({ where: { tenantId: session.tenantId, isActive: true, ...(session.branchId ? { id: session.branchId } : {}) }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.product.findMany({ where: { tenantId: session.tenantId, type: "LAB", isActive: true, ...(branchId ? { branchId } : session.branchId ? { branchId: session.branchId } : {}) }, select: { id: true, branchId: true, name: true, category: true, salePrice: true }, orderBy: { name: "asc" }, take: 1000 }),
    prisma.moduleRecord.findMany({ where: { tenantId: session.tenantId, collection: "laboratory/tests", deletedAt: null, ...(branchId ? { OR: [{ branchId }, { branchId: null }] } : session.branchId ? { branchId: session.branchId } : {}) }, orderBy: { createdAt: "asc" }, take: 1000 }),
    prisma.moduleRecord.findMany({ where: { tenantId: session.tenantId, collection: "laboratory/assignments", deletedAt: null, ...(branchId ? { branchId } : session.branchId ? { branchId: session.branchId } : {}) }, take: 1000 }),
  ]);
  const data = assignmentRows.map((row) => ({ id: row.id, ...recordObject(row.record) }));
  return NextResponse.json({ data: { branches, branchId, products, sections: sections.map((row) => ({ id: row.id, ...recordObject(row.record) })), assignments: data } });
}

export async function POST(req: NextRequest) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null); const productId = typeof body?.productId === "string" ? body.productId : ""; const requestedBranch = typeof body?.branchId === "string" ? body.branchId : ""; const branchId = session.branchId || requestedBranch;
  const testIds = Array.isArray(body?.testIds) ? body.testIds.filter((id: unknown): id is string => typeof id === "string") : [];
  if (!productId || !branchId) return NextResponse.json({ error: "Product and branch are required" }, { status: 400 });
  if (session.branchId && requestedBranch && requestedBranch !== session.branchId) return NextResponse.json({ error: "Branch access denied" }, { status: 403 });
  const product = await prisma.product.findFirst({ where: { id: productId, tenantId: session.tenantId, branchId, type: "LAB", isActive: true }, select: { id: true, name: true } });
  if (!product) return NextResponse.json({ error: "Laboratory product not found in this branch" }, { status: 404 });
  const sections = await prisma.moduleRecord.findMany({ where: { tenantId: session.tenantId, collection: "laboratory/tests", deletedAt: null, OR: [{ branchId }, { branchId: null }] }, take: 1000 });
  const available = new Map<string, { sectionName: string; name: string; normalRange: string }>();
  for (const row of sections) { const data = recordObject(row.record); const sectionName = String(data.sectionName ?? data.section ?? data.name ?? ""); const tests = Array.isArray(data.tests) ? data.tests : data.name ? [{ name: data.name, normalRange: data.normalRange }] : []; tests.forEach((test, index) => { const item = recordObject(test); available.set(`${row.id}:${index}`, { sectionName, name: String(item.name ?? ""), normalRange: String(item.normalRange ?? "") }); }); }
  if (testIds.some((id: string) => !available.has(id))) return NextResponse.json({ error: "One or more selected tests are unavailable" }, { status: 400 });
  const assignment = { productId, productName: product.name, branchId, testIds, assignedTests: testIds.map((id: string) => available.get(id)!) };
  const old = await prisma.moduleRecord.findMany({ where: { tenantId: session.tenantId, collection: "laboratory/assignments", branchId, deletedAt: null }, take: 1000 });
  const existing = old.find((row) => recordObject(row.record).productId === productId);
  const saved = existing
    ? await prisma.moduleRecord.update({ where: { id: existing.id }, data: { record: assignment as Prisma.InputJsonValue } })
    : await prisma.moduleRecord.create({ data: { tenantId: session.tenantId, branchId, collection: "laboratory/assignments", createdBy: session.userId, record: assignment as Prisma.InputJsonValue } });
  return NextResponse.json({ data: { id: saved.id, ...assignment } }, { status: existing ? 200 : 201 });
}
