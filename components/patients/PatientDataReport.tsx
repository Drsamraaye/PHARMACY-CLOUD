"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type SaleHistory = { id: string; date: string; total: number; paidAmount: number; status: string; type: string };
type PatientRow = { id: string; fullName: string; age: number | null; gender: string | null; phone: string | null; createdAt: string; purchases: number; totalSpent: number; lastVisit: string | null; sales: SaleHistory[] };
const cash = (value: number) => `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function PatientDataReport() {
  const [rows, setRows] = useState<PatientRow[]>([]);
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [selected, setSelected] = useState("");
  const [query, setQuery] = useState("");
  const [history, setHistory] = useState<PatientRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/order-management/patient-data-report?patientId=${encodeURIComponent(selected)}&search=${encodeURIComponent(query.trim())}`, { cache: "no-store" });
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "Patient report lama soo rari karin.");
      setRows(payload.data ?? []);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Patient report lama soo rari karin."); }
    finally { setLoading(false); }
  }, [selected, query]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { fetch("/api/patients").then((response) => response.ok ? response.json() : null).then((payload) => setPatients(payload?.data ?? [])).catch(() => setPatients([])); }, []);

  return <div className="patient-report-page"><section className="patient-report-card">
    <header className="patient-report-heading"><div><h1>Patient Data Report</h1><p>Warbixinta bukaannada iyo booqashooyinkooda.</p></div><Link href="/patients/new" className="patient-report-add">＋ Diiwaangeli bukaan</Link></header>
    <form className="patient-report-filters" onSubmit={(event) => { event.preventDefault(); void load(); }}><label><span>Bukaan</span><select value={selected} onChange={(event) => setSelected(event.target.value)}><option value="">-- All Patients --</option>{patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.fullName}</option>)}</select></label><label className="patient-search"><span>Raadi magac ama telefoon</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Raadi bukaan…" /></label><button type="submit">Filter</button></form>
    {error && <div className="patient-report-error" role="alert">{error}<button onClick={() => void load()}>Dib u tijaabi</button></div>}
    <div className="patient-report-table-wrap"><table className="patient-report-table"><thead><tr><th>#</th><th>Patient</th><th>Age</th><th>Gender</th><th>Phone</th><th>Date</th><th>Visits</th><th>Total Spent</th><th>Action</th></tr></thead><tbody>
      {loading ? <tr><td colSpan={9} className="patient-report-empty">Warbixinta waa la soo rarayaa…</td></tr> : !rows.length ? <tr><td colSpan={9} className="patient-report-empty">Bukaan xogtiisu jirto lama helin.</td></tr> : rows.map((patient, index) => <tr key={patient.id}><td>{index + 1}</td><td className="patient-name-cell">{patient.fullName}</td><td>{patient.age ?? "—"}</td><td>{patient.gender || "—"}</td><td>{patient.phone || "—"}</td><td>{patient.lastVisit ? new Date(patient.lastVisit).toLocaleDateString() : new Date(patient.createdAt).toLocaleDateString()}</td><td>{patient.purchases}</td><td>{cash(patient.totalSpent)}</td><td><button className="patient-history-button" onClick={() => setHistory(patient)}>View History</button></td></tr>)}
    </tbody></table></div>
    <footer className="patient-report-footer">{loading ? "" : `${rows.length} bukaan`}</footer>
  </section>
  {history && <div className="patient-history-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setHistory(null); }}><section className="patient-history-modal" role="dialog" aria-modal="true" aria-labelledby="patient-history-title"><header><div><span>BUKAAN</span><h2 id="patient-history-title">{history.fullName}</h2><p>{history.phone || "Telefoon lama diiwaangelin"} · {history.purchases} booqasho · {cash(history.totalSpent)}</p></div><button aria-label="Xir" onClick={() => setHistory(null)}>×</button></header><div className="patient-history-table-wrap"><table className="patient-report-table"><thead><tr><th>Taariikh</th><th>Nooca iibka</th><th>Xaalad</th><th>Wadarta</th><th>La bixiyey</th></tr></thead><tbody>{history.sales.length ? history.sales.map((sale) => <tr key={sale.id}><td>{new Date(sale.date).toLocaleString()}</td><td>{sale.type}</td><td>{sale.status}</td><td>{cash(sale.total)}</td><td>{cash(sale.paidAmount)}</td></tr>) : <tr><td colSpan={5} className="patient-report-empty">Bukaankan iib hore looma diiwaangelin.</td></tr>}</tbody></table></div></section></div>}
  </div>;
}
