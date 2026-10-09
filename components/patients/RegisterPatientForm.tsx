"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function RegisterPatientForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    const age = String(form.get("age") ?? "");
    const body = { fullName: String(form.get("fullName") ?? "").trim(), phone: String(form.get("phone") ?? "").trim(), email: String(form.get("email") ?? "").trim(), ...(age ? { age: Number(age) } : {}), gender: String(form.get("gender") ?? "") };
    try {
      const response = await fetch("/api/patients", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Bukaanka lama diiwaangelin karin.");
      router.push("/patients/list"); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Bukaanka lama diiwaangelin karin."); }
    finally { setBusy(false); }
  }

  return <main className="patient-form-page">
    <form className="patient-form-card" onSubmit={submit}>
      <header className="patient-form-header"><div><span className="patient-form-kicker">PATIENT CARE</span><h1>Register patient</h1><p>Buuxi xogta bukaanka si aad ugu diiwaangeliso branch-kan.</p></div><span className="patient-form-icon" aria-hidden="true">＋</span></header>
      <div className="patient-form-fields">
        <label className="patient-form-field wide">Full name <span>*</span><input name="fullName" autoComplete="name" placeholder="Geli magaca bukaanka" required minLength={2} maxLength={160} /></label>
        <label className="patient-form-field">Phone<input name="phone" type="tel" autoComplete="tel" placeholder="Taleefanka" maxLength={40} /></label>
        <label className="patient-form-field">Email<input name="email" type="email" autoComplete="email" placeholder="name@example.com" /></label>
        <label className="patient-form-field">Age<input name="age" type="number" min="0" max="125" placeholder="Da'da" /></label>
        <label className="patient-form-field">Gender<select name="gender" defaultValue=""><option value="">Select gender</option><option value="Female">Female</option><option value="Male">Male</option><option value="Other">Other</option></select></label>
      </div>
      {error && <p className="patient-form-error" role="alert">{error}</p>}
      <footer className="patient-form-footer"><button type="button" className="patient-form-cancel" onClick={() => router.push("/patients/list")}>Cancel</button><button className="patient-form-submit" disabled={busy}>{busy ? "Saving…" : "Save patient"}</button></footer>
    </form>
  </main>;
}
