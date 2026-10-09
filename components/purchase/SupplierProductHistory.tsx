"use client";

import { useEffect, useState } from "react";

type Supplier = { id: string; name: string };
type Product = { id: string; name: string };
type Entry = { id: string; date: string; user: string; productId: string; product: string; quantity: number; price: number; total: number };
type Report = { supplier: Supplier; products: Product[]; entries: Entry[]; summary: { timesPurchased: number; totalQuantity: number; totalCost: number } };
const money = (value: number) => value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const shortDate = (value: string) => new Date(value).toLocaleDateString(undefined, { day: "2-digit", month: "2-digit", year: "numeric" });

/** Supplier and product selector backed by purchase line history. */
export default function SupplierProductHistory() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]); const [products, setProducts] = useState<Product[]>([]); const [supplierId, setSupplierId] = useState(""); const [productId, setProductId] = useState("");
  const [report, setReport] = useState<Report | null>(null); const [loading, setLoading] = useState(false); const [error, setError] = useState("");
  useEffect(() => { fetch("/api/purchase/suppliers", { cache: "no-store" }).then((r) => r.json()).then((payload) => setSuppliers(payload.data ?? [])).catch(() => setError("Could not load suppliers.")); }, []);
  async function chooseSupplier(id: string) {
    setSupplierId(id); setProductId(""); setReport(null); setProducts([]); setError("");
    if (!id) return;
    setLoading(true);
    try { const response = await fetch(`/api/purchase/supplier-history?supplierId=${encodeURIComponent(id)}`, { cache: "no-store" }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "Could not load supplier products"); setProducts(payload.data.products ?? []); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not load supplier products"); }
    finally { setLoading(false); }
  }
  async function search() {
    if (!supplierId || !productId) { setError("Select a supplier and product first."); setReport(null); return; }
    setLoading(true); setError("");
    try { const params = new URLSearchParams({ supplierId, productId }); const response = await fetch(`/api/purchase/supplier-history?${params}`, { cache: "no-store" }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "Could not load history"); setReport(payload.data); setProducts(payload.data.products ?? []); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not load history"); }
    finally { setLoading(false); }
  }
  return <main className="supplier-history-page"><section className="supplier-history-card"><h1>Supplier Product History</h1>
    <div className="supplier-history-filters"><label>Name<select value={supplierId} onChange={(e) => void chooseSupplier(e.target.value)}><option value="">Select supplier</option>{suppliers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Product<select value={productId} onChange={(e) => setProductId(e.target.value)} disabled={!supplierId || loading}><option value="">Select product</option>{products.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><button type="button" onClick={() => void search()} disabled={loading}>{loading ? "Loading…" : "Search"}</button></div>
    {error && <p className="supplier-history-error" role="alert">{error}</p>}
    {report && <><div className="supplier-history-summary"><div>Times Purchased: <strong>{report.summary.timesPurchased}</strong></div><div>Total Qty: <strong>{report.summary.totalQuantity}</strong></div><div>Total Cost: <strong>{money(report.summary.totalCost)}</strong></div></div><h2>Details:</h2><div className="supplier-history-table-wrap"><table className="supplier-history-table"><thead><tr><th>#</th><th>Date</th><th>User</th><th>Product</th><th>Quantity</th><th>Price</th><th>Total</th></tr></thead><tbody>{report.entries.length ? report.entries.map((entry, index) => <tr key={entry.id}><td>{index + 1}</td><td>{shortDate(entry.date)}</td><td>{entry.user}</td><td>{entry.product}</td><td>{entry.quantity}</td><td>{money(entry.price)}</td><td>{money(entry.total)}</td></tr>) : <tr><td colSpan={7} className="supplier-history-empty">No purchase history found.</td></tr>}</tbody>{report.entries.length > 0 && <tfoot><tr><th colSpan={4}>Total:</th><th>{report.summary.totalQuantity}</th><th></th><th>{money(report.summary.totalCost)}</th></tr></tfoot>}</table></div></>}
  </section></main>;
}
