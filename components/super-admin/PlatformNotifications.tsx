"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Alert = { id: string; kind: string; title: string; detail: string; createdAt: string; href: string; severity: string };
type Summary = { inactivePharmacies: number; pastDueSubscriptions: number; trialsEnding: number; inactiveUsers: number };

export default function PlatformNotifications() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  async function load() { setLoading(true); setError(""); try { const response = await fetch("/api/super-admin/notifications", { cache: "no-store" }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "Could not load platform alerts"); setAlerts(payload.data.alerts); setSummary(payload.data.summary); } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load platform alerts"); } finally { setLoading(false); } }
  useEffect(() => { void load(); }, []);
  return <div className="platform-page"><header className="platform-page-heading"><div><span className="platform-eyebrow">PLATFORM HEALTH</span><h1>Notifications</h1><p>Current operational alerts generated from pharmacy and subscription status.</p></div><button className="platform-secondary-button" onClick={() => void load()} disabled={loading}>↻ Refresh</button></header>
    {error && <p className="platform-alert" role="alert">{error}</p>}
    <section className="platform-metrics platform-notification-metrics"><NoticeMetric label="Inactive pharmacies" value={loading ? "—" : summary?.inactivePharmacies ?? 0} tone="danger" /><NoticeMetric label="Past-due subscriptions" value={loading ? "—" : summary?.pastDueSubscriptions ?? 0} tone="warning" /><NoticeMetric label="Trials ending in 7 days" value={loading ? "—" : summary?.trialsEnding ?? 0} tone="info" /><NoticeMetric label="Inactive staff accounts" value={loading ? "—" : summary?.inactiveUsers ?? 0} tone="neutral" /></section>
    <section className="platform-panel"><div className="platform-panel-heading"><div><h2>Action required</h2><p>Alerts update from live account and subscription records.</p></div></div>{loading ? <div className="platform-empty">Checking platform status…</div> : alerts.length ? <div className="platform-alert-list">{alerts.map((alert) => <article className="platform-alert-row" key={alert.id}><span className={`platform-alert-icon severity-${alert.severity}`}>{alert.severity === "critical" ? "!" : alert.severity === "warning" ? "⌁" : "◇"}</span><div><strong>{alert.title}</strong><p>{alert.detail}</p></div><time>{new Date(alert.createdAt).toLocaleDateString()}</time><Link href={alert.href}>Review →</Link></article>)}</div> : <div className="platform-empty"><strong>All clear</strong><span>No inactive pharmacy, past-due subscription, or expiring trial alerts right now.</span></div>}</section>
  </div>;
}

function NoticeMetric({ label, value, tone }: { label: string; value: string | number; tone: string }) { return <article className="platform-metric"><span className={`platform-notice-indicator ${tone}`} /><span className="platform-metric-label">{label}</span><strong>{value}</strong><small>Across all pharmacies</small></article>; }
