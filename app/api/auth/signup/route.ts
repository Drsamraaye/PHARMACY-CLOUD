import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";

const schema = z.object({ companyName: z.string().trim().min(2).max(120), fullName: z.string().trim().min(2).max(120), email: z.string().trim().email(), password: z.string().min(8).max(200) });

/** Creates a new tenant, its first branch and owner account, and a 14-day trial. */
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid registration details" }, { status: 400 });
  const { companyName, fullName, password } = parsed.data; const email = parsed.data.email.toLowerCase();
  const slugBase = companyName.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 45) || "pharmacy";
  const slug = `${slugBase}-${crypto.randomUUID().slice(0, 6)}`; const trialEnds = new Date(Date.now() + 14 * 86400000);
  try {
    const tenant = await prisma.$transaction(async (tx) => {
      const createdTenant = await tx.tenant.create({ data: { name: companyName, slug } });
      const branch = await tx.branch.create({ data: { tenantId: createdTenant.id, name: "Main Branch" } });
      await tx.userProfile.create({ data: { tenantId: createdTenant.id, branchId: branch.id, email, fullName, role: "OWNER", passwordHash: hashPassword(password) } });
      await tx.subscription.create({ data: { tenantId: createdTenant.id, plan: "TRIAL", status: "TRIALING", trialEnds } });
      return createdTenant;
    });
    return NextResponse.json({ data: { tenantId: tenant.id, slug: tenant.slug, trialEnds } }, { status: 201 });
  } catch (error) {
    console.error("Tenant registration failed", error);
    return NextResponse.json({ error: "Could not create your workspace. This email may already be in use." }, { status: 400 });
  }
}
