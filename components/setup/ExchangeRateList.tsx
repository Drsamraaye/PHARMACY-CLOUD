"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";

type Rate = { id: string; newRate: number; updatedAt: string; updatedBy: string; branch: string };
const format = (value: number) => Number(value).toLocaleString(undefined, { maximumFractionDigits: 6 });

export default function ExchangeRateList() {
  const [rate, setRate] = useState("");
  const [record, setRecord] = useState<Rate | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/setup/exchange-rate", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Exchange rate lama soo rari karin.");
      const latest = result.history?.[0] ?? null;
      setRecord(latest);
      setRate(result.currentRate == null ? "" : String(result.currentRate));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Exchange rate lama soo rari karin.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function saveRate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/setup/exchange-rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rate: Number(rate) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Exchange rate lama kaydin karin.");
      setNotice("Exchange rate-ka waa la kaydiyey.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Exchange rate lama kaydin karin.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="legacy-admin-page">
    <section className="legacy-admin-card">
      <header className="legacy-admin-title"><h1>Exchange Rate</h1></header>
      <form className="exchange-rate-quick-form" onSubmit={saveRate}>
        <label htmlFor="today-exchange-rate">Today Rate</label>
        <div className="exchange-rate-quick-controls">
          <input id="today-exchange-rate" type="number" min="0.000001" step="any" required value={rate} onChange={event => setRate(event.target.value)} placeholder="Enter today rate" disabled={loading} />
          <button type="submit" disabled={loading || busy}>{busy ? "Saving…" : "Save Rate"}</button>
          <Link href="/setup/exchange-rate/history">Historical Rates</Link>
        </div>
        <p className="exchange-rate-help">Geli rate-ka cusub; qiimihii hore waxaa lagu kaydinayaa taariikhda.</p>
        {error && <p className="legacy-admin-error" role="alert">{error}</p>}
        {notice && <p className="exchange-rate-success" role="status">{notice}</p>}
      </form>
      <div className="legacy-admin-table-scroll exchange-rate-list-table">
        <table className="legacy-admin-table">
          <thead><tr><th>#</th><th>Today Rate</th><th>Action</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={3} className="legacy-admin-empty">Loading…</td></tr>
              : record ? <tr><td>1</td><td>{format(record.newRate)}</td><td><Link className="legacy-btn-blue exchange-link" href="/setup/exchange-rate/edit">Edit</Link><Link className="legacy-btn-red exchange-link" href="/setup/exchange-rate/history">Historical Rates</Link></td></tr>
                : <tr><td colSpan={3} className="legacy-admin-empty">No exchange rate has been set yet. Enter a rate above.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  </main>;
}
