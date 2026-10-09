import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Lists suppliers for the current tenant, optionally filtered by search text. */
export async function GET(req: NextRequest) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const search = req.nextUrl.searchParams.get("search")?.trim();
  const data = await prisma.supplier.findMany({ where: { tenantId: session.tenantId, ...(session.branchId ? { branchId: session.branchId } : {}), ...(search ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { phone: { contains: search } }] } : {}) }, orderBy: { name: "asc" }, take: 500 });
  return NextResponse.json({ data });
}

/** Registers a supplier within the current tenant. */
export async function POST(req: NextRequest) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const schema = z.object({ name: z.string().trim().min(2).max(160), phone: z.string().optional(), email: z.string().email().optional().or(z.literal("")), address: z.string().optional(), city: z.string().optional(), country: z.string().optional(), paymentTerms: z.string().optional(), notes: z.string().optional() });
  const parsed = schema.safeParse(await req.json()); if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid supplier" }, { status: 400 });
  const data = await prisma.supplier.create({ data: { ...parsed.data, email: parsed.data.email || null, tenantId: session.tenantId, branchId: session.branchId } });
  return NextResponse.json({ data }, { status: 201 });
}
