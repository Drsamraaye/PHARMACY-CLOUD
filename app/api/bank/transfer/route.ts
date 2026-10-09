import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = z.object({ fromAccountId: z.string(), toAccountId: z.string(), amount: z.coerce.number().positive() }).safeParse(await req.json());
  if (!parsed.success || parsed.data.fromAccountId === parsed.data.toAccountId) return NextResponse.json({ error: "Choose two different accounts and a positive amount" }, { status: 400 });
  try {
    const result = await prisma.$transaction(async tx => {
      const where = { tenantId: session.tenantId, isActive: true, ...(session.branchId ? { branchId: session.branchId } : {}) };
      const [from,to] = await Promise.all([tx.bankAccount.findFirst({ where: { ...where, id: parsed.data.fromAccountId } }), tx.bankAccount.findFirst({ where: { ...where, id: parsed.data.toAccountId } })]);
      if (!from || !to) throw new Error("Account not found");
      if (from.currency !== to.currency) throw new Error("Accounts must use the same currency for transfers");
      const updated = await tx.bankAccount.updateMany({ where: { ...where, id: from.id, balance: { gte: parsed.data.amount } }, data: { balance: { decrement: parsed.data.amount } } });
      if (!updated.count) throw new Error("Insufficient account balance");
      await tx.bankAccount.update({ where: { id: to.id }, data: { balance: { increment: parsed.data.amount } } });
      await tx.bankTransaction.createMany({ data: [
        { tenantId: session.tenantId, bankAccountId: from.id, type: "TRANSFER_OUT", amount: parsed.data.amount, description: `Transfer to ${to.name}`, reference: to.id, createdBy: session.userId },
        { tenantId: session.tenantId, bankAccountId: to.id, type: "TRANSFER_IN", amount: parsed.data.amount, description: `Transfer from ${from.name}`, reference: from.id, createdBy: session.userId },
      ] });
      return { from: await tx.bankAccount.findUnique({ where: { id: from.id } }), to: await tx.bankAccount.findUnique({ where: { id: to.id } }) };
    }, { isolationLevel: "Serializable" });
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (cause) { return NextResponse.json({ error: cause instanceof Error ? cause.message : "Transfer failed" }, { status: 400 }); }
}
