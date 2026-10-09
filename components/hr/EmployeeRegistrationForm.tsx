"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

const fields = [
  ["fullname", "Fullname", "text", true], ["phone", "Phone", "tel", true], ["mobile2", "Mobile 2", "tel", false],
  ["mobile3", "Mobile 3", "tel", false], ["vacationDays", "Vacation Days", "number", true], ["educationLevel", "Education Level", "text", true],
  ["address", "Address", "text", true], ["jobShift", "Job Shift", "select", true], ["jobTitle", "Job Title", "text", true],
  ["taxRate", "Tax Rate", "number", true], ["salary", "Salary", "number", true],
] as const;

export default function EmployeeRegistrationForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    const uploads: { name: string; dataUrl: string }[] = [];
    try {
      for (const key of ["employeeFile1", "employeeFile2", "employeeFile3"]) {
        const file = form.get(key);
        if (file instanceof File && file.size) {
          if (file.size > 1_500_000) throw new Error(`${file.name} is too large. Keep each file under 1.5 MB.`);
          const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error("Could not read an uploaded file.")); reader.readAsDataURL(file); });
          uploads.push({ name: file.name, dataUrl });
        }
      }
      const payload: Record<string, unknown> = {};
      for (const [key] of fields) payload[key] = String(form.get(key) ?? "").trim();
      payload.uploads = uploads;
      const response = await fetch("/api/hr/employees", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Employee could not be saved.");
      router.push("/human-resource/employees"); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Employee could not be saved."); }
    finally { setBusy(false); }
  }
  return <main className="hr-page"><section className="hr-card"><header className="hr-card-title"><h1>New Employee Registration Page</h1></header><form className="hr-employee-form" onSubmit={submit}>
    {fields.map(([key, label, type, required]) => <label key={key}>{label}{required && <b>*</b>}{type === "select" ? <select name={key} required defaultValue=""><option value="" disabled>Please Select</option><option>Morning</option><option>Evening</option><option>Night</option><option>Day</option><option>Full time</option><option>Part time</option></select> : <input name={key} type={type} required={required} min={type === "number" ? "0" : undefined} step={key === "salary" || key === "taxRate" ? "any" : undefined} defaultValue={key === "vacationDays" || key === "taxRate" ? "0" : undefined} />}</label>)}
    {[1, 2, 3].map(index => <label key={index}>Upload Employee Files {index}<input name={`employeeFile${index}`} type="file" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" /></label>)}
    {error && <p className="hr-error" role="alert">{error}</p>}<div className="hr-submit"><button disabled={busy}>{busy ? "Saving..." : "Save"}</button></div>
  </form></section></main>;
}
