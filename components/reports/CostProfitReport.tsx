"use client";

import { useCallback, useEffect, useState } from "react";

type Product = { productId: string; name: string; quantity: number; sale: number; cost: number; profit: number };
type Expense = { id: string; name: string; type: string; amount: number; date: string };
type SupplierPayment = { id: string; supplier: string; phone: string; user: string; method: string; account: string; amount: number; date: string };
type Branch = { id: string; name: string };
type ReportData = { products: Product[]; expenseRows: Expense[]; expenseSummary: Array<{ name: string; amount: number }>; supplierRows: SupplierPayment[]; totals: { quantity: number; totalSales: number; totalCost: number; discount: number; grossMargin: number; totalExpenses: number; totalSupplierPayments: number; netProfit: number }; range: { from: string; to: string } };
const dateString = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const money = (value: number) => `$${Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function CostProfitReport() {
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const [from, setFrom] = useState(dateString(monthStart));
  const [to, setTo] = useState(dateString(monthEnd));
  const [branchId, setBranchId] = useState("");
  const [search, setSearch] = useState("");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ from, to, branchId, search });
      const response = await fetch(`/api/reports/net-profit?${query}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Cost & profit report lama soo rari karin.");
      setData(result.data ?? null);
      setBranches(result.options?.branches ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Cost & profit report lama soo rari karin.");
    } finally {
      setLoading(false);
    }
  }, [from, to, branchId, search]);

  useEffect(() => { void load(); }, [load]);
  const totals = data?.totals ?? { quantity: 0, totalSales: 0, totalCost: 0, discount: 0, grossMargin: 0, totalExpenses: 0, totalSupplierPayments: 0, netProfit: 0 };
  return <main className="cost-profit-page"><div className="cost-profit-heading"><h1>Full Cost &amp; Profit Report</h1><p>Reporting Period: {from} to {to}</p></div>
    <section className="cost-profit-filters"><label>Start Date<input type="date" value={from} onChange={event => setFrom(event.target.value)} /></label><label>End Date<input type="date" value={to} onChange={event => setTo(event.target.value)} /></label><label>Branch<select value={branchId} onChange={event => setBranchId(event.target.value)}><option value="">All Branches</option>{branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label><label>Search Product<input type="search" placeholder="Product name..." value={search} onChange={event => setSearch(event.target.value)} /></label><button type="button" onClick={() => void load()} disabled={loading}>{loading ? "Loading…" : "⚑ Filter Data"}</button></section>
    {error && <p className="cost-profit-error" role="alert">{error}</p>}
    <section className="cost-profit-product-section"><header>▣ Product, Costs &amp; Profits Summary</header><div className="cost-profit-table-wrap"><table><thead><tr><th>#</th><th>Product Name</th><th>Total Qty Sold</th><th>Total Sale</th><th>Total Purchase Price</th><th>Total Item Profit</th></tr></thead><tbody>{loading ? <tr><td colSpan={6} className="cost-profit-empty">Loading…</td></tr> : data?.products.length ? data.products.map((product, index) => <tr key={product.productId}><td>{index + 1}</td><td>{product.name}</td><td>{product.quantity.toLocaleString()}</td><td>{money(product.sale)}</td><td>{money(product.cost)}</td><td className={product.profit < 0 ? "cost-profit-loss" : ""}>{product.profit < 0 ? "−" : ""}{money(product.profit)}</td></tr>) : <tr><td colSpan={6} className="cost-profit-empty">No sales found in this period.</td></tr>}</tbody></table></div></section>
    <section className="cost-profit-detail-grid"><article><header>Supplier Payments</header><div className="cost-profit-table-wrap"><table><thead><tr><th>Supplier</th><th>User</th><th>Method</th><th>Account</th><th>Amount</th></tr></thead><tbody>{data?.supplierRows.length ? data.supplierRows.map(payment => <tr key={payment.id}><td>{payment.supplier}<small>{payment.phone}</small></td><td>{payment.user}</td><td>{payment.method}</td><td>{payment.account}</td><td>{money(payment.amount)}</td></tr>) : <tr><td colSpan={5} className="cost-profit-empty">No supplier payments.</td></tr>}<tr className="cost-profit-subtotal"><th colSpan={4}>Total Supplier Payment</th><td>{money(totals.totalSupplierPayments)}</td></tr></tbody></table></div></article>
      <article><header>Expenses Summary</header><div className="cost-profit-table-wrap"><table><thead><tr><th>Expense Type</th><th>Amount</th></tr></thead><tbody>{data?.expenseSummary.length ? data.expenseSummary.map(expense => <tr key={expense.name}><td>{expense.name}</td><td className="cost-profit-expense">{money(expense.amount)}</td></tr>) : <tr><td colSpan={2} className="cost-profit-empty">No expenses.</td></tr>}<tr className="cost-profit-subtotal"><th>Total</th><td className="cost-profit-expense">{money(totals.totalExpenses)}</td></tr></tbody></table></div></article></section>
    <section className="cost-profit-financial"><header>▦ Financial Summary</header><div className="cost-profit-financial-columns"><article><h2>Performance</h2><p><span>Total Sales:</span><b>{money(totals.totalSales)}</b></p><p><span>Total Cost:</span><b>−{money(totals.totalCost)}</b></p><p><span>Total Discount:</span><b>−{money(totals.discount)}</b></p><p className="gross-margin"><strong>Total Profit Margin:</strong><strong>{totals.grossMargin < 0 ? "−" : ""}{money(totals.grossMargin)}</strong></p></article><article><h2>Summary</h2><p><span>Gross Margin Balance:</span><b>{totals.grossMargin < 0 ? "−" : ""}{money(totals.grossMargin)}</b></p><p><span>Total Expenses:</span><b>−{money(totals.totalExpenses)}</b></p><p><span>Total Supplier Payments:</span><b>−{money(totals.totalSupplierPayments)}</b></p><div className="net-profit-total"><strong>◩ NET PROFIT:</strong><strong>{totals.netProfit < 0 ? "−" : ""}{money(totals.netProfit)}</strong></div></article></div></section>
    <div className="cost-profit-print"><button type="button" onClick={() => window.print()}>Print Report</button></div>
  </main>;
}
