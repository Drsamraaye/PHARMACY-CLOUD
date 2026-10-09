"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type LabTest = { name?: string; sectionName?: string; section?: string; tests?: Array<{ name: string; normalRange?: string }> };
type Choice = { key: string; name: string; section: string };
export default function DefaultValuesLinkForm() {
  const [sections, setSections] = useState<LabTest[]>([]);
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => { fetch("/api/laboratory/tests", { cache: "no-store" }).then(async (r) => { const p = await r.json(); if (!r.ok) throw new Error(p.error || "Tests lama soo rari karin."); setSections(Array.isArray(p.data) ? p.data : []); }).catch((e) => setError(e instanceof Error ? e.message : "Tests lama soo rari karin.")); }, []);
  const choices = useMemo<Choice[]>(() => sections.flatMap((section, index) => (section.tests?.length ? section.tests : section.name ? [{ name: section.name }] : []).map((test, testIndex) => ({ key: `${index}:${testIndex}`, name: test.name, section: section.sectionName ?? section.section ?? "Laboratory" }))), [sections]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    const choice = choices.find((item) => item.key === selected);
    if (!choice) { setError("Dooro test marka hore."); setBusy(false); return; }
    try {
      const response = await fetch("/api/laboratory/default-values", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "test-default-link", testName: choice.name, sectionName: choice.section }) });
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "Default values lama xiriirin karin.");
      setNotice(`${choice.name} waxaa lagu xiray default values.`); setSelected("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Default values lama xiriirin karin."); } finally { setBusy(false); }
  }
  return <main className="lab-default-link-page"><form className="lab-default-link-card" onSubmit={submit}><header>Link Test to Default Values</header><div><label htmlFor="default-test">Select Test</label><select id="default-test" value={selected} onChange={(e) => setSelected(e.target.value)} required><option value="">-- Select Test --</option>{choices.map((choice) => <option key={choice.key} value={choice.key}>{choice.name} · {choice.section}</option>)}</select>{error && <p className="lab-form-message error" role="alert">{error}</p>}{notice && <p className="lab-form-message success" role="status">{notice}</p>}<button disabled={busy || !choices.length}>{busy ? "Saving…" : "Save"}</button></div></form></main>;
}
