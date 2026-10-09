"use client";

import { useCallback, useEffect, useState } from "react";

type Employee = { id: string; fullname?: string; fullName?: string; jobTitle?: string; jobShift?: string };
type Warning = { id: string; date?: string; employeeName?: string; employeeTimeOutOfRange?: string; role?: string; description?: string };
const fresh = { employeeId: "", employeeName: "", date: new Date().toISOString().slice(0, 10), employeeTimeOutOfRange: "", role: "", description: "" };

export default function EmployeeWarnings() {
  const [rows, setRows] = useState<Warning[]>([]); const [employees, setEmployees] = useState<Employee[]>([]);
  const [open, setOpen] = useState(false); const [form, setForm] = useState(fresh); const [loading, setLoading] = useState(true);
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [warningsResponse, employeesResponse] = await Promise.all([fetch("/api/hr/warnings", { cache: "no-store" }), fetch("/api/hr/employees", { cache: "no-store" })]);
      const [warnings, staff] = await Promise.all([warningsResponse.json(), employeesResponse.json()]);
      if (!warningsResponse.ok) throw new Error(warnings.error || "Could not load warnings.");
      setRows(Array.isArray(warnings.data) ? warnings.data : []); setEmployees(Array.isArray(staff.data) ? staff.data : []);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load warnings."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  function chooseEmployee(id: string) { const employee = employees.find(item => item.id === id); setForm(old => ({ ...old, employeeId: id, employeeName: employee?.fullname || employee?.fullName || "", role: employee?.jobTitle || "" })); }
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const { employeeId, ...data } = form;
    if (!employeeId) { setError("Select an employee first."); setBusy(false); return; }
    try {
      const response = await fetch("/api/hr/warnings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "Warning could not be saved.");
      setOpen(false); setForm(fresh); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Warning could not be saved."); }
    finally { setBusy(false); }
  }
  async function remove(row: Warning) {
    if (!window.confirm(`Delete warning for ${row.employeeName || "this employee"}?`)) return;
    try { const response = await fetch("/api/hr/warnings", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: row.id }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error || "Could not delete warning."); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not delete warning."); }
  }
  return <main className="hr-page"><section className="hr-card"><header className="hr-warning-heading"><h1>Warnings Report</h1><button onClick={() => { setError(""); setForm(fresh); setOpen(true); }}>Add New</button></header>
    <div className="hr-warning-toolbar"><button onClick={() => window.print()}>Lama xadidin karo</button></div>
    {error && !open && <p className="hr-error">{error}</p>}
    <div className="hr-table-wrap"><table className="hr-table"><thead><tr><th>#</th><th>Date</th><th>Employee Time is out of range</th><th>Role</th><th>Description of Warning</th><th>Action</th></tr></thead><tbody>
      {loading ? <tr><td colSpan={6} className="hr-empty">Loading...</td></tr> : rows.length === 0 ? <tr><td colSpan={6} className="hr-empty">No warnings found.</td></tr> : rows.map((row, index) => <tr key={row.id}><td>{index + 1}</td><td>{row.date ? new Date(row.date).toLocaleDateString() : "—"}</td><td>{row.employeeTimeOutOfRange || row.employeeName || "—"}</td><td>{row.role || "—"}</td><td>{row.description || "—"}</td><td><button className="hr-delete" onClick={() => void remove(row)}>Delete</button></td></tr>)}
    </tbody></table></div>
  </section>
  {open && <div className="hr-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setOpen(false); }}><form className="hr-modal" onSubmit={save}><header><h2>Add Employee Warning</h2><button type="button" onClick={() => setOpen(false)}>×</button></header>
    <label>Employee<select required value={form.employeeId} onChange={event => chooseEmployee(event.target.value)}><option value="">Select employee</option>{employees.map(employee => <option key={employee.id} value={employee.id}>{employee.fullname || employee.fullName || "Employee"}</option>)}</select></label>
    <label>Date<input required type="date" value={form.date} onChange={event => setForm({ ...form, date: event.target.value })} /></label>
    <label>Employee time is out of range<input required value={form.employeeTimeOutOfRange} onChange={event => setForm({ ...form, employeeTimeOutOfRange: event.target.value })} placeholder="e.g. 2 hours late" /></label>
    <label>Role<input value={form.role} onChange={event => setForm({ ...form, role: event.target.value })} /></label>
    <label>Description of warning<textarea required rows={3} value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} /></label>
    {error && <p className="hr-error">{error}</p>}<footer><button type="button" className="hr-cancel" onClick={() => setOpen(false)}>Cancel</button><button disabled={busy}>{busy ? "Saving..." : "Save"}</button></footer>
  </form></div>}
  </main>;
}
