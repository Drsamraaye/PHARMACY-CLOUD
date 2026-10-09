"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type Product = {
  id: string;
  name: string;
  category?: string | null;
  barcode?: string | null;
  type?: string;
  quantity?: number;
  reorderPoint?: number;
  salePrice?: number | string;
  costPrice?: number | string;
  totalPurchase?: number;
  isActive?: boolean;
  expiryDate?: string | null;
  batchNo?: string | null;
  createdAt?: string;
  updatedAt?: string;
  branchId?: string | null;
  addedBy?: string;
  action?: string;
  details?: string;
  product?: { id: string; name: string; type?: string; branch?: { name: string } | null };
  branch?: { name: string } | null;
  products?: Product[];
  match?: string;
};

type View = "catalog" | "laboratory" | "services" | "low-stock" | "expiry" | "inactive" | "history" | "duplicates";

const viewDetails: Record<View, { title: string; endpoint: string; description: string }> = {
  catalog: { title: "Products", endpoint: "/api/products", description: "Browse and maintain the active pharmacy catalog." },
  laboratory: { title: "Lab List", endpoint: "/api/products?type=LAB", description: "Tests and products sold by the laboratory." },
  services: { title: "Services", endpoint: "/api/products?type=SERVICE", description: "Service items and their current prices." },
  "low-stock": { title: "Low stock", endpoint: "/api/products/low-stock", description: "Active products at or below their reorder point." },
  expiry: { title: "Expiry Products List", endpoint: "/api/products/expiry?months=3", description: "Products with stock batches expiring soon." },
  inactive: { title: "Archived products", endpoint: "/api/products/inactive", description: "Archived catalog entries can be restored at any time." },
  history: { title: "Product history", endpoint: "/api/products/history", description: "Audit trail for product creation and catalog changes." },
  duplicates: { title: "Duplicate Products", endpoint: "/api/products", description: "Browse products in the selected branch." },
};

const emptyEdit = { name: "", category: "", barcode: "", type: "PHARMACY", salePrice: "0", costPrice: "0", reorderPoint: "0" };

