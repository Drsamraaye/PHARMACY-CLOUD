"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type ProductRow = { productId: string; name: string; type: string; quantity: number; sales: number; cost: number; profit: number; transactions: number };
type Branch = { id: string; name: string };
const dateString = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const money = (value: number) => value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function TopProductsReport() {
  const now = new Date();
  const [from, setFrom] = useState(dateString(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [to, setTo] = useState(dateString(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
  const [branchId, setBranchId] = useState("");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ from, to, branchId, search });
      const response = await fetch(`/api/reports/top-products?${query}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Top selling products lama soo rari karin.");
      setRows(result.data ?? []);
      setBranches(result.options?.branches ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Top selling products lama soo rari karin.");
    } finally {
      setLoading(false);
    }
  }, [from, to, branchId, search]);

  useEffect(() => { void load(); }, [load]);
  const totals = useMemo(() => rows.reduce((sum, row) => ({ quantity: sum.quantity + row.quantity, sales: sum.sales + row.sales, cost: sum.cost + row.cost, profit: sum.profit + row.profit }), { quantity: 0, sales: 0, cost: 0, profit: 0 }), [rows]);

  return <main className="top-products-page"><section className="top-products-card">
    <header>Top Selling Products</header>
    <div className="top-products-filters">
      <label>Search<input type="search" placeholder="Magaca..." value={search} onChange={event => setSearch(event.target.value)} /></label>
      <label>Date Range<div><input aria-label="Start date" type="date" value={from} onChange={event => setFrom(event.target.value)} /><span>to</span><input aria-label="End date" type="date" value={to} onChange={event => setTo(event.target.value)} /></div></label>
      <label>Branches<select value={branchId} onChange={event => setBranchId(event.target.value)}><option value="">All</option>{branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
      <button type="button" onClick={() => void load()} disabled={loading}>{loading ? "Loading…" : "Filter"}</button>
    </div>
    <div className="top-products-print"><button type="button" onClick={() => window.print()}>▣ Print Report</button></div>
    {error && <p className="top-products-error" role="alert">{error}</p>}
    <div className="top-products-table-wrap"><table><thead><tr><th>#</th><th>Product</th><th>Total Sold Qty</th><th>Total Sale</th><th>Total Cost</th><th>Total Profit</th></tr></thead><tbody>
      {loading ? <tr><td colSpan={6} className="top-products-empty">Loading…</td></tr> : rows.length ? rows.map((row, index) => <tr key={row.productId}><td>{index + 1}</td><td>{row.name}</td><td>{row.quantity.toLocaleString()}</td><td>{money(row.sales)}</td><td>{money(row.cost)}</td><td className={row.profit < 0 ? "top-products-loss" : ""}>{money(row.profit)}</td></tr>) : <tr><td colSpan={6} className="top-products-empty">No products sold in this date range.</td></tr>}
      {!loading && rows.length > 0 && <tr className="top-products-total"><th colSpan={2}>Total</th><td>{totals.quantity.toLocaleString()}</td><td>{money(totals.sales)}</td><td>{money(totals.cost)}</td><td>{money(totals.profit)}</td></tr>}
    </tbody></table></div>
  </section></main>;
}
