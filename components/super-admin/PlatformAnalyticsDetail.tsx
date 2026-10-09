"use client";

import { useEffect, useState } from "react";

type Data = { tenants: number; activeTenants: number; branches: number; users: number; activeSubscriptions: number; subscriptions: Record<string, number>; onboardingTrend: { month: string; count: number }[]; planDistribution: { plan: string; count: number }[]; last30Days: { sales: number; transactions: number } };
export default function PlatformAnalyticsDetail() {
  const [data, setData] = useState<Data | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  useEffect(() => { fetch("/api/super-admin/analytics", { cache: "no-store" }).then(async (response) => { const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "Could not load analytics"); setData(payload.data); }).catch((reason) => setError(reason instanceof Error ? reason.message : "Could not load analytics")).finally(() => setLoading(false)); }, []);
  const totals = [
    ["Pharmacies", data?.tenants ?? 0, `${data?.activeTenants ?? 0} currently active`],
    ["Branches", data?.branches ?? 0, "Registered branch locations"],
    ["Platform users", data?.users ?? 0, "Across all pharmacy workspaces"],
    ["Active subscriptions", data?.activeSubscriptions ?? 0, `${data?.subscriptions.TRIALING ?? 0} trials`],
  ] as const;
  return <div className="platform-page"><header className="platform-page-heading"><div><span className="platform-eyebrow">PLATFORM INTELLIGENCE</span><h1>Analytics</h1><p>Live roll-up of pharmacy growth, user coverage and subscription status.</p></div><span className="platform-system-pill"><i /> Live database snapshot</span></header>
    {error && <p className="platform-alert" role="alert">{error}</p>}
    <section className="platform-metrics platform-analytics-metrics">{totals.map(([label, value, hint]) => <article className="platform-metric" key={label}><span className="platform-metric-label">{label}</span><strong>{loading ? "—" : value.toLocaleString()}</strong><small>{hint}</small></article>)}</section>
    <section className="platform-analytics-grid"><article className="platform-panel"><div className="platform-panel-heading"><div><h2>Pharmacy growth</h2><p>Tenants created by month · six-month window</p></div></div>{loading ? <div className="platform-empty">Loading analytics…</div> : <div className="platform-bars">{(data?.onboardingTrend ?? []).map((point) => { const max = Math.max(1, ...(data?.onboardingTrend ?? []).map((item) => item.count)); return <div className="platform-bar-item" key={point.month}><strong>{point.count}</strong><span style={{ height: `${Math.max(5, point.count / max * 150)}px` }} /><small>{point.month}</small></div>; })}</div>}</article>
      <article className="platform-panel"><div className="platform-panel-heading"><div><h2>Subscription status</h2><p>Current records in the billing history</p></div></div>{loading ? <div className="platform-empty">Loading subscriptions…</div> : <div className="platform-status-list">{Object.entries(data?.subscriptions ?? {}).sort((a, b) => b[1] - a[1]).map(([status, count]) => <div key={status}><span>{status.replaceAll("_", " ")}</span><strong>{count}</strong></div>)}{!Object.keys(data?.subscriptions ?? {}).length && <p className="platform-empty">No subscriptions recorded.</p>}</div>}</article></section>
    <section className="platform-panel"><div className="platform-panel-heading"><div><h2>Sales activity</h2><p>Pharmacy sales captured by the platform in the last 30 days. This is tenant sales volume, not SaaS subscription revenue.</p></div></div><div className="platform-activity-summary"><div><span>Recorded sales</span><strong>${(data?.last30Days.sales ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></div><div><span>Transactions</span><strong>{(data?.last30Days.transactions ?? 0).toLocaleString()}</strong></div></div></section>
  </div>;
}
