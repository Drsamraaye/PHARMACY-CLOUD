"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Subscription = { id: string; tenantId: string; plan: string; status: string; createdAt: string; tenant: { name: string; slug: string } };
const plans = ["TRIAL", "BASIC", "PRO", "ENTERPRISE"];

export default function PlatformPlans() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => { fetch("/api/super-admin/subscriptions", { cache: "no-store" }).then(async (response) => { const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "Could not load plan assignments"); setSubscriptions(payload.data); }).catch((reason) => setError(reason instanceof Error ? reason.message : "Could not load plan assignments")).finally(() => setLoading(false)); }, []);
  const latestByTenant = new Map<string, Subscription>();
  [...subscriptions].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).forEach((item) => { if (!latestByTenant.has(item.tenantId)) latestByTenant.set(item.tenantId, item); });
  return <div className="platform-page"><header className="platform-page-heading"><div><span className="platform-eyebrow">BILLING CATALOG</span><h1>Plans</h1><p>See the latest plan assigned to each pharmacy. Pricing and feature entitlements are not configured in the current platform catalog.</p></div><Link className="platform-primary-link" href="/subscriptions">Manage subscriptions →</Link></header>
    {error && <p className="platform-alert" role="alert">{error}</p>}
    <section className="platform-plan-cards">{plans.map((plan) => { const count = [...latestByTenant.values()].filter((subscription) => subscription.plan === plan).length; const active = [...latestByTenant.values()].filter((subscription) => subscription.plan === plan && ["ACTIVE", "TRIALING"].includes(subscription.status)).length; return <article className="platform-panel platform-plan-card" key={plan}><span className="platform-plan-pill">{plan}</span><strong>{loading ? "—" : count}</strong><span>pharmacies on this plan</span><small>{loading ? "Loading" : `${active} active or trialing`}</small></article>; })}</section>
    <section className="platform-panel"><div className="platform-panel-heading"><div><h2>Current plan assignments</h2><p>One latest plan per pharmacy · {loading ? "…" : latestByTenant.size} pharmacies</p></div><Link className="platform-panel-action" href="/subscriptions">Subscription history →</Link></div>{loading ? <div className="platform-empty">Loading plan assignments…</div> : !latestByTenant.size ? <div className="platform-empty"><strong>No plan assignments yet</strong><span>Provision a pharmacy and assign a plan to see it here.</span></div> : <div className="platform-table-wrap"><table className="platform-table"><thead><tr><th>Plan</th><th>Pharmacy</th><th>Status</th><th>Assigned</th><th>Action</th></tr></thead><tbody>{[...latestByTenant.values()].map((sub) => <tr key={sub.id}><td><span className={`platform-plan-pill plan-${sub.plan.toLowerCase()}`}>{sub.plan}</span></td><td><strong>{sub.tenant.name}</strong><small>{sub.tenant.slug}</small></td><td>{sub.status}</td><td>{new Date(sub.createdAt).toLocaleDateString()}</td><td><Link className="platform-inline-link" href="/subscriptions">Manage</Link></td></tr>)}</tbody></table></div>}</section>
  </div>;
}
