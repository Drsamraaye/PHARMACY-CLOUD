"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Bill = {
  id: string;
  invoiceNo?: string | null;
  createdAt: string;
  total: number | string;
  paidAmount: number | string;
  discount: number | string;
  balance: number;
  status: string;
  notes?: string | null;
  supplier?: { id: string; name: string; phone?: string | null } | null;
  branch?: { id: string; name: string } | null;
};

const money = (value: number) => value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function SupplierBillReport() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (term: string) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (term.trim()) params.set("search", term.trim());
      const response = await fetch(`/api/purchase/bill-report${params.size ? `?${params}` : ""}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not load supplier bills");
      setBills(result.data ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load supplier bills");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(""); }, [load]);

  const totals = useMemo(() => bills.reduce((sum, bill) => ({
    total: sum.total + Number(bill.total),
    paid: sum.paid + Number(bill.paidAmount),
    balance: sum.balance + Number(bill.balance),
  }), { total: 0, paid: 0, balance: 0 }), [bills]);

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void load(query);
  }

  return <main className="supplier-report-page">
    <section className="supplier-report-card">
      <header className="supplier-report-header">
        <div><span className="supplier-report-eyebrow">PURCHASES</span><h1>Supplier bill report</h1><p>Review unpaid and partially paid supplier invoices.</p></div>
        <button type="button" className="supplier-report-refresh" onClick={() => void load(query)} disabled={loading}>{loading ? "Refreshing…" : "Refresh"}</button>
      </header>

      <form className="supplier-report-toolbar" onSubmit={submitSearch}>
        <label htmlFor="supplier-bill-search">Search invoices</label>
        <input id="supplier-bill-search" placeholder="Supplier name, invoice number or notes" value={query} onChange={(event) => setQuery(event.target.value)} />
        <button type="submit" disabled={loading}>{loading ? "Searching…" : "Search"}</button>
      </form>

      <div className="supplier-report-metrics">
        <article><span>Open invoices</span><strong>{bills.length}</strong></article>
        <article><span>Total billed</span><strong>{money(totals.total)}</strong></article>
        <article><span>Total paid</span><strong>{money(totals.paid)}</strong></article>
        <article className="is-balance"><span>Outstanding balance</span><strong>{money(totals.balance)}</strong></article>
      </div>

      {error && <p className="supplier-report-error" role="alert">{error}</p>}
      <div className="supplier-report-table-wrap"><table className="supplier-report-table">
        <thead><tr><th>#</th><th>Date</th><th>Supplier</th><th>Branch</th><th>Invoice</th><th>Total</th><th>Paid</th><th>Discount</th><th>Balance</th><th>Status</th></tr></thead>
        <tbody>
          {loading ? <tr><td colSpan={10} className="supplier-report-empty">Loading supplier bills…</td></tr> : bills.length === 0 ? <tr><td colSpan={10} className="supplier-report-empty">No open supplier bills found.</td></tr> : bills.map((bill, index) => <tr key={bill.id}>
            <td>{index + 1}</td><td>{new Date(bill.createdAt).toLocaleDateString()}</td><td><strong>{bill.supplier?.name ?? "Unknown supplier"}</strong>{bill.supplier?.phone && <small>{bill.supplier.phone}</small>}</td><td>{bill.branch?.name ?? "—"}</td><td>{bill.invoiceNo || "—"}</td><td>{money(Number(bill.total))}</td><td>{money(Number(bill.paidAmount))}</td><td>{money(Number(bill.discount))}</td><td><strong className="supplier-report-balance">{money(Number(bill.balance))}</strong></td><td><span className={`supplier-report-status ${bill.status.toLowerCase()}`}>{bill.status === "PARTIAL" ? "Partial" : "Unpaid"}</span></td>
          </tr>)}
        </tbody>
        {!loading && bills.length > 0 && <tfoot><tr><th colSpan={5}>Totals</th><th>{money(totals.total)}</th><th>{money(totals.paid)}</th><th>—</th><th>{money(totals.balance)}</th><th></th></tr></tfoot>}
      </table></div>
    </section>
  </main>;
}
