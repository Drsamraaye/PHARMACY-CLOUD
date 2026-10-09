import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Applies a deposit or withdrawal and records its immutable ledger entry. */
export async function moveBankFunds(req: NextRequest, type: "DEPOSIT" | "WITHDRAWAL") {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = z.object({ accountId: z.string(), amount: z.coerce.number().positive(), description: z.string().optional(), reference: z.string().optional(), date: z.string().date().optional() }).safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Account and a positive amount are required" }, { status: 400 });
  try {
    const data = await prisma.$transaction(async (tx) => {
      const where = { id: parsed.data.accountId, tenantId: session.tenantId, isActive: true, ...(session.branchId ? { branchId: session.branchId } : {}), ...(type === "WITHDRAWAL" ? { balance: { gte: parsed.data.amount } } : {}) };
      const changed = await tx.bankAccount.updateMany({ where, data: { balance: type === "DEPOSIT" ? { increment: parsed.data.amount } : { decrement: parsed.data.amount } } });
      if (!changed.count) throw new Error(type === "WITHDRAWAL" ? "Account not found or insufficient balance" : "Account not found");
      const entry = await tx.bankTransaction.create({ data: { tenantId: session.tenantId, bankAccountId: parsed.data.accountId, type, amount: parsed.data.amount, description: parsed.data.description, reference: parsed.data.reference, ...(parsed.data.date ? { createdAt: new Date(`${parsed.data.date}T00:00:00.000Z`) } : {}), createdBy: session.userId } });
      return { entry, account: await tx.bankAccount.findUnique({ where: { id: parsed.data.accountId } }) };
    }, { isolationLevel: "Serializable" });
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Transaction failed" }, { status: 400 }); }
}
