"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type User = { id: string; fullName: string };
type Invoice = { id: string; invoiceNo: string; date: string; customer: string; type: string; usdAmount: number; paidAmount: number };
const localDay = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const usd = (value: number) => value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function InvoiceTransferWorkspace() {
  const today = new Date(); const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7);
  const [users, setUsers] = useState<User[]>([]); const [currentUser, setCurrentUser] = useState<User | null>(null); const [fromUserId, setFromUserId] = useState("");
  const [from, setFrom] = useState(localDay(weekAgo)); const [to, setTo] = useState(localDay(today)); const [invoices, setInvoices] = useState<Invoice[]>([]); const [selected, setSelected] = useState<string[]>([]);
  const [searched, setSearched] = useState(false); const [loading, setLoading] = useState(false); const [saving, setSaving] = useState(false); const [notice, setNotice] = useState("");
  useEffect(() => { fetch("/api/order-management/transfer-transactions?mode=invoices").then((r) => r.ok ? r.json() : null).then((payload) => { setUsers(payload?.options?.users ?? []); setCurrentUser(payload?.options?.currentUser ?? null); }).catch(() => setNotice("Users lama la soo rari karin.")); }, []);
  const selectedTotal = useMemo(() => invoices.filter((invoice) => selected.includes(invoice.id)).reduce((sum, invoice) => sum + invoice.usdAmount, 0), [invoices, selected]);
  const allSelected = invoices.length > 0 && invoices.every((invoice) => selected.includes(invoice.id));
  async function search(event?: FormEvent) {
    event?.preventDefault(); setNotice(""); setSelected([]); setLoading(true);
    try { const params = new URLSearchParams({ mode: "invoices", userId: fromUserId, from, to }); const response = await fetch(`/api/order-management/transfer-transactions?${params}`, { cache: "no-store" }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "Invoices lama soo raari karin."); setInvoices(payload.data ?? []); setCurrentUser(payload.options?.currentUser ?? currentUser); setSearched(true); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Invoices lama soo raari karin."); } finally { setLoading(false); }
  }
  function toggleAll(checked: boolean) { setSelected(checked ? invoices.map((invoice) => invoice.id) : []); }
  function toggleOne(id: string, checked: boolean) { setSelected((old) => checked ? [...old, id] : old.filter((value) => value !== id)); }
  async function transfer() {
    if (!fromUserId || !selected.length) { setNotice("Dooro user-ka laga wareejinayo iyo ugu yaraan hal invoice."); return; }
    setSaving(true); setNotice("");
    try { const response = await fetch("/api/order-management/transfer-transactions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fromUserId, saleIds: selected }) }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "Wareejinta invoices-ku way fashilantay."); setNotice(`${payload.data.transferred} invoice ayaa loo wareejiyey ${payload.data.toUser}.`); await search(); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Wareejinta invoices-ku way fashilantay."); } finally { setSaving(false); }
  }
  return <div className="invoice-transfer-page"><section className="invoice-transfer-card">
    <header className="invoice-transfer-title"><span>⚑</span> Dooro Xogta User-ka iyo Muddada</header>
    <form className="invoice-transfer-filters" onSubmit={search}>
      <label>User-ka laga wareejinayo<select required value={fromUserId} onChange={(event) => setFromUserId(event.target.value)}><option value="">Dooro user</option>{users.map((user) => <option key={user.id} value={user.id}>{user.fullName}</option>)}</select></label>
      <label>Taariikhda Bilowga<input required type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
      <label>Taariikhda Dhammaadka<input required type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
      <button className="invoice-transfer-search" disabled={loading}>{loading ? "Waa la raadinayaa…" : "⌕ Soo Saar Xogta"}</button>
    </form>
    {notice && <p className="invoice-transfer-notice" role="status">{notice}</p>}
    <section className="invoice-transfer-details"><header><span>☷ Details: Dooro Invoices-ka aad wareejinayso</span><label><input type="checkbox" checked={allSelected} disabled={!invoices.length} onChange={(event) => toggleAll(event.target.checked)} /> Select All</label></header>
      <div className="invoice-transfer-table-wrap"><table className="invoice-transfer-table"><thead><tr><th>Select</th><th>ID</th><th>Invoice No</th><th>Date</th><th>USD Amount</th><th>Paid Amount</th></tr></thead><tbody>
        {loading ? <tr><td className="invoice-transfer-empty" colSpan={6}>Xogta invoices-ka waa la soo rariyaa…</td></tr> : invoices.length ? invoices.map((invoice) => <tr key={invoice.id}><td><input aria-label={`Dooro ${invoice.invoiceNo}`} type="checkbox" checked={selected.includes(invoice.id)} onChange={(event) => toggleOne(invoice.id, event.target.checked)} /></td><td title={invoice.id}>{invoice.id.slice(-8)}</td><td>{invoice.invoiceNo}</td><td>{new Date(invoice.date).toLocaleString()}</td><td>{usd(invoice.usdAmount)}</td><td>{usd(invoice.paidAmount)}</td></tr>) : <tr><td className="invoice-transfer-empty" colSpan={6}>{searched ? "Ma jiraan invoices ku jira user-ka iyo muddadan." : "Dooro user iyo taariikh, kadibna riix Soo Saar Xogta."}</td></tr>}
      </tbody></table></div>
    </section>
    {searched && <footer className="invoice-transfer-footer"><div><strong>{selected.length}</strong> invoice la doortay <span>· Wadarta {usd(selectedTotal)} USD</span><small>Waxaa loo wareejinayaa: {currentUser?.fullName ?? "User-ka hadda"}</small></div><button disabled={saving || loading || !selected.length} onClick={() => void transfer()}>{saving ? "Waa la wareejinayaa…" : "Wareeji invoices-ka"}</button></footer>}
  </section></div>;
}
