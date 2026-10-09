"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Employee = { id: string; fullname?: string; fullName?: string };
const purposes = ["Annual Leave", "Sick Leave", "Emergency Leave", "Maternity Leave", "Paternity Leave", "Unpaid Leave", "Other"];

export default function LeaveRegistration() {
  const router = useRouter(); const [employees, setEmployees] = useState<Employee[]>([]); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  useEffect(() => { fetch("/api/hr/employees", { cache: "no-store" }).then(async response => { const result = await response.json(); if (!response.ok) throw new Error(result.error || "Could not load employees."); setEmployees(Array.isArray(result.data) ? result.data : []); }).catch(cause => setError(cause instanceof Error ? cause.message : "Could not load employees.")).finally(() => setLoading(false)); }, []);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); setError(""); const form = new FormData(event.currentTarget); const employeeId = String(form.get("employeeId") || ""); const employee = employees.find(item => item.id === employeeId); const startDate = String(form.get("startDate") || ""), endDate = String(form.get("endDate") || ""); if (endDate < startDate) { setError("End date must be on or after the start date."); setBusy(false); return; } const payload = { employeeId, employeeName: employee?.fullname || employee?.fullName || "", leavePurpose: String(form.get("leavePurpose") || ""), startDate, endDate, remarks: String(form.get("remarks") || "").trim() }; try { const response = await fetch("/api/hr/leave", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); const result = await response.json(); if (!response.ok) throw new Error(result.error || "Leave request could not be saved."); router.push("/human-resource/leave/report"); router.refresh(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Leave request could not be saved."); } finally { setBusy(false); } }
  return <main className="hr-page"><section className="hr-card hr-leave-card"><header className="hr-card-title"><h1>Register Employee Leave</h1></header><form className="hr-leave-form" onSubmit={submit}>
    <label>Employee<b>*</b><select name="employeeId" required defaultValue=""><option value="">{loading ? "Loading employees..." : "Select Employee"}</option>{employees.map(employee => <option key={employee.id} value={employee.id}>{employee.fullname || employee.fullName || "Employee"}</option>)}</select></label>
    <label>Start Date <b>*</b><input name="startDate" required type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></label>
    <label>Select Leave Purpose<b>*</b><select name="leavePurpose" required defaultValue=""><option value="">Select Leave Purpose</option>{purposes.map(purpose => <option key={purpose}>{purpose}</option>)}</select></label>
    <label>End Date<b>*</b><input name="endDate" required type="date" /></label>
    <label className="hr-leave-remarks">Remarks<b>*</b><textarea name="remarks" required rows={8} /></label>
    {error && <p className="hr-error" role="alert">{error}</p>}
    <div className="hr-leave-submit"><button disabled={busy || loading || employees.length === 0}>{busy ? "Saving..." : "Save"}</button></div>
  </form></section></main>;
}
