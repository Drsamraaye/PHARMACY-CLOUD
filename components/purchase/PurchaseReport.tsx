"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";

type Supplier = { id: string; name: string; phone?: string | null };
type Purchase = { id: string; invoiceNo?: string | null; createdAt: string; total: number | string; paidAmount: number | string; discount: number | string; status: string; supplier?: Supplier | null; items: { id: string; quantity: number; costPrice: number | string; product: { name: string } }[] };
const localDate = (date = new Date()) => { const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, "0"); const day = String(date.getDate()).padStart(2, "0"); return `${year}-${month}-${day}`; };
const amount = (value: number | string) => Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Supplier purchase report with date, supplier and balance filters. */
export default function PurchaseReport() {
  const [rows, setRows] = useState<Purchase[]>([]); const [suppliers, setSuppliers] = useState<Supplier[]>([]); const [branch, setBranch] = useState("Branch");
  const [from, setFrom] = useState(localDate); const [to, setTo] = useState(localDate); const [supplierId, setSupplierId] = useState(""); const [balanceFilter, setBalanceFilter] = useState("ALL");
  const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [expanded, setExpanded] = useState<string[]>([]);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ from, to, ...(supplierId ? { supplierId } : {}) });
      const [reportResponse, supplierResponse] = await Promise.all([fetch(`/api/purchase/report?${params}`, { cache: "no-store" }), fetch("/api/purchase/suppliers", { cache: "no-store" })]);
      const [report, supplierPayload] = await Promise.all([reportResponse.json(), supplierResponse.json()]);
      if (!reportResponse.ok) throw new Error(report.error || "Could not load purchases");
      setRows(report.data ?? []); setSuppliers(supplierPayload.data ?? []);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load purchases"); }
    finally { setLoading(false); }
  }, [from, to, supplierId]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { Promise.all([fetch("/api/setup/branches").then((r) => r.json()), fetch("/api/auth/session").then((r) => r.json())]).then(([b, s]) => setBranch(b.data?.find((item: { id: string }) => item.id === s.data?.branchId)?.name ?? "Branch")).catch(() => {}); }, []);
  const visible = useMemo(() => rows.filter((row) => balanceFilter === "ALL" || (balanceFilter === "DUE" ? Number(row.total) - Number(row.paidAmount) > 0.005 : Number(row.total) - Number(row.paidAmount) <= 0.005)), [rows, balanceFilter]);
  const totals = useMemo(() => visible.reduce((sum, row) => ({ qty: sum.qty + row.items.reduce((n, item) => n + item.quantity, 0), paid: sum.paid + Number(row.paidAmount), discount: sum.discount + Number(row.discount), total: sum.total + Number(row.total), balance: sum.balance + Math.max(0, Number(row.total) - Number(row.paidAmount)) }), { qty: 0, paid: 0, discount: 0, total: 0, balance: 0 }), [visible]);
  function toggle(id: string) { setExpanded((all) => all.includes(id) ? all.filter((item) => item !== id) : [...all, id]); }
  return <main className="purchase-report-page"><section className="purchase-report-card"><h1>Purchase report {branch}</h1>
    <div className="purchase-report-filters">
      <label><span>▦ &nbsp;Date Range</span><div className="purchase-report-dates"><input aria-label="Start date" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /><b>–</b><input aria-label="End date" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div></label>
      <label><span>♟ &nbsp;Supplier</span><select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}><option value="">-- All Suppliers --</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label>
      <label><span>▤ &nbsp;Balance Filter</span><select value={balanceFilter} onChange={(e) => setBalanceFilter(e.target.value)}><option value="ALL">All</option><option value="DUE">Outstanding</option><option value="PAID">Paid</option></select></label>
      <button className="purchase-report-filter-button" onClick={() => void load()}>▼ Filter</button>
    </div>
    {error && <p role="alert" className="purchase-report-error">{error}</p>}
    <div className="purchase-report-table-wrap"><table className="purchase-report-table"><thead><tr><th>#</th><th>Serial No</th><th>Date</th><th>Name</th><th>Phone</th><th>Total Qty</th><th>Type</th><th>Paid</th><th>Discount</th><th>Total</th><th>Balance</th><th>Details</th></tr></thead><tbody>
      {loading ? <tr><td colSpan={12} className="purchase-report-empty">Loading purchases…</td></tr> : visible.length === 0 ? <tr><td colSpan={12} className="purchase-report-empty">No records found.</td></tr> : visible.map((row, index) => <Fragment key={row.id}>
        <tr key={row.id}><td>{index + 1}</td><td>{row.invoiceNo || row.id.slice(-6)}</td><td>{new Date(row.createdAt).toLocaleString()}</td><td>{row.supplier?.name || "—"}</td><td>{row.supplier?.phone || "—"}</td><td>{row.items.reduce((n, item) => n + item.quantity, 0).toFixed(2)}</td><td><span className="purchase-report-badge">Purchase</span></td><td>{amount(row.paidAmount)}</td><td>{amount(row.discount)}</td><td>{amount(row.total)}</td><td>{amount(Math.max(0, Number(row.total) - Number(row.paidAmount)))}</td><td className="purchase-report-actions"><button onClick={() => toggle(row.id)}>{expanded.includes(row.id) ? "Hide" : "View"}</button><button className="print" onClick={() => window.print()}>Print</button></td></tr>
        {expanded.includes(row.id) && <tr key={`${row.id}-items`} className="purchase-report-detail-row"><td colSpan={12}><div className="purchase-report-detail"><strong>Purchase items</strong><table><thead><tr><th>Product</th><th>Quantity</th><th>Purchase price</th><th>Total</th></tr></thead><tbody>{row.items.map((item) => <tr key={item.id}><td>{item.product.name}</td><td>{item.quantity}</td><td>{amount(item.costPrice)}</td><td>{amount(item.quantity * Number(item.costPrice))}</td></tr>)}</tbody></table></div></td></tr>}
      </Fragment>)}</tbody>{!loading && visible.length > 0 && <tfoot><tr><th colSpan={5}>Total:</th><th>{totals.qty.toFixed(2)}</th><th></th><th>{amount(totals.paid)}</th><th>{amount(totals.discount)}</th><th>{amount(totals.total)}</th><th>{amount(totals.balance)}</th><th></th></tr></tfoot>}</table></div>
  </section></main>;
}
