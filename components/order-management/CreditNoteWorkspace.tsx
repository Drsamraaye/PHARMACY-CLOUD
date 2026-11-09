"use client";

import { useEffect, useMemo, useState } from "react";

type CreditItem = { productId: string; name: string; type: string; quantity: number; returnedQuantity: number; unitPrice: number };
type CreditSale = { id: string; date: string; type: string; total: number; paidAmount: number; creditAmount: number; remainingCredit: number; patient: { id: string; fullName: string; phone: string | null } | null; items: CreditItem[] };
type Option = { id: string; name?: string };
const amount = (value: number) => value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const customerKey = (sale: CreditSale) => sale.patient?.id || "walk-in";

export default function CreditNoteWorkspace() {
  const [sales, setSales] = useState<CreditSale[]>([]);
  const [branchName, setBranchName] = useState("Branch");
  const [customer, setCustomer] = useState("");
  const [saleId, setSaleId] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function loadSales() {
    const [salesResult, branchesResult, session] = await Promise.all([
      fetch("/api/order-management/credit-note?sourceSales=true", { cache: "no-store" }).then((r) => r.ok ? r.json() : null),
      fetch("/api/setup/branches").then((r) => r.ok ? r.json() : null),
      fetch("/api/auth/session").then((r) => r.ok ? r.json() : null),
    ]);
    const rows: CreditSale[] = salesResult?.data ?? [];
    setSales(rows);
    setBranchName(branchesResult?.data?.find((branch: Option) => branch.id === session?.data?.branchId)?.name ?? branchesResult?.data?.[0]?.name ?? "Branch");
    return rows;
  }

  useEffect(() => {
    loadSales().then((rows) => {
      const first = rows.find((sale) => sale.remainingCredit > 0 && sale.items.some((item) => item.quantity > item.returnedQuantity));
      if (first) { setCustomer(customerKey(first)); setSaleId(first.id); }
    }).catch(() => setNotice("Xogta iibka lama soo rari karin.")).finally(() => setLoading(false));
  }, []);

  const customers = useMemo(() => {
    const list = new Map<string, string>();
    for (const sale of sales) list.set(customerKey(sale), sale.patient?.fullName ?? "Walk-in customer");
    return [...list].map(([id, name]) => ({ id, name }));
  }, [sales]);
  const customerSales = useMemo(() => sales.filter((sale) => customerKey(sale) === customer), [sales, customer]);
  const selectedSale = sales.find((sale) => sale.id === saleId) ?? null;
  const returnLines = selectedSale?.items.filter((item) => (quantities[item.productId] || 0) > 0).map((item) => ({ productId: item.productId, quantity: quantities[item.productId] })) ?? [];
  const returnAmount = selectedSale?.items.reduce((sum, item) => sum + item.unitPrice * (quantities[item.productId] || 0), 0) ?? 0;
  const exceedsDebt = returnAmount > (selectedSale?.remainingCredit ?? 0) + 0.005;

  function chooseCustomer(value: string) {
    setCustomer(value); setQuantities({}); setNotes("");
    const sale = sales.find((row) => customerKey(row) === value && row.remainingCredit > 0 && row.items.some((item) => item.quantity > item.returnedQuantity));
    setSaleId(sale?.id ?? "");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setNotice("");
    if (!selectedSale || !returnLines.length) { setNotice("Dooro invoice-ka oo geli tirada alaabta ama adeegga la soo celiyey."); return; }
    if (exceedsDebt) { setNotice("Qiimaha alaabta la soo celiyey kama badnaan karo deynta invoice-ka."); return; }
    setSaving(true);
    try {
      const response = await fetch("/api/order-management/credit-note", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ saleId: selectedSale.id, items: returnLines, notes }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Credit note lama samayn karin.");
      setNotice(`Credit note ${amount(Number(payload.data.amount))} waa la diiwaangeliyey; deynta invoice-ka waa la dhimay.`);
      setQuantities({}); setNotes("");
      await loadSales();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Credit note lama samayn karin."); }
    finally { setSaving(false); }
  }

  return <div className="credit-page"><form className="credit-card" onSubmit={submit}>
    <header className="credit-heading"><h1>Credit Note · {branchName}</h1><span>Alaab/adeeg la soo celiyey · deynta invoice-ka ayaa laga jarayaa</span></header>
    <div className="credit-top"><label>Macmiil / Pharmacy<select value={customer} onChange={(event) => chooseCustomer(event.target.value)}><option value="">Dooro macmiil</option>{customers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Taariikh<input type="date" value={new Date().toISOString().slice(0, 10)} readOnly /></label></div>
    <label className="credit-sale">Invoice<select value={saleId} onChange={(event) => { setSaleId(event.target.value); setQuantities({}); }} disabled={!customerSales.length}><option value="">Dooro invoice</option>{customerSales.map((sale) => <option key={sale.id} value={sale.id}>{new Date(sale.date).toLocaleString()} · {sale.type} · Deyn {amount(sale.remainingCredit)}</option>)}</select></label>
    <div className="credit-table"><div className="credit-table-head"><span>Alaab / adeeg</span><span>La iibiyey</span><span>Qiime</span><span>Tirada la celiyey</span><span>Wadarta</span></div>
      {loading ? <div className="credit-empty">Xogta iibka waa la soo rariyaa…</div> : selectedSale?.items.length ? selectedSale.items.map((item) => {
        const maxReturn = item.quantity - item.returnedQuantity;
        const quantity = quantities[item.productId] || 0;
        return <div className="credit-row" key={item.productId}><strong>{item.name}<small>{item.type === "PHARMACY" ? "Dawo · stock ayaa lagu celinayaa" : "Adeeg"}</small></strong><span>{item.quantity}</span><span>{amount(item.unitPrice)}</span><input aria-label={`Tirada ${item.name} la celinayo`} type="number" min="0" max={maxReturn} step="1" value={quantity || ""} placeholder={`0 / ${maxReturn}`} onChange={(event) => setQuantities((old) => ({ ...old, [item.productId]: Math.max(0, Math.min(maxReturn, Math.floor(Number(event.target.value) || 0))) }))} /><output>{amount(quantity * item.unitPrice)}</output></div>;
      }) : <div className="credit-empty">Dooro macmiil iyo invoice si alaabtii/adeeggii la iibiyey u muuqdo.</div>}
    </div>
    <div className="credit-totals"><label>Qiimaha invoice-ka<output>{amount(selectedSale?.total ?? 0)}</output></label><label>Deynta hadda<output className="credit-discount">{amount(selectedSale?.remainingCredit ?? 0)}</output></label><label>Qiimaha la celinayo<output>{amount(returnAmount)}</output></label><label>Deynta kadib<output className={exceedsDebt ? "credit-discount" : ""}>{amount(Math.max(0, (selectedSale?.remainingCredit ?? 0) - returnAmount))}</output></label></div>
    <div className="credit-payment"><label className="note">Faahfaahin<textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Sababta soo celinta ama faahfaahin kale…" /></label></div>
    {notice && <p className="credit-notice" role="status">{notice}</p>}<button className="credit-confirm" disabled={saving || loading || !returnLines.length || exceedsDebt}>{saving ? "Waa la kaydinayaa…" : "Xaqiiji Credit Note"}</button>
  </form></div>;
}
