"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Asset = { id: string; name: string; quantity: number; unitPrice: number; totalPrice: number; status?: string; branch?: string; regDate?: string; regUser?: string };
type AssetForm = { name: string; quantity: string; unitPrice: string; status: string };
const blankForm: AssetForm = { name: "", quantity: "1", unitPrice: "0", status: "Active" };

function money(value: number) { return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value); }
function date(value?: string) { return value ? new Date(value).toLocaleDateString() : "—"; }

export default function AssetsManager() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [form, setForm] = useState<AssetForm>(blankForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/assets${query.trim() ? `?search=${encodeURIComponent(query.trim())}` : ""}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not load assets.");
      setAssets(Array.isArray(result.data) ? result.data : []);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load assets."); }
    finally { setLoading(false); }
  }, [query]);

  useEffect(() => { void load(); }, [load]);
  const total = useMemo(() => assets.reduce((sum, asset) => sum + (Number(asset.totalPrice) || 0), 0), [assets]);

  function openAdd() { setEditing(null); setForm(blankForm); setModal(true); }
  function openEdit(asset: Asset) { setEditing(asset); setForm({ name: asset.name || "", quantity: String(asset.quantity ?? 1), unitPrice: String(asset.unitPrice ?? 0), status: asset.status || "Active" }); setModal(true); }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError("");
    const quantity = Number(form.quantity), unitPrice = Number(form.unitPrice);
    if (!Number.isFinite(quantity) || quantity < 0 || !Number.isFinite(unitPrice) || unitPrice < 0) { setError("Quantity and unit price must be zero or greater."); setSaving(false); return; }
    const data = { name: form.name.trim(), quantity, unitPrice, totalPrice: quantity * unitPrice, status: form.status };
    try {
      const response = await fetch("/api/assets", { method: editing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editing ? { id: editing.id, data } : data) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save asset.");
      setModal(false); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save asset."); }
    finally { setSaving(false); }
  }

  async function remove(asset: Asset) {
    if (!window.confirm(`Delete ${asset.name}?`)) return;
    try {
      const response = await fetch("/api/assets", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: asset.id }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not delete asset.");
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not delete asset."); }
  }

  function exportCsv() {
    const columns = ["#", "Reg Date", "Reg User", "Name", "Branch", "Status", "Qty", "Unit Price", "Total Price"];
    const rows = assets.map((asset, index) => [index + 1, date(asset.regDate), asset.regUser || "—", asset.name, asset.branch || "—", asset.status || "Active", asset.quantity, asset.unitPrice, asset.totalPrice]);
    const csv = [columns, ...rows].map(row => row.map(value => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "company-assets.csv"; link.click(); URL.revokeObjectURL(url);
  }

  return <section className="assets-page">
    <div className="assets-card">
      <div className="assets-toolbar">
        <button className="assets-button assets-print" onClick={() => window.print()}>Print</button>
        <div className="assets-heading"><h1>Assets List</h1><div className="assets-actions"><button className="assets-button assets-add" onClick={openAdd}>Add New</button><button className="assets-button assets-export" onClick={exportCsv}>Export</button></div></div>
        <div className="assets-search"><input aria-label="Search assets" placeholder="Search assets" value={query} onChange={event => setQuery(event.target.value)} /><button onClick={() => void load()}>Search</button><button onClick={() => setQuery("")}>Refresh</button></div>
      </div>
      {error && !modal && <p className="assets-error" role="alert">{error}</p>}
      <div className="assets-table-wrap"><table className="assets-table"><thead><tr><th>#</th><th>Reg Date</th><th>Reg User</th><th>Name</th><th>Branch</th><th>Status</th><th>Qty</th><th>Unit Price</th><th>Total Price</th><th>Action</th></tr></thead>
        <tbody>{loading ? <tr><td colSpan={10} className="assets-empty">Loading...</td></tr> : assets.length === 0 ? <tr><td colSpan={10} className="assets-empty">No assets found.</td></tr> : assets.map((asset, index) => <tr key={asset.id}><td>{index + 1}</td><td>{date(asset.regDate)}</td><td>{asset.regUser || "—"}</td><td>{asset.name}</td><td>{asset.branch || "—"}</td><td>{asset.status || "Active"}</td><td>{asset.quantity}</td><td>{money(Number(asset.unitPrice) || 0)}</td><td>{money(Number(asset.totalPrice) || 0)}</td><td className="assets-row-actions"><button className="assets-button assets-edit" onClick={() => openEdit(asset)}>Edit</button><button className="assets-button assets-delete" onClick={() => void remove(asset)}>Delete</button></td></tr>)}</tbody>
        <tfoot><tr><th colSpan={8}>Total</th><th>{money(total)}</th><th /></tr></tfoot>
      </table></div>
    </div>
    {modal && <div className="assets-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setModal(false); }}><form className="assets-modal" onSubmit={save}>
      <header><h2>{editing ? "Edit Asset" : "Add New Asset"}</h2><button type="button" aria-label="Close" onClick={() => setModal(false)}>×</button></header>
      {error && <p className="assets-error" role="alert">{error}</p>}
      <label>Asset name<input required autoFocus value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="Enter asset name" /></label>
      <div className="assets-form-grid"><label>Quantity<input required type="number" min="0" step="any" value={form.quantity} onChange={event => setForm({ ...form, quantity: event.target.value })} /></label><label>Unit price<input required type="number" min="0" step="any" value={form.unitPrice} onChange={event => setForm({ ...form, unitPrice: event.target.value })} /></label><label>Status<select value={form.status} onChange={event => setForm({ ...form, status: event.target.value })}><option>Active</option><option>Inactive</option><option>Disposed</option></select></label></div>
      <footer><button type="button" className="assets-button assets-cancel" onClick={() => setModal(false)}>Cancel</button><button className="assets-button assets-add" disabled={saving}>{saving ? "Saving..." : "Save"}</button></footer>
    </form></div>}
  </section>;
}
