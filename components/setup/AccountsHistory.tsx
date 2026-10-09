"use client";

import { FormEvent, useEffect, useState } from "react";

type AccountOption = { id: string; name: string };
type ChartAccountOption = { id: string; name: string };
type HistoryRow = { id: string; date: string; fromAccount: string; fromBank: string; toAccount: string; toBank: string; user: string; amount: string; currency: string; type: string; description?: string | null };
type Filters = { fromDate: string; toDate: string; fromAccountId: string; toAccountId: string; fromBankId: string; toBankId: string };
const blankFilters: Filters = { fromDate: "", toDate: "", fromAccountId: "", toAccountId: "", fromBankId: "", toBankId: "" };

export default function AccountsHistory() {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [chartAccounts, setChartAccounts] = useState<ChartAccountOption[]>([]);
  const [filters, setFilters] = useState<Filters>(blankFilters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function search(event?: FormEvent) {
    event?.preventDefault();
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
      const response = await fetch(`/api/setup/accounts/history?${params}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Accounts history lama soo rari karin.");
      setRows(result.data ?? []); setAccounts(result.accounts ?? []); setChartAccounts(result.chartAccounts ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Accounts history lama soo rari karin.");
    } finally { setLoading(false); }
  }

  useEffect(() => {
    let active = true;
    fetch("/api/setup/accounts/history", { cache: "no-store" }).then(async response => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Accounts history lama soo rari karin.");
      if (active) { setRows(result.data ?? []); setAccounts(result.accounts ?? []); setChartAccounts(result.chartAccounts ?? []); }
    }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "Accounts history lama soo rari karin."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const update = (key: keyof Filters, value: string) => setFilters(current => ({ ...current, [key]: value }));

  return <main className="accounts-history-page">
    <section className="accounts-history-card">
      <header><h1>Accounts History</h1></header>
      <form className="accounts-history-filters" onSubmit={search}>
        <label>Start Date<input type="date" value={filters.fromDate} onChange={event => update("fromDate", event.target.value)} /></label>
        <label>End Date<input type="date" value={filters.toDate} onChange={event => update("toDate", event.target.value)} /></label>
        <label>From Account<select value={filters.fromAccountId} onChange={event => update("fromAccountId", event.target.value)}><option value="">-- All --</option>{chartAccounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
        <label>To Account<select value={filters.toAccountId} onChange={event => update("toAccountId", event.target.value)}><option value="">-- All --</option>{chartAccounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
        <label>From Bank Account<select value={filters.fromBankId} onChange={event => update("fromBankId", event.target.value)}><option value="">-- All --</option>{accounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
        <label>To Bank Account<select value={filters.toBankId} onChange={event => update("toBankId", event.target.value)}><option value="">-- All --</option>{accounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
        <button type="submit" disabled={loading}>{loading ? "Searching…" : "Search"}</button>
      </form>
      {error && <p className="accounts-history-error" role="alert">{error}</p>}
      <div className="accounts-history-table-wrap"><table><thead><tr><th>#</th><th>Date</th><th>From Account</th><th>From Bank</th><th>To Account</th><th>To Bank</th><th>User</th><th>Amount</th></tr></thead><tbody>
        {loading ? <tr><td colSpan={8} className="accounts-history-empty">Loading…</td></tr>
          : rows.length ? rows.map((row, index) => <tr key={row.id}><td>{index + 1}</td><td>{new Date(row.date).toLocaleString()}</td><td>{row.fromAccount}</td><td>{row.fromBank}</td><td>{row.toAccount}</td><td>{row.toBank}</td><td>{row.user}</td><td>{row.currency} {Number(row.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td></tr>)
            : <tr><td colSpan={8} className="accounts-history-empty">No account transactions found for these filters.</td></tr>}
      </tbody></table></div>
    </section>
  </main>;
}
