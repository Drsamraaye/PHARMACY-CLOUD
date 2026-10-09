"use client";

import { useCallback, useEffect, useState } from "react";

type CashFlow = { totalIncome: number; totalExpenses: number; businessLoanPaid: number; netCashFlow: number };
type Option = { id: string; name?: string; fullName?: string };
const dateString = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const money = (value: number) => `${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`;

export default function CashFlowReport() {
  const now = new Date();
  const [from, setFrom] = useState(dateString(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [to, setTo] = useState(dateString(now));
  const [branch, setBranch] = useState("");
  const [user, setUser] = useState("");
  const [data, setData] = useState<CashFlow>({ totalIncome: 0, totalExpenses: 0, businessLoanPaid: 0, netCashFlow: 0 });
  const [branches, setBranches] = useState<Option[]>([]);
  const [users, setUsers] = useState<Option[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ from, to, branch, user });
      const response = await fetch(`/api/reports/cash-flow?${query}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Cash flow report lama soo rari karin.");
      setData(result.data ?? { totalIncome: 0, totalExpenses: 0, businessLoanPaid: 0, netCashFlow: 0 });
      setBranches(result.data?.branches ?? []);
      setUsers(result.data?.users ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Cash flow report lama soo rari karin.");
    } finally {
      setLoading(false);
    }
  }, [from, to, branch, user]);

  useEffect(() => { void load(); }, [load]);

  return <main className="cash-flow-page">
    <section className="cash-flow-card">
      <header>Cash Flow Report</header>
      <div className="cash-flow-filters">
        <label>Start Date<input type="date" value={from} onChange={event => setFrom(event.target.value)} /></label>
        <label>End Date<input type="date" value={to} onChange={event => setTo(event.target.value)} /></label>
        <label>Branch<select value={branch} onChange={event => setBranch(event.target.value)}><option value="">All</option>{branches.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>
        <label>User<select value={user} onChange={event => setUser(event.target.value)}><option value="">All</option>{users.map(option => <option key={option.id} value={option.id}>{option.fullName ?? option.name}</option>)}</select></label>
        <button type="button" onClick={() => void load()} disabled={loading}>{loading ? "Loading…" : "Filter"}</button>
      </div>
      {error && <p className="cash-flow-error" role="alert">{error}</p>}
      <div className="cash-flow-metrics" aria-live="polite">
        <article className="cash-flow-income"><h2>Total Income</h2><strong>{money(data.totalIncome)}</strong></article>
        <article className="cash-flow-expenses"><h2>Total Expenses</h2><strong>{money(data.totalExpenses)}</strong></article>
        <article className="cash-flow-loan"><h2>Business Loan Paid</h2><strong>{money(data.businessLoanPaid)}</strong></article>
        <article className="cash-flow-net"><h2>Net Cash Flow</h2><strong>{money(data.netCashFlow)}</strong></article>
      </div>
    </section>
  </main>;
}
