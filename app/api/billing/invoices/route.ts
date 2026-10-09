import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Retrieves recent invoice history for the current Stripe customer. */
export async function GET(req: NextRequest) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tenant = await prisma.tenant.findUnique({ where: { id: session.tenantId }, select: { stripeCustomerId: true } });
  if (!tenant?.stripeCustomerId) return NextResponse.json({ data: [] });
  if (!process.env.STRIPE_SECRET_KEY) return NextResponse.json({ error: "Stripe billing is not configured" }, { status: 503 });
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const invoices = await stripe.invoices.list({ customer: tenant.stripeCustomerId, limit: 100 });
  return NextResponse.json({ data: invoices.data.map((invoice) => ({ id: invoice.id, number: invoice.number, status: invoice.status, amountDue: invoice.amount_due / 100, amountPaid: invoice.amount_paid / 100, currency: invoice.currency, hostedInvoiceUrl: invoice.hosted_invoice_url, createdAt: new Date(invoice.created * 1000) })) });
}
