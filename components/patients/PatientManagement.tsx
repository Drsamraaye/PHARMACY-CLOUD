"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Patient = { id: string; fullName: string; phone?: string | null; email?: string | null; age?: number | null; gender?: string | null; createdAt?: string; deletedAt?: string | null };

export default function PatientManagement() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [deletedCount, setDeletedCount] = useState(0);
  const [balance, setBalance] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Patient | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/patients", { cache: "no-store" }).then((response) => response.ok ? response.json() : Promise.reject(new Error("Patients could not be loaded."))),
      fetch("/api/patients/deleted", { cache: "no-store" }).then((response) => response.ok ? response.json() : null),
      fetch("/api/reports/customer-balance", { cache: "no-store" }).then((response) => response.ok ? response.json() : null),
    ]).then(([activePatients, deleted, balances]) => {
      if (!active) return;
      setPatients(activePatients.data ?? []);
      setDeletedCount(deleted?.data?.length ?? 0);
      setBalance(Array.isArray(balances?.data) ? balances.data.reduce((sum: number, row: { due?: number }) => sum + Number(row.due ?? 0), 0) : null);
    }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Patients could not be loaded."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const matches = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return term ? patients.filter((patient) => `${patient.fullName} ${patient.phone ?? ""}`.toLocaleLowerCase().includes(term)).slice(0, 8) : [];
  }, [patients, query]);
  const newThisMonth = patients.filter((patient) => {
    if (!patient.createdAt) return false;
    const date = new Date(patient.createdAt); const now = new Date();
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  }).length;

  return <main className="patient-management-page">
    <header className="patient-management-banner"><div><span className="patient-management-kicker">WORKSPACE · PATIENT CARE</span><h1>Patient Management</h1><p>Hal meel ka eeg xogta bukaanka, xiriirka iyo diiwaanka iibkiisa.</p></div><Link href="/patients/new" className="patient-management-add"><span aria-hidden="true">＋</span> Add New Patient</Link></header>
    {error && <p className="patient-management-error" role="alert">{error}</p>}
    <section className="patient-management-metrics" aria-label="Patient summary">
      <article><span>ACTIVE PATIENTS</span><strong>{loading ? "—" : patients.length.toLocaleString()}</strong><small>Patients in this branch</small></article>
      <article><span>TOTAL BALANCE</span><strong>{balance === null ? "—" : balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong><small>{balance === null ? "Balance summary unavailable" : "Outstanding customer balance"}</small></article>
      <article className="new"><span>NEW THIS MONTH</span><strong>{loading ? "—" : newThisMonth.toLocaleString()}</strong><small>Recently registered</small></article>
      <article className="deleted"><span>DELETED PATIENTS</span><strong>{loading ? "—" : deletedCount.toLocaleString()}</strong><small>Archived records</small></article>
    </section>
    <section className="patient-management-panel patient-find-panel">
      <header><h2><span aria-hidden="true">⌕</span> Find Patient</h2><small>Select a patient to view their profile.</small></header>
      <div className="patient-find-field"><label htmlFor="patient-search">Patient</label><input id="patient-search" role="combobox" aria-expanded={open && matches.length > 0} aria-controls="patient-search-options" aria-autocomplete="list" placeholder="Search patient by name or phone" value={query} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 120)} onChange={(event) => { setQuery(event.target.value); setOpen(true); setSelected(null); }} />
        {open && matches.length > 0 && <ul id="patient-search-options" className="patient-search-options" role="listbox">{matches.map((patient) => <li key={patient.id} role="option" aria-selected={selected?.id === patient.id}><button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { setSelected(patient); setQuery(patient.fullName); setOpen(false); }}>{patient.fullName}<span>{patient.phone || "No phone"}</span></button></li>)}</ul>}
      </div>
    </section>
    <section className="patient-management-panel patient-selected-panel">
      <header><h2><span aria-hidden="true">▣</span> Selected Patient</h2><span className="patient-selected-count">{selected ? "1 selected" : "0 selected"}</span></header>
      {selected ? <div className="patient-profile-grid"><div className="patient-profile-identity"><span className="patient-avatar">{selected.fullName.slice(0, 1).toUpperCase()}</span><div><strong>{selected.fullName}</strong><small>Patient profile</small></div></div><div><small>PHONE</small><strong>{selected.phone || "—"}</strong></div><div><small>EMAIL</small><strong>{selected.email || "—"}</strong></div><div><small>AGE / GENDER</small><strong>{selected.age ?? "—"} / {selected.gender || "—"}</strong></div><div><small>REGISTERED</small><strong>{selected.createdAt ? new Date(selected.createdAt).toLocaleDateString() : "—"}</strong></div></div> : <div className="patient-selected-empty"><span aria-hidden="true">♟</span><strong>No patient selected</strong><p>Use the searchable field above. Choose a patient to see their profile here.</p></div>}
    </section>
    <Link href="/patients/deleted" className="patient-archive-link"><span><strong>Deleted Patients</strong><small>Archived records are hidden from active patient lists.</small></span><span className="patient-archive-actions"><b>{deletedCount} deleted</b><i>View Archive →</i></span></Link>
  </main>;
}
