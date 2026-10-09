"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type TrendPoint = { month: string; count: number };
type Tenant = { id: string; name: string; slug: string; isActive: boolean; createdAt: string; _count: { users: number; branches: number }; subscriptions: { plan: string; status: string; trialEnds: string | null }[] };
type Overview = { tenants: number; activeTenants: number; users: number; branches: number; activeSubscriptions: number; subscriptions: Record<string, number>; planDistribution: { plan: string; count: number }[]; onboardingTrend: TrendPoint[]; pharmacies: Tenant[]; last30Days: { sales: number; transactions: number } };

export default function PlatformDashboard() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await fetch("/api/super-admin/analytics", { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Could not load platform overview");
        if (active) { setOverview(payload.data); setError(""); }
      } catch (reason) { if (active) setError(reason instanceof Error ? reason.message : "Could not load platform overview"); }
      finally { if (active) setLoading(false); }
    }
    void load();
    const minutes = Number(window.localStorage.getItem("pharmacloud-platform-refresh-minutes") || 0);
    const timer = minutes > 0 ? window.setInterval(() => void load(), minutes * 60_000) : undefined;
    return () => { active = false; if (timer) window.clearInterval(timer); };
  }, []);

  const planSegments = useMemo(() => {
    const rows = overview?.planDistribution ?? [];
    const total = rows.reduce((sum, row) => sum + row.count, 0);
    let cursor = 0;
    const colors = ["#2363ed", "#5359db", "#132640", "#a7b9dc", "#29b99a"];
    return rows.map((row, index) => {
      const from = cursor; cursor += total ? row.count / total * 100 : 0;
      return { ...row, color: colors[index % colors.length], from, to: cursor, percent: total ? Math.round(row.count / total * 100) : 0 };
    });
  }, [overview]);

  function exportReport() {
    if (!overview) return;
    const lines = [["Pharmacy", "Slug", "Users", "Branches", "Plan", "Subscription", "Status", "Created"], ...overview.pharmacies.map((tenant) => [tenant.name, tenant.slug, tenant._count.users, tenant._count.branches, tenant.subscriptions[0]?.plan ?? "—", tenant.subscriptions[0]?.status ?? "—", tenant.isActive ? "Active" : "Inactive", new Date(tenant.createdAt).toLocaleDateString()])];
    const csv = lines.map((line) => line.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "pharmacloud-platform-report.csv"; anchor.click(); URL.revokeObjectURL(url);
  }

  const revenue = overview?.last30Days.sales ?? 0;
  return <div className="platform-page platform-dashboard-page">
    <header className="platform-page-heading platform-dashboard-heading"><div><div className="platform-heading-kicker"><span className="platform-eyebrow">PLATFORM OVERVIEW</span><span className="platform-live-badge"><i /> Live platform data</span></div><h1>Dashboard</h1><p>Monitor your pharmacy network, subscriptions and pharmacy sales across the platform.</p></div><div className="platform-heading-actions"><span className="platform-system-pill"><i /> Platform data connected</span><button className="platform-secondary-button" onClick={exportReport} disabled={!overview}>⇩ Export report</button><Link href="/tenants" className="platform-primary-link">＋ New pharmacy</Link></div></header>
    {error && <p className="platform-alert" role="alert">{error}</p>}
    <section className="platform-metrics platform-dashboard-metrics" aria-label="Platform metrics">
      <Metric label="Total pharmacies" value={loading ? "—" : overview?.tenants ?? 0} hint={`${overview?.activeTenants ?? 0} active workspaces`} icon="▦" tone="blue" />
      <Metric label="Active subscriptions" value={loading ? "—" : overview?.activeSubscriptions ?? 0} hint={`${overview?.subscriptions.TRIALING ?? 0} currently in trial`} icon="▤" tone="violet" />
      <Metric label="Sales · last 30 days" value={loading ? "—" : `$${revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} hint={`${overview?.last30Days.transactions ?? 0} pharmacy transactions`} icon="＄" tone="teal" />
      <Metric label="Platform users" value={loading ? "—" : overview?.users ?? 0} hint={`${overview?.branches ?? 0} branches across pharmacies`} icon="♙" tone="amber" />
    </section>
    <section className="platform-dashboard-charts">
      <article className="platform-panel platform-chart-panel"><div className="platform-panel-heading"><div><h2>Pharmacy onboarding</h2><p>New pharmacy workspaces created in the last six months</p></div><span className="platform-chart-tag">6 MONTHS</span></div>{loading ? <div className="platform-chart-loading">Loading platform data…</div> : <OnboardingChart points={overview?.onboardingTrend ?? []} />}</article>
      <article className="platform-panel platform-plan-panel"><div className="platform-panel-heading"><div><h2>Subscription distribution</h2><p>Latest plan assigned to each pharmacy</p></div><Link href="/plans" className="platform-panel-action">Plans →</Link></div>{loading ? <div className="platform-chart-loading">Loading plans…</div> : <><div className="platform-donut-row"><div className="platform-donut" style={{ background: planSegments.length ? `conic-gradient(${planSegments.map((item) => `${item.color} ${item.from}% ${item.to}%`).join(",")})` : "#e7edf6" }}><div><strong>{overview?.tenants ?? 0}</strong><span>pharmacies</span></div></div></div><div className="platform-plan-legend">{planSegments.length ? planSegments.map((segment) => <div className="platform-plan-legend-row" key={segment.plan}><span><i style={{ background: segment.color }} />{segment.plan}</span><strong>{segment.count}<small>{segment.percent}%</small></strong></div>) : <p>No subscription records found.</p>}</div></>}</article>
    </section>
    <section className="platform-panel platform-workspaces-panel"><div className="platform-panel-heading"><div><h2>Pharmacy workspaces</h2><p>Recently created pharmacy tenants and their current access status</p></div><Link href="/tenants" className="platform-panel-action">All pharmacies →</Link></div>{loading ? <div className="platform-empty">Loading pharmacy workspaces…</div> : !overview?.pharmacies.length ? <div className="platform-empty"><strong>No pharmacies yet</strong><span>Create the first workspace to get started.</span><Link href="/tenants" className="platform-primary-link">Create pharmacy</Link></div> : <div className="platform-table-wrap"><table className="platform-table"><thead><tr><th>Pharmacy</th><th>Users</th><th>Branches</th><th>Subscription</th><th>Status</th><th>Added</th></tr></thead><tbody>{overview.pharmacies.map((tenant) => { const sub = tenant.subscriptions[0]; return <tr key={tenant.id}><td><strong>{tenant.name}</strong><small>{tenant.slug}</small></td><td>{tenant._count.users}</td><td>{tenant._count.branches}</td><td>{sub ? <><strong>{sub.plan}</strong><small>{sub.status}</small></> : "No plan"}</td><td><StatusPill active={tenant.isActive} /></td><td>{new Date(tenant.createdAt).toLocaleDateString()}</td></tr>; })}</tbody></table></div>}</section>
  </div>;
}

function Metric({ label, value, hint, icon, tone }: { label: string; value: string | number; hint: string; icon: string; tone: string }) {
  return <article className="platform-metric"><span className={`platform-metric-icon tone-${tone}`}>{icon}</span><span className="platform-metric-label">{label}</span><strong>{value}</strong><small>{hint}</small></article>;
}

function OnboardingChart({ points }: { points: TrendPoint[] }) {
  const max = Math.max(1, ...points.map((point) => point.count));
  const coords = points.map((point, index) => ({ x: points.length < 2 ? 50 : 30 + index * 540 / (points.length - 1), y: 190 - point.count / max * 148 }));
  const path = coords.map((point, index) => `${index ? "L" : "M"}${point.x},${point.y}`).join(" ");
  const area = coords.length ? `${path} L${coords.at(-1)?.x},205 L${coords[0].x},205 Z` : "";
  return <div className="platform-chart-wrap"><svg viewBox="0 0 600 235" role="img" aria-label="Pharmacy onboarding over the last six months" className="platform-onboarding-chart"><defs><linearGradient id="platform-chart-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#2463ed" stopOpacity=".18" /><stop offset="100%" stopColor="#2463ed" stopOpacity="0" /></linearGradient></defs>{[45, 95, 145, 195].map((y) => <line key={y} x1="30" x2="570" y1={y} y2={y} className="platform-chart-gridline" />)}{[0, .33, .66, 1].map((fraction) => <text key={fraction} x="2" y={198 - fraction * 150} className="platform-chart-axis">{Math.round(max * fraction)}</text>)}<path d={area} fill="url(#platform-chart-fill)" /><path d={path} className="platform-chart-line" />{coords.map((point, index) => <g key={index}><circle cx={point.x} cy={point.y} r="5" className="platform-chart-dot" /><text x={point.x} y="225" textAnchor="middle" className="platform-chart-month">{points[index].month}</text></g>)}</svg><div className="platform-chart-caption"><span><i />New pharmacy workspaces</span><strong>{points.reduce((sum, point) => sum + point.count, 0)} in 6 months</strong></div></div>;
}

function StatusPill({ active }: { active: boolean }) {
  return <span className={`platform-status ${active ? "is-active" : "is-inactive"}`}><i />{active ? "Active" : "Inactive"}</span>;
}
