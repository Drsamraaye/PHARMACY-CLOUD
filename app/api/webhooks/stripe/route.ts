import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";

/** Verifies Stripe signatures and synchronizes subscription lifecycle events. */
export async function POST(req: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET; const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!webhookSecret || !apiKey) return NextResponse.json({ error: "Stripe webhook is not configured" }, { status: 503 });
  const signature = req.headers.get("stripe-signature"); if (!signature) return NextResponse.json({ error: "Missing Stripe signature" }, { status: 400 });
  const stripe = new Stripe(apiKey);
  let event: Stripe.Event;
  try { event = stripe.webhooks.constructEvent(await req.text(), signature, webhookSecret); }
  catch { return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 }); }
  const object = event.data.object as { id?: string; subscription?: string | { id: string }; status?: string; customer?: string | { id: string }; metadata?: Record<string, string> };
  const subscriptionId = typeof object.subscription === "string" ? object.subscription : object.subscription?.id || (event.type.startsWith("customer.subscription.") ? object.id : undefined);
  if (subscriptionId && ["invoice.paid", "customer.subscription.updated", "customer.subscription.deleted", "invoice.payment_failed"].includes(event.type)) {
    const status = event.type === "invoice.payment_failed" ? "PAST_DUE" : event.type === "customer.subscription.deleted" ? "CANCELED" : object.status === "active" || event.type === "invoice.paid" ? "ACTIVE" : object.status?.toUpperCase() || "ACTIVE";
    const existing = await prisma.subscription.findUnique({ where: { stripeSubscriptionId: subscriptionId } });
    if (existing) await prisma.subscription.update({ where: { id: existing.id }, data: { status } });
    else if (object.metadata?.tenantId && (event.type.startsWith("customer.subscription.") || event.type === "invoice.paid")) {
      await prisma.subscription.create({ data: { tenantId: object.metadata.tenantId, stripeSubscriptionId: subscriptionId, plan: object.metadata.plan || "BASIC", status } });
    }
  }
  return NextResponse.json({ received: true });
}
