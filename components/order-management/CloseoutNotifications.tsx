"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Alert = { id: string; businessDate: string; message: string; notes?: string; differences?: Record<string, number>; createdAt: string; closeoutId: string };
export default function CloseoutNotifications() {
  const [data, setData] = useState<Alert[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => { setLoading(true); setError(""); try { const response = await fetch("/api/order-management/closeout-notifications", { cache: "no-store" }); const result = await response.json(); if (!response.ok) throw new Error(result.error || "Could not load closeout alerts."); setData(result.data ?? []); } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load closeout alerts."); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]);
  return <main className="legacy-admin-page"><section className="legacy-admin-card"><header className="legacy-admin-title"><h1>Closeout discrepancy alerts</h1><Link href="/order-management/xisaab-xidh-cusub">Daily closeout</Link></header>{error && <p className="legacy-admin-error" role="alert">{error}</p>}<div className="legacy-admin-table-scroll"><table className="legacy-admin-table"><thead><tr><th>Business date</th><th>Alert</th><th>Differences</th><th>Notes</th><th>Created</th></tr></thead><tbody>{loading ? <tr><td colSpan={5} className="legacy-admin-empty">Loading…</td></tr> : data.length ? data.map((item) => <tr key={item.id}><td>{item.businessDate}</td><td>{item.message}</td><td>{Object.entries(item.differences ?? {}).map(([method, amount]) => `${method}: ${Number(amount).toLocaleString()}`).join(" · ")}</td><td>{item.notes || "—"}</td><td>{new Date(item.createdAt).toLocaleString()}</td></tr>) : <tr><td colSpan={5} className="legacy-admin-empty">No discrepancy alerts.</td></tr>}</tbody></table></div></section></main>;
}
