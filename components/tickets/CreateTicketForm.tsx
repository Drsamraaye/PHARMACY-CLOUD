"use client";

import { FormEvent, useEffect, useState } from "react";

type Patient = { id: string; fullName: string; phone?: string | null; age?: number | null; gender?: string | null };
type TicketValues = { patientId: string; phone: string; name: string; address: string; doctor: string; ticketPrice: string; ticketType: string; paymentMethod: string; bloodPressure: string; pulseRate: string; temperature: string; respiratoryRate: string; glucose: string; oxygen: string; weight: string; maritalStatus: string; age: string; occupation: string };
const empty: TicketValues = { patientId: "", phone: "", name: "", address: "", doctor: "", ticketPrice: "", ticketType: "", paymentMethod: "", bloodPressure: "", pulseRate: "", temperature: "", respiratoryRate: "", glucose: "", oxygen: "", weight: "", maritalStatus: "Single", age: "", occupation: "" };

export default function CreateTicketForm() {
  const [values, setValues] = useState(empty);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [oldPatientMode, setOldPatientMode] = useState(false);
  const [patientSearch, setPatientSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => { fetch("/api/patients", { cache: "no-store" }).then((response) => response.ok ? response.json() : null).then((result) => setPatients(result?.data ?? [])).catch(() => setPatients([])); }, []);
  const patientMatches = patients.filter((patient) => `${patient.fullName} ${patient.phone ?? ""}`.toLocaleLowerCase().includes(patientSearch.trim().toLocaleLowerCase())).slice(0, 8);
  function update<K extends keyof TicketValues>(key: K, value: TicketValues[K]) { setValues((current) => ({ ...current, [key]: value })); }
  function usePatient(patient: Patient) { setValues((current) => ({ ...current, patientId: patient.id, name: patient.fullName, phone: patient.phone ?? "", age: patient.age == null ? current.age : String(patient.age) })); setPatientSearch(`${patient.fullName}${patient.phone ? ` · ${patient.phone}` : ""}`); }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    const record = { title: "Ticket", ...values, patientId: values.patientId || null, ticketPrice: values.ticketPrice ? Number(values.ticketPrice) : 0, age: values.age ? Number(values.age) : null };
    try {
      const response = await fetch("/api/tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(record) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "Ticket lama kaydin karin.");
      setNotice("Ticket-ka si guul leh ayaa loo diiwaangeliyey."); setValues(empty); setPatientSearch(""); setOldPatientMode(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Ticket lama kaydin karin."); }
    finally { setBusy(false); }
  }

  const basicFields: Array<[keyof TicketValues, string, string]> = [["phone", "Phone", "tel"], ["name", "Name", "text"], ["address", "Address", "text"], ["doctor", "Doctor", "text"], ["ticketPrice", "Ticket Price", "number"]];
  const vitals: Array<[keyof TicketValues, string]> = [["bloodPressure", "BP (Blood Pressure)"], ["pulseRate", "Pulse Rate (PR)"], ["temperature", "Temperature"], ["respiratoryRate", "Respiratory Rate (RR)"], ["glucose", "Glucose"], ["oxygen", "Oxygen"], ["weight", "KG"]];

  return <main className="ticket-create-page">
    <form className="ticket-create-card" onSubmit={submit}>
      <header className="ticket-create-header"><div><span className="ticket-create-icon" aria-hidden="true">＋</span><div><h1>Register New Ticket</h1><p>Geli xogta booqashada iyo bukaanka.</p></div></div><button type="button" className={`ticket-old-patient-toggle${oldPatientMode ? " active" : ""}`} onClick={() => { setOldPatientMode((current) => !current); setPatientSearch(""); setValues((current) => ({ ...current, patientId: "" })); }}>{oldPatientMode ? "Register a new patient" : "Register a ticket with an old patient"}</button></header>
      {oldPatientMode && <div className="ticket-existing-patient"><label htmlFor="ticket-patient-search">Find existing patient</label><input id="ticket-patient-search" role="combobox" aria-expanded={Boolean(patientSearch && patientMatches.length)} aria-controls="ticket-patient-options" placeholder="Search by name or phone" value={patientSearch} onChange={(event) => { setPatientSearch(event.target.value); update("patientId", ""); }} />{patientSearch && patientMatches.length > 0 && <ul id="ticket-patient-options">{patientMatches.map((patient) => <li key={patient.id}><button type="button" onClick={() => usePatient(patient)}>{patient.fullName}<span>{patient.phone || "No phone"}</span></button></li>)}</ul>}{values.patientId && <small>Selected patient: {values.name}</small>}</div>}
      <section className="ticket-create-section"><div className="ticket-section-mark"/><div className="ticket-create-grid">{basicFields.map(([key, label, type]) => <label key={key} className={`ticket-create-field${key === "address" ? " span-two" : ""}`}>{label}<input required={key === "name" || key === "phone"} type={type} min={type === "number" ? "0" : undefined} step={key === "ticketPrice" ? "0.01" : "1"} value={values[key]} onChange={(event) => update(key, event.target.value)} /></label>)}<label className="ticket-create-field">Ticket Type<select required value={values.ticketType} onChange={(event) => update("ticketType", event.target.value)}><option value="">-- Select Ticket Type --</option><option>Consultation</option><option>Emergency</option><option>Follow-up</option><option>Laboratory</option><option>Other</option></select></label><label className="ticket-create-field">Payment Method<select value={values.paymentMethod} onChange={(event) => update("paymentMethod", event.target.value)}><option value="">-- Select --</option><option>Cash</option><option>EVC Plus</option><option>Zaad</option><option>Bank</option></select></label></div></section>
      <section className="ticket-create-section"><div className="ticket-section-mark"/><div className="ticket-vitals-grid">{vitals.map(([key, label]) => <label className="ticket-create-field" key={key}>{label}<input type="number" min="0" step="any" value={values[key]} onChange={(event) => update(key, event.target.value)} /></label>)}</div></section>
      <section className="ticket-create-section ticket-create-section-last"><div className="ticket-section-mark"/><div className="ticket-create-grid"><label className="ticket-create-field">Marital Status<select value={values.maritalStatus} onChange={(event) => update("maritalStatus", event.target.value)}><option>Single</option><option>Married</option><option>Divorced</option><option>Widowed</option></select></label><label className="ticket-create-field">Age<input type="number" min="0" max="125" value={values.age} onChange={(event) => update("age", event.target.value)} /></label><label className="ticket-create-field">Occupation<input value={values.occupation} onChange={(event) => update("occupation", event.target.value)} /></label></div></section>
      {error && <p className="ticket-create-message error" role="alert">{error}</p>}{notice && <p className="ticket-create-message success" role="status">{notice}</p>}
      <footer className="ticket-create-footer"><button className="ticket-create-submit" disabled={busy}>{busy ? "Saving ticket…" : "Save Ticket"}</button></footer>
    </form>
  </main>;
}
