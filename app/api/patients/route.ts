import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const patientSchema = z.object({ fullName: z.string().trim().min(2).max(160), phone: z.string().trim().max(40).optional(), email: z.string().email().optional().or(z.literal("")), age: z.coerce.number().int().min(0).max(125).optional(), gender: z.string().trim().max(30).optional() });

/** Returns active patients belonging to the current tenant and branch. */
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const search = req.nextUrl.searchParams.get("search")?.trim() || "";
  const patients = await prisma.patient.findMany({ where: { tenantId: session.tenantId, deletedAt: null, ...(session.branchId ? { branchId: session.branchId } : {}), ...(search ? { AND: [{ OR: [{ fullName: { contains: search, mode: "insensitive" } }, { phone: { contains: search } }] }] } : {}) }, ...(session.role === "PHARMACIST" ? { select: { id: true, fullName: true, phone: true } } : {}), orderBy: { fullName: "asc" }, take: 500 });
  return NextResponse.json({ data: patients });
}

/** Registers a patient under the current tenant and branch. */
export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = patientSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid patient" }, { status: 400 });
  const patient = await prisma.patient.create({ data: { ...parsed.data, email: parsed.data.email || null, tenantId: session.tenantId, branchId: session.branchId } });
  return NextResponse.json({ data: patient }, { status: 201 });
}
