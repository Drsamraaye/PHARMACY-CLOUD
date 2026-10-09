"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type Ticket = { id: string; createdAt?: string; creatorName?: string; name?: string; patientName?: string; phone?: string; address?: string; doctor?: string; ticketType?: string; type?: string; ticketPrice?: number | string; bloodPressure?: string; pulseRate?: string; temperature?: string; respiratoryRate?: string; glucose?: string; oxygen?: string; weight?: string; [key: string]: unknown };
const isoDate = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;

export default function TicketReport() {
  const today = isoDate(new Date());
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);
  const [doctor, setDoctor] = useState("All");
  const [patient, setPatient] = useState("All");
  const [user, setUser] = useState("All");
  const [dateOption, setDateOption] = useState("With Date");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/tickets/report", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Warbixinta tickets-ka lama soo gelin.");
      setTickets(Array.isArray(payload.data) ? payload.data : []);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Warbixinta lama soo gelin."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const doctors = useMemo(() => [...new Set(tickets.map((item) => String(item.doctor ?? "").trim()).filter(Boolean))].sort(), [tickets]);
  const patients = useMemo(() => [...new Set(tickets.map((item) => String(item.name ?? item.patientName ?? "").trim()).filter(Boolean))].sort(), [tickets]);
  const users = useMemo(() => [...new Set(tickets.map((item) => String(item.creatorName ?? "").trim()).filter((name) => name && name !== "—"))].sort(), [tickets]);
  const filtered = useMemo(() => tickets.filter((item) => {
    const created = item.createdAt ? new Date(item.createdAt) : null;
    const day = created ? isoDate(created) : "";
    const selectedPatient = String(item.name ?? item.patientName ?? "");
    return (dateOption === "Without Date" || !day || (day >= start && day <= end))
      && (doctor === "All" || String(item.doctor ?? "") === doctor)
      && (patient === "All" || selectedPatient === patient)
      && (user === "All" || String(item.creatorName ?? "") === user);
  }), [tickets, dateOption, start, end, doctor, patient, user]);

  return <main className="ticket-report-page">
    <section className="ticket-report-card">
      <header className="ticket-report-header"><div><span className="ticket-report-mark">▤</span><div><h1>Tickets Report</h1><p>Raadi oo dib u eeg booqashooyinka branch-kan.</p></div></div><Link href="/tickets/add" className="ticket-report-add">＋ Add New</Link></header>
      <div className="ticket-report-filters">
        <label>Start Date<input type="date" value={start} onChange={(event) => setStart(event.target.value)} disabled={dateOption === "Without Date"} /></label>
        <label>End Date<input type="date" value={end} onChange={(event) => setEnd(event.target.value)} disabled={dateOption === "Without Date"} /></label>
        <label>Doctor<select value={doctor} onChange={(event) => setDoctor(event.target.value)}><option>All</option>{doctors.map((name) => <option key={name}>{name}</option>)}</select></label>
        <label>Patient<select value={patient} onChange={(event) => setPatient(event.target.value)}><option>All</option>{patients.map((name) => <option key={name}>{name}</option>)}</select></label>
        <label>Users<select value={user} onChange={(event) => setUser(event.target.value)}><option>All</option>{users.map((name) => <option key={name}>{name}</option>)}</select></label>
        <label>Date Option<select value={dateOption} onChange={(event) => setDateOption(event.target.value)}><option>With Date</option><option>Without Date</option></select></label>
        <button className="ticket-report-filter-button" onClick={() => void load()} disabled={loading}>⌕ &nbsp;{loading ? "Loading…" : "Filter / Refresh"}</button>
        <span className="ticket-report-count">{filtered.length} ticket{filtered.length === 1 ? "" : "s"}</span>
      </div>
      {error && <p className="ticket-report-error" role="alert">{error}</p>}
      <div className="ticket-report-table-wrap"><table className="ticket-report-table"><thead><tr><th>#</th><th>Date</th><th>User</th><th>Patient</th><th>Phone</th><th>Address</th><th>Doctor</th><th>Type</th><th>Price</th><th>BP</th><th>PR</th><th>Temperature</th><th>RR</th><th>Glucose</th><th>Oxygen</th><th>KG</th></tr></thead><tbody>
        {loading ? <tr><td colSpan={16} className="ticket-report-empty">Loading tickets…</td></tr> : filtered.length === 0 ? <tr><td colSpan={16} className="ticket-report-empty"><span>▤</span><strong>No tickets found</strong><small>Isku day inaad beddesho taariikhda ama filter-rada.</small></td></tr> : filtered.map((item, index) => <tr key={item.id}><td>{index + 1}</td><td>{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "—"}</td><td>{item.creatorName ?? "—"}</td><td>{item.name ?? item.patientName ?? "—"}</td><td>{item.phone ?? "—"}</td><td>{item.address ?? "—"}</td><td>{item.doctor ?? "—"}</td><td>{item.ticketType ?? item.type ?? "—"}</td><td>{item.ticketPrice == null ? "—" : Number(item.ticketPrice).toLocaleString()}</td><td>{item.bloodPressure ?? "—"}</td><td>{item.pulseRate ?? "—"}</td><td>{item.temperature ?? "—"}</td><td>{item.respiratoryRate ?? "—"}</td><td>{item.glucose ?? "—"}</td><td>{item.oxygen ?? "—"}</td><td>{item.weight ?? "—"}</td></tr>)}
      </tbody></table></div>
      <footer className="ticket-report-footer"><span>Showing {filtered.length} of {tickets.length} tickets</span><button onClick={() => void load()} disabled={loading}>↻ Refresh</button></footer>
    </section>
  </main>;
}
