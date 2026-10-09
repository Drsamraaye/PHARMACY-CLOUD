"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type Patient = { id: string; fullName: string; phone?: string | null; email?: string | null; age?: number | null; gender?: string | null; deletedAt?: string | null };
const empty = { fullName: "", phone: "", email: "", age: "", gender: "" };

export default function DeletedPatients() {
  const [rows, setRows] = useState<Patient[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<Patient | null>(null);
  const [values, setValues] = useState(empty);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/patients/deleted", { cache: "no-store" }); const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Deleted patients could not be loaded.");
      setRows(result.data ?? []);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Deleted patients could not be loaded."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return rows.filter((patient) => !term || `${patient.fullName} ${patient.phone ?? ""} ${patient.email ?? ""}`.toLocaleLowerCase().includes(term));
  }, [query, rows]);

  function beginEdit(patient: Patient) {
    setEditing(patient); setValues({ fullName: patient.fullName, phone: patient.phone ?? "", email: patient.email ?? "", age: patient.age == null ? "" : String(patient.age), gender: patient.gender ?? "" }); setError("");
  }

  async function saveEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!editing) return;
    setBusyId(editing.id); setError("");
    try {
      const response = await fetch(`/api/patients/${encodeURIComponent(editing.id)}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...values, age: values.age ? Number(values.age) : null, email: values.email || null, phone: values.phone || null, gender: values.gender || null }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "Patient details could not be saved.");
      setEditing(null); setNotice(`${values.fullName} updated.`); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Patient details could not be saved."); }
    finally { setBusyId(""); }
  }

  async function restore(patient: Patient) {
    setBusyId(patient.id); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/patients/${encodeURIComponent(patient.id)}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ restore: true }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "Patient could not be restored.");
      setNotice(`${patient.fullName} restored to active patients.`); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Patient could not be restored."); }
    finally { setBusyId(""); }
  }

  return <main className="deleted-patients-page">
    <section className="deleted-patients-card">
      <header className="deleted-patients-header"><div><span className="patient-form-kicker">PATIENT ARCHIVE</span><h1>Deleted Patients</h1><p>Review archived records and restore patients when needed.</p></div><Link href="/patients/new" className="patient-management-add"><span aria-hidden="true">＋</span> Add New Patient</Link></header>
      <div className="deleted-patients-toolbar"><label htmlFor="deleted-patient-search">Search archive</label><input id="deleted-patient-search" placeholder="Search by patient name, phone or email" value={query} onChange={(event) => setQuery(event.target.value)} /><button type="button" onClick={() => void load()} disabled={loading}>{loading ? "Loading…" : "Refresh"}</button><span>{filtered.length} archived</span></div>
      {error && !editing && <p className="patient-management-error" role="alert">{error}</p>}{notice && <p className="patient-management-notice" role="status">{notice}</p>}
      <div className="deleted-patients-table-wrap"><table className="deleted-patients-table"><thead><tr><th>#</th><th>Deleted date</th><th>Patient</th><th>Phone</th><th>Age</th><th>Gender</th><th>Email</th><th>Actions</th></tr></thead><tbody>
        {loading ? <tr><td colSpan={8} className="deleted-patients-empty">Loading archived patients…</td></tr> : filtered.length === 0 ? <tr><td colSpan={8} className="deleted-patients-empty">No archived patients found.</td></tr> : filtered.map((patient, index) => <tr key={patient.id}><td>{index + 1}</td><td>{patient.deletedAt ? new Date(patient.deletedAt).toLocaleString() : "—"}</td><td><strong>{patient.fullName}</strong></td><td>{patient.phone || "—"}</td><td>{patient.age ?? "—"}</td><td>{patient.gender || "—"}</td><td>{patient.email || "—"}</td><td className="deleted-patient-actions"><button type="button" onClick={() => beginEdit(patient)}>Edit</button><button type="button" className="restore" disabled={busyId === patient.id} onClick={() => void restore(patient)}>{busyId === patient.id ? "Restoring…" : "Restore"}</button></td></tr>)}
      </tbody></table></div>
    </section>
    {editing && <div className="product-edit-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditing(null); }}><form className="product-edit-modal" role="dialog" aria-modal="true" aria-labelledby="deleted-patient-edit-title" onSubmit={saveEdit}><header className="product-edit-header"><div className="product-edit-heading-icon" aria-hidden="true">✎</div><div className="product-edit-heading-copy"><h2 id="deleted-patient-edit-title">Edit patient</h2><p>Update the patient’s archived profile.</p></div><button type="button" className="product-edit-close" aria-label="Close edit form" onClick={() => setEditing(null)}>×</button></header><div className="product-edit-grid"><label className="product-edit-field">Full name<input required minLength={2} maxLength={160} value={values.fullName} onChange={(event) => setValues((old) => ({ ...old, fullName: event.target.value }))} /></label><label className="product-edit-field">Phone<input type="tel" value={values.phone} onChange={(event) => setValues((old) => ({ ...old, phone: event.target.value }))} /></label><label className="product-edit-field">Email<input type="email" value={values.email} onChange={(event) => setValues((old) => ({ ...old, email: event.target.value }))} /></label><label className="product-edit-field">Age<input type="number" min="0" max="125" value={values.age} onChange={(event) => setValues((old) => ({ ...old, age: event.target.value }))} /></label><label className="product-edit-field">Gender<input value={values.gender} onChange={(event) => setValues((old) => ({ ...old, gender: event.target.value }))} /></label></div>{error && <p className="patient-edit-error" role="alert">{error}</p>}<footer className="product-edit-footer"><button type="button" className="product-edit-cancel" onClick={() => setEditing(null)}>Cancel</button><button className="product-edit-save" disabled={busyId === editing.id}>{busyId === editing.id ? "Saving…" : "Save changes"}</button></footer></form></div>}
  </main>;
}
