import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Returns the current tenant plan and trial or billing status. */
export async function GET(req: NextRequest) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [tenant, subscription] = await Promise.all([prisma.tenant.findUnique({ where: { id: session.tenantId }, select: { id: true, name: true, stripeCustomerId: true } }), prisma.subscription.findFirst({ where: { tenantId: session.tenantId }, orderBy: { createdAt: "desc" } })]);
  return NextResponse.json({ data: { tenant, subscription } });
}

/** Starts a Stripe Checkout subscription session for a configured plan. */
export async function PUT(req: NextRequest) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = z.object({ plan: z.enum(["BASIC", "PRO"]) }).safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Choose a valid subscription plan" }, { status: 400 });
  const secret = process.env.STRIPE_SECRET_KEY; const price = parsed.data.plan === "BASIC" ? process.env.STRIPE_PRICE_BASIC : process.env.STRIPE_PRICE_PRO;
  if (!secret || !price) return NextResponse.json({ error: "Stripe billing is not fully configured" }, { status: 503 });
  const stripe = new Stripe(secret);
  const tenant = await prisma.tenant.findUnique({ where: { id: session.tenantId } }); if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  let customerId = tenant.stripeCustomerId;
  if (!customerId) { const customer = await stripe.customers.create({ name: tenant.name, email: session.email, metadata: { tenantId: tenant.id } }); customerId = customer.id; await prisma.tenant.update({ where: { id: tenant.id }, data: { stripeCustomerId: customerId } }); }
  const origin = req.nextUrl.origin;
  const checkout = await stripe.checkout.sessions.create({ mode: "subscription", customer: customerId, line_items: [{ price, quantity: 1 }], success_url: `${origin}/setup/branches?billing=success`, cancel_url: `${origin}/setup/branches?billing=cancelled`, subscription_data: { metadata: { tenantId: tenant.id, plan: parsed.data.plan } }, metadata: { tenantId: tenant.id, plan: parsed.data.plan } });
  return NextResponse.json({ data: { checkoutUrl: checkout.url } });
}
