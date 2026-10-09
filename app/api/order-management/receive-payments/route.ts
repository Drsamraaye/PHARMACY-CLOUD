import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Records a customer receipt and applies it to oldest outstanding sales first. */
export async function POST(req: NextRequest) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = z.object({ patientId: z.string().min(1), amount: z.coerce.number().positive(), paymentMethod: z.string().optional(), accountId: z.string().optional(), branchId: z.string().optional() }).safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Patient and a positive payment amount are required" }, { status: 400 });
  const branchId = session.role === "OWNER" || session.role === "ADMIN" ? (parsed.data.branchId || session.branchId || undefined) : (session.branchId || undefined);
  try {
    const receipt = await prisma.$transaction(async (tx) => {
      const patient = await tx.patient.findFirst({ where: { id: parsed.data.patientId, tenantId: session.tenantId, deletedAt: null }, select: { id: true } });
      if (!patient) throw new Error("Patient not found");
      const sales = await tx.sale.findMany({ where: { tenantId: session.tenantId, patientId: patient.id, status: { not: "VOID" }, ...(branchId ? { branchId } : {}) }, orderBy: { createdAt: "asc" } });
      let remaining = parsed.data.amount; const due = sales.reduce((sum, sale) => sum + Math.max(0, Number(sale.total) - Number(sale.paidAmount)), 0);
      if (remaining > due) throw new Error("Payment exceeds the outstanding balance");
      for (const sale of sales) {
        if (remaining <= 0) break;
        const outstanding = Math.max(0, Number(sale.total) - Number(sale.paidAmount)); if (!outstanding) continue;
        const applied = Math.min(remaining, outstanding); const paidAmount = Number(sale.paidAmount) + applied;
        const update = await tx.sale.updateMany({ where: { id: sale.id, tenantId: session.tenantId, paidAmount: sale.paidAmount }, data: { paidAmount, status: paidAmount >= Number(sale.total) ? "PAID" : "PARTIAL" } });
        if (!update.count) throw new Error("The balance changed during payment. Please retry.");
        remaining = Math.round((remaining - applied) * 100) / 100;
      }
      const record = { patientId: patient.id, amount: parsed.data.amount, paymentMethod: parsed.data.paymentMethod || null, accountId: parsed.data.accountId || null, userId: session.userId };
      return tx.moduleRecord.create({ data: { tenantId: session.tenantId, branchId, collection: "customer-receipts", record, createdBy: session.userId } });
    }, { isolationLevel: "Serializable" });
    return NextResponse.json({ data: { id: receipt.id, ...receipt.record as object } }, { status: 201 });
  } catch (error) { const message = error instanceof Error ? error.message : "Payment could not be recorded"; return NextResponse.json({ error: message }, { status: 400 }); }
}