export default function ProductManagementWorkspace({ view, addNewHref }: { view: View; addNewHref?: string }) {
  const details = viewDetails[view];
  const [rows, setRows] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [productType, setProductType] = useState("");
  const [expiryMonths, setExpiryMonths] = useState("3");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState("");
  const [edit, setEdit] = useState<Product | null>(null);
  const [editValues, setEditValues] = useState(emptyEdit);
  const [historyProduct, setHistoryProduct] = useState<Product | null>(null);
  const [historyRows, setHistoryRows] = useState<{ id: string; action: string; details: string; createdAt: string }[]>([]);
  const [branchName, setBranchName] = useState("Branch");

  useEffect(() => { Promise.all([fetch("/api/setup/branches").then((r) => r.json()), fetch("/api/auth/session").then((r) => r.json())]).then(([branches, session]) => setBranchName(branches.data?.find((item: { id: string }) => item.id === session.data?.branchId)?.name ?? "All Branches")).catch(() => undefined); }, []);

  const endpoint = useMemo(() => view === "expiry" ? `/api/products/expiry?months=${expiryMonths}` : details.endpoint, [details.endpoint, expiryMonths, view]);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const url = new URL(endpoint, window.location.origin);
      if (search.trim()) url.searchParams.set("search", search.trim());
      const response = await fetch(url, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not load products");
      const value = payload.data ?? payload;
      setRows(Array.isArray(value) ? value : value.items ?? []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load products");
    } finally {
      setLoading(false);
    }
  }, [endpoint, search]);

  useEffect(() => { void load(); }, [load]);

  const categories = useMemo(() => [...new Set(rows.map((row) => row.category).filter((value): value is string => Boolean(value)))].sort(), [rows]);
  const visibleRows = useMemo(() => rows.filter((row) => {
    const matchesCategory = !category || row.category === category;
    const matchesType = !productType || row.type === productType;
    const needle = search.trim().toLocaleLowerCase();
    const matchesSearch = !needle || [row.name, row.barcode, row.category, row.action, row.details, row.match, row.product?.name, ...(row.products ?? []).map((product) => product.name)].some((value) => String(value ?? "").toLocaleLowerCase().includes(needle));
    return matchesCategory && matchesType && matchesSearch;
  }), [category, productType, rows, search]);

  async function changeActive(product: Product, isActive: boolean) {
    setBusyId(product.id); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/products/${encodeURIComponent(product.id)}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not update product");
      setNotice(isActive ? `${product.name} has been restored.` : `${product.name} has been archived.`);
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not update product"); }
    finally { setBusyId(""); }
  }

  function beginEdit(product: Product) {
    setEdit(product);
    setEditValues({ name: product.name, category: product.category ?? "", barcode: product.barcode ?? "", type: product.type ?? "PHARMACY", salePrice: String(product.salePrice ?? 0), costPrice: String(product.costPrice ?? 0), reorderPoint: String(product.reorderPoint ?? 0) });
    setError("");
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!edit) return;
    setBusyId(edit.id); setError("");
    try {
      const response = await fetch(`/api/products/${encodeURIComponent(edit.id)}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...editValues, salePrice: Number(editValues.salePrice), costPrice: Number(editValues.costPrice), reorderPoint: Number(editValues.reorderPoint) }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not save product");
      setEdit(null); setNotice(`${editValues.name} was updated.`); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save product"); }
    finally { setBusyId(""); }
  }

  async function openHistory(product: Product) {
    setHistoryProduct(product); setHistoryRows([]);
    const response = await fetch(`/api/products/history?productId=${encodeURIComponent(product.id)}`, { cache: "no-store" });
    const result = await response.json();
    if (response.ok) setHistoryRows(result.data ?? []);
  }

  async function mergeDuplicate(group: Product[], keep: Product, duplicate: Product) {
    if (!window.confirm(`Keep “${keep.name}” and move stock from “${duplicate.name}” into it? The duplicate will be archived.`)) return;
    setBusyId(duplicate.id); setError(""); setNotice("");
    try {
      const response = await fetch("/api/products/duplicate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ keepProductId: keep.id, duplicateProductId: duplicate.id }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not merge products");
      setNotice(`Stock from ${duplicate.name} was moved to ${keep.name}; the duplicate was archived.`);
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not merge products"); }
    finally { setBusyId(""); }
  }

  return <section className={`product-workspace product-view-${view}`}>
    <div className="product-report-panel">
      <header className="product-workspace-header">
        <div><h1>{details.title}</h1><p>{details.description}</p></div>
        <div className="product-workspace-actions">{addNewHref && <a href={addNewHref}>Add product</a>}<button type="button" onClick={() => void load()}>Refresh</button></div>
      </header>
      {view === "catalog" && <div className="product-list-summary"><article><small>Total Products</small><strong>{visibleRows.length}</strong></article><article className="danger"><small>Out of Stock</small><strong>{visibleRows.filter((row) => Number(row.quantity ?? 0) <= 0).length}</strong></article><article className="indigo"><small>Total Purchase</small><strong>{formatMoney(visibleRows.reduce((sum, row) => sum + Number(row.totalPurchase ?? 0), 0))}</strong></article><article><small>Total Sale</small><strong>{formatMoney(visibleRows.reduce((sum, row) => sum + Number(row.quantity ?? 0) * Number(row.salePrice ?? 0), 0))}</strong></article></div>}
      <div className="product-workspace-filters">
        {view === "expiry" && <label>Month<input aria-label="Months until expiry" type="number" min="1" max="24" value={expiryMonths} onChange={(event) => setExpiryMonths(event.target.value)} /></label>}
        <label>{view === "laboratory" ? "Search lab" : view === "expiry" ? "" : view === "duplicates" ? "Magaca alaabta" : "Search products"}<input id="product-search" placeholder={view === "laboratory" ? "Magaca labka..." : view === "expiry" ? "Search product name" : view === "duplicates" ? "Magaca alaabta..." : "Search name or barcode"} value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        {(view === "catalog" || view === "duplicates") && <label>Type<select aria-label="Filter by type" value={productType} onChange={(event) => setProductType(event.target.value)}><option value="">All</option><option value="PHARMACY">Pharmacy</option><option value="LAB">Laboratory</option><option value="SERVICE">Service</option></select></label>}
        {categories.length > 0 && view !== "history" && view !== "duplicates" && view !== "expiry" && <label>Category<select aria-label="Filter by category" value={category} onChange={(event) => setCategory(event.target.value)}><option value="">All categories</option>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>}
        {(view === "catalog" || view === "laboratory" || view === "duplicates") && <label>Branch<select aria-label="Branch" value={branchName} onChange={() => undefined}><option>{branchName}</option></select></label>}
      </div>
      <button className="product-report-search" type="button" onClick={() => void load()} disabled={loading}>{loading ? "Loading…" : "Search"}</button>
    </div>
    <div className="product-report-table-heading">{view === "catalog" && <button className="product-list-print" onClick={() => window.print()}>Print</button>}<span>{visibleRows.length} record{visibleRows.length === 1 ? "" : "s"}</span></div>

    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{notice}</p>}

    <ProductTable view={view} rows={visibleRows} loading={loading} busyId={busyId} onEdit={beginEdit} onActiveChange={changeActive} onHistory={openHistory} />

    {edit && <div className="product-edit-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEdit(null); }}>
      <form onSubmit={saveEdit} className="product-edit-modal" role="dialog" aria-modal="true" aria-labelledby="product-edit-title">
        <header className="product-edit-header"><div className="product-edit-heading-icon" aria-hidden="true">✎</div><div className="product-edit-heading-copy"><h2 id="product-edit-title">Edit product</h2><p>Update product details. Changes are recorded in product history.</p></div><button type="button" aria-label="Close edit form" className="product-edit-close" onClick={() => setEdit(null)}>×</button></header>
        <div className="product-edit-grid">{([['name','Name','text'],['category','Category','text'],['barcode','Barcode','text'],['salePrice','Sale price','number'],['costPrice','Cost price','number'],['reorderPoint','Reorder point','number']] as const).map(([name,label,type]) => <label key={name} className="product-edit-field">{label}<input required={name === "name"} min={type === "number" ? "0" : undefined} step={name.includes("Price") || name.includes("price") ? "0.01" : "1"} type={type} value={editValues[name]} onChange={(event) => setEditValues((current) => ({ ...current, [name]: event.target.value }))} /></label>)}<label className="product-edit-field">Product type<select value={editValues.type} onChange={(event) => setEditValues((current) => ({ ...current, type: event.target.value }))}><option value="PHARMACY">Pharmacy</option><option value="LAB">Laboratory</option><option value="SERVICE">Service</option></select></label></div>
        {error && <p role="alert" className="product-edit-error">{error}</p>}
        <footer className="product-edit-footer"><button type="button" onClick={() => setEdit(null)} className="product-edit-cancel">Cancel</button><button disabled={busyId === edit.id} className="product-edit-save">{busyId === edit.id ? "Saving…" : "Save changes"}</button></footer>
      </form>
    </div>}
    {historyProduct && <div className="product-history-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setHistoryProduct(null); }}><section className="product-history-modal" role="dialog" aria-modal="true"><header><h2>{historyProduct.name} · History</h2><button onClick={() => setHistoryProduct(null)} aria-label="Close">×</button></header>{historyRows.length ? <table><thead><tr><th>Date</th><th>Action</th><th>Details</th></tr></thead><tbody>{historyRows.map((item) => <tr key={item.id}><td>{new Date(item.createdAt).toLocaleString()}</td><td>{item.action}</td><td>{item.details}</td></tr>)}</tbody></table> : <p>No history records found.</p>}</section></div>}
  </section>;
}

function ProductTable({ view, rows, loading, busyId, onEdit, onActiveChange, onHistory }: { view: View; rows: Product[]; loading: boolean; busyId: string; onEdit: (product: Product) => void; onActiveChange: (product: Product, active: boolean) => void; onHistory: (product: Product) => void }) {
  const headings: Record<View, string[]> = {
    catalog: ["#", "User", "Date", "Name", "Quantity", "Purchase Price", "Sale Price", "Sale Price 2", "Expire", "Alert Qty", "Total Purchase", "Total Sale"],
    laboratory: ["#", "User", "Date", "Name", "Sale Price", "Sale Price 2"],
    services: ["Name", "Category", "Barcode", "Sale price"],
    "low-stock": ["Name", "Category", "Stock", "Reorder point", "Sale price"],
    expiry: ["#", "Name", "Type", "Quantity", "Taariikhda Dhicitaanka", "Days Until Expiry", "Branch"],
    inactive: ["Name", "Category", "Barcode", "Type", "Sale price", "Archived"],
    history: ["Date", "Product", "Action", "Details"],
    duplicates: ["#", "User", "Date", "Name", "Quantity", "Purchase Price", "Sale Price", "Sale Price 2", "Expire", "Alert Qty", "Total Purchase", "Total Sale"],
  };
  const columns = headings[view];
  const [selected, setSelected] = useState<string[]>([]);
  const expiryRows = rows;
  const colSpan = columns.length + (view === "expiry" ? 1 : ["catalog","laboratory","services","inactive","duplicates"].includes(view) ? 1 : 0);
  const toggleAll = () => setSelected(selected.length === expiryRows.length ? [] : expiryRows.map((row) => row.id));
  const toggleOne = (id: string) => setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  return <div className="product-data-table-wrap"><table className="product-data-table"><thead><tr>{view === "expiry" && <th><input type="checkbox" aria-label="Select all expiring products" checked={expiryRows.length > 0 && selected.length === expiryRows.length} onChange={toggleAll} /></th>}{columns.map((column) => <th key={column}>{column}</th>)}{["catalog","laboratory","services","inactive","duplicates"].includes(view) && <th>Action</th>}</tr></thead><tbody>{loading ? <tr><td colSpan={colSpan} className="product-table-empty">Loading…</td></tr> : rows.length === 0 ? <tr><td colSpan={colSpan} className="product-table-empty">No records found.</td></tr> : rows.map((row, index) => { const product = view === "history" ? row.product : row; const expiryDays = row.expiryDate ? Math.ceil((new Date(String(row.expiryDate)).getTime() - Date.now()) / 86400000) : null; const values: unknown[] = view === "history" ? [row.createdAt, row.product?.name ?? "—", row.action, row.details] : view === "expiry" ? [index + 1, row.product?.name ?? "—", row.product?.type === "LAB" ? "Lab" : "Item", row.quantity, row.expiryDate, expiryDays === null ? "—" : `${expiryDays} days`, row.product?.branch?.name ?? "—"] : view === "low-stock" ? [row.name, row.category, row.quantity, row.reorderPoint, row.salePrice] : view === "services" ? [row.name, row.category, row.barcode, row.salePrice] : view === "laboratory" ? [row.name, row.category, row.barcode, row.quantity, row.salePrice] : view === "inactive" ? [row.name, row.category, row.barcode, row.type, row.salePrice, row.updatedAt ?? row.createdAt] : [row.name, row.category, row.barcode, row.type, row.quantity, row.reorderPoint, row.salePrice, row.isActive ? "Active" : "Inactive"];
    if (view === "catalog" || view === "duplicates") values.splice(0, values.length, index + 1, row.addedBy ?? "—", row.createdAt, row.name, row.quantity ?? 0, Number(row.costPrice ?? 0), Number(row.salePrice ?? 0), "—", row.expiryDate, row.reorderPoint, Number(row.totalPurchase ?? 0), Number(row.quantity ?? 0) * Number(row.salePrice ?? 0));
    if (view === "laboratory") values.splice(0, values.length, index + 1, row.addedBy ?? "—", row.createdAt, row.name, Number(row.salePrice ?? 0), "—");
    const stockClass = Number(row.quantity ?? 0) <= 0 ? "product-out-stock-row" : Number(row.quantity ?? 0) <= Number(row.reorderPoint ?? 0) ? "product-low-stock-row" : "";
    return <tr key={row.id ?? `${row.product?.id}-${index}`} className={view === "catalog" || view === "laboratory" ? stockClass : undefined}>{view === "expiry" && <td><input type="checkbox" aria-label={`Select ${row.product?.name ?? "product"}`} checked={selected.includes(row.id)} onChange={() => toggleOne(row.id)} /></td>}{values.map((value, cellIndex) => <td key={cellIndex}>{((view === "catalog" || view === "duplicates") && [5,6,10,11].includes(cellIndex) || view === "laboratory" && cellIndex === 4) && typeof value === "number" ? formatMoney(value) : formatCell(value, columns[cellIndex])}</td>)}{product && ["catalog","laboratory","duplicates"].includes(view) && <td className="product-action-cell"><button className="product-history-action" onClick={() => void onHistory(product)}>History</button><button onClick={() => onEdit(product)}>Edit</button><button className="product-archive-action" disabled={busyId === product.id} onClick={() => void onActiveChange(product, false)}>{busyId === product.id ? "…" : "×"}</button><button className="product-transfer-action" type="button" disabled title="Stock transfer is not available for products yet">Transfer</button></td>}{product && view === "services" && <td className="product-action-cell"><button onClick={() => onEdit(product)}>Edit</button><button disabled={busyId === product.id} onClick={() => void onActiveChange(product, false)}>{busyId === product.id ? "Working…" : "Archive"}</button></td>}{product && view === "inactive" && <td className="product-action-cell"><button className="product-restore-action" disabled={busyId === product.id} onClick={() => void onActiveChange(product, true)}>{busyId === product.id ? "Restoring…" : "Restore"}</button></td>}</tr>;
  })}</tbody></table></div>;
}

function DuplicateGroup({ group, busyId, onMerge }: { group: Product; busyId: string; onMerge: (group: Product[], keep: Product, duplicate: Product) => void }) {
  const products = group.products ?? [];
  const [keepId, setKeepId] = useState(products[0]?.id ?? "");
  const retained = products.find((product) => product.id === keepId) ?? products[0];
  return <article className="rounded-xl border border-amber-200 bg-white p-4"><div className="mb-3 flex flex-wrap items-end justify-between gap-3"><div><h2 className="font-semibold text-slate-900">Match: {group.match}</h2><p className="text-xs text-slate-500">Select the product to retain. Other products' stock batches will move into it.</p></div><div className="flex items-center gap-2"><label className="text-xs font-medium text-slate-600">Keep<select aria-label={`Product to retain for ${group.match}`} value={retained?.id ?? ""} onChange={(event) => setKeepId(event.target.value)} className="ml-2 rounded border border-slate-300 px-2 py-1.5 text-sm">{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label><span className="rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-800">{products.length} matches</span></div></div><div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead><tr>{["Product", "Type", "Barcode", "Price", "Action"].map((heading) => <th key={heading} className="border-b px-3 py-2 font-medium text-slate-600">{heading}</th>)}</tr></thead><tbody>{products.map((product) => <tr key={product.id}><td className="border-b px-3 py-2 font-medium">{product.name}{retained?.id === product.id && <span className="ml-2 text-xs text-green-700">Retained</span>}</td><td className="border-b px-3 py-2">{product.type ?? "—"}</td><td className="border-b px-3 py-2">{product.barcode ?? "—"}</td><td className="border-b px-3 py-2">{formatCell(product.salePrice, "Sale price")}</td><td className="border-b px-3 py-2">{retained && retained.id !== product.id && <button disabled={busyId === product.id} onClick={() => onMerge(products, retained, product)} className="rounded border border-amber-300 px-3 py-1.5 text-xs disabled:opacity-50">Merge into {retained.name}</button>}</td></tr>)}</tbody></table></div></article>;
}

function formatCell(value: unknown, label?: string): string {
  if (value == null || value === "") return "—";
  if (label === "Date" || label === "Expiry date" || label === "Archived") {
    const date = new Date(String(value));
    if (!Number.isNaN(date.getTime())) return date.toLocaleString();
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function formatMoney(value: number): string { return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
