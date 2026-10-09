import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Lists the tenant's active bank accounts and current balances. */
export async function GET(req: NextRequest) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const data = await prisma.bankAccount.findMany({ where: { tenantId: session.tenantId, isActive: true, ...(session.branchId ? { branchId: session.branchId } : {}) }, include: { branch: { select: { name: true } } }, orderBy: { name: "asc" } });
  return NextResponse.json({ data });
}

export async function PUT(req: NextRequest) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = z.object({ id: z.string(), name: z.string().trim().min(2), currency: z.enum(["USD", "SOS", "ETB"]) }).safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Account name, currency, and id are required" }, { status: 400 });
  const result = await prisma.bankAccount.updateMany({ where: { id: parsed.data.id, tenantId: session.tenantId, isActive: true, ...(session.branchId ? { branchId: session.branchId } : {}) }, data: { name: parsed.data.name, currency: parsed.data.currency } });
  if (!result.count) return NextResponse.json({ error: "Account not found" }, { status: 404 });
  return NextResponse.json({ data: await prisma.bankAccount.findUnique({ where: { id: parsed.data.id }, include: { branch: { select: { name: true } } } }) });
}

/** Archives an empty account without deleting its transaction history. */
export async function DELETE(req: NextRequest) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = z.object({ id: z.string() }).safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Account id is required" }, { status: 400 });
  const result = await prisma.bankAccount.updateMany({ where: { id: parsed.data.id, tenantId: session.tenantId, isActive: true, balance: 0, ...(session.branchId ? { branchId: session.branchId } : {}) }, data: { isActive: false } });
  if (!result.count) return NextResponse.json({ error: "Account not found or has a remaining balance" }, { status: 400 });
  return NextResponse.json({ data: { id: parsed.data.id, archived: true } });
}

/** Creates a tenant bank account with an optional opening balance. */
export async function POST(req: NextRequest) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = z.object({ name: z.string().trim().min(2), currency: z.enum(["USD", "SOS", "ETB"]).default("USD"), openingBalance: z.coerce.number().min(0).default(0) }).safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Account name and valid balance are required" }, { status: 400 });
  try {
    const data = await prisma.$transaction(async (tx) => {
      const account = await tx.bankAccount.create({ data: { tenantId: session.tenantId, branchId: session.branchId, name: parsed.data.name, currency: parsed.data.currency, balance: parsed.data.openingBalance } });
      if (parsed.data.openingBalance > 0) await tx.bankTransaction.create({ data: { tenantId: session.tenantId, bankAccountId: account.id, type: "DEPOSIT", amount: parsed.data.openingBalance, description: "Opening balance", createdBy: session.userId } });
      return account;
    });
    return NextResponse.json({ data }, { status: 201 });
  } catch { return NextResponse.json({ error: "An account with this name already exists" }, { status: 409 }); }
}
