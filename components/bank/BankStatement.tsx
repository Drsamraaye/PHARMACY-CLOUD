"use client";

import { FormEvent, useEffect, useState } from "react";

type Option = { id: string; name: string; fullName?: string; currency?: string };
type Filters = { userId: string; branchId: string; accountId: string; from: string; to: string };
type Row = { id: string; date: string; transactionId: string; user: string; account: string; description: string; openingBalance: number; withdrawals: number; deposits: number; balance: number; currency: string; branchId: string | null };
type Totals = { withdrawals: number; deposits: number; balance: number };

function monthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const localDate = (date: Date) => date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
  return { from: localDate(start), to: localDate(end) };
}

const amount = (value: number, currency: string) => currency + " " + value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function BankStatement() {
  const [filters, setFilters] = useState<Filters>({ userId: "", branchId: "", accountId: "", ...monthRange() });
  const [rows, setRows] = useState<Row[]>([]);
  const [users, setUsers] = useState<Option[]>([]);
  const [branches, setBranches] = useState<Option[]>([]);
  const [accounts, setAccounts] = useState<Option[]>([]);
  const [totals, setTotals] = useState<Totals>({ withdrawals: 0, deposits: 0, balance: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load(event?: FormEvent) {
    event?.preventDefault();
    setLoading(true); setError("");
    try {
      const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
      const response = await fetch("/api/bank/statement?" + query, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Bank statement lama soo rari karin.");
      setRows(result.data ?? []); setUsers(result.users ?? []); setBranches(result.branches ?? []); setAccounts(result.accounts ?? []);
      setTotals(result.totals ?? { withdrawals: 0, deposits: 0, balance: 0 });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Bank statement lama soo rari karin."); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    let active = true;
    const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
    fetch("/api/bank/statement?" + query, { cache: "no-store" }).then(async response => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Bank statement lama soo rari karin.");
      if (active) { setRows(result.data ?? []); setUsers(result.users ?? []); setBranches(result.branches ?? []); setAccounts(result.accounts ?? []); setTotals(result.totals ?? { withdrawals: 0, deposits: 0, balance: 0 }); }
    }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "Bank statement lama soo rari karin."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const update = (key: keyof Filters, value: string) => setFilters(current => ({ ...current, [key]: value }));
  const currency = accounts.find(account => account.id === filters.accountId)?.currency ?? accounts[0]?.currency ?? "USD";
  return <main className="bank-statement-page"><section className="bank-statement-card">
    <header><h1>Bank Statement</h1></header>
    <form className="bank-statement-filters" onSubmit={load}>
      <label>User<select value={filters.userId} onChange={event => update("userId", event.target.value)}><option value="">All</option>{users.map(user => <option key={user.id} value={user.id}>{user.fullName ?? user.name}</option>)}</select></label>
      <label>Branch<select value={filters.branchId} onChange={event => update("branchId", event.target.value)}><option value="">All</option>{branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
      <label>Bank Account<select value={filters.accountId} onChange={event => update("accountId", event.target.value)}><option value="">All</option>{accounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
      <label>Start Date *<input required type="date" value={filters.from} onChange={event => update("from", event.target.value)} /></label>
      <label>End Date *<input required type="date" value={filters.to} onChange={event => update("to", event.target.value)} /></label>
      <button type="submit" disabled={loading}>{loading ? "Searching…" : "Search"}</button>
      <button type="button" className="bank-statement-print" onClick={() => window.print()}>Print</button>
    </form>
    {error && <p className="bank-statement-error" role="alert">{error}</p>}
    <div className="bank-statement-table-wrap"><table><thead><tr><th>SL</th><th>Date</th><th>T.ID</th><th>User</th><th>Account</th><th>Desc</th><th>Opening Balance</th><th>Withdrawals</th><th>Deposits</th><th>Balance</th><th>Action</th></tr></thead><tbody>
      {loading ? <tr><td colSpan={11} className="bank-statement-empty">Loading…</td></tr> : <>
        {rows.length ? rows.map((row, index) => <tr key={row.id}><td>{index + 1}</td><td>{new Date(row.date).toLocaleString()}</td><td>{row.transactionId}</td><td>{row.user}</td><td>{row.account}</td><td>{row.description}</td><td>{amount(row.openingBalance, row.currency)}</td><td>{row.withdrawals ? amount(row.withdrawals, row.currency) : "—"}</td><td>{row.deposits ? amount(row.deposits, row.currency) : "—"}</td><td>{amount(row.balance, row.currency)}</td><td>—</td></tr>) : <tr><td colSpan={7} className="bank-statement-empty">No transactions in selected date range.</td><td>{amount(0, currency)}</td><td>{amount(0, currency)}</td><td>{amount(totals.balance, currency)}</td><td /></tr>}
        <tr className="bank-statement-total"><td colSpan={7}>Total</td><td>{amount(totals.withdrawals, currency)}</td><td>{amount(totals.deposits, currency)}</td><td>{amount(totals.balance, currency)}</td><td /></tr>
      </>}
    </tbody></table></div>
  </section></main>;
}
