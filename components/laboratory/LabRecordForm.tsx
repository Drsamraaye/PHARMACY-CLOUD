"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";

type Person = { id: string; fullName: string; phone?: string | null };
export const labGroups: Array<{ title: string; fields: string[] }> = [
  { title: "Urine Analysis", fields: ["Macroscope", "Quantity", "Appearance", "Ph", "Specific Gravity", "Urobilinogen", "Nitrate", "Blood", "Bilirubin", "Leucocytes", "Ketone", "Protein", "Glucose", "Epithelial Cells", "WBCs", "RBCs", "Bacteria", "Yeast cells", "Casts", "Crystals", "Others"] },
  { title: "Clinical chemistry", fields: ["Urea", "Albumin", "Sodium", "Amylase", "Creatinine", "Total Protein", "Potassium", "Lipase", "Uric Acid", "T_cholestrol", "Calcium", "Troponin", "AST (GOT)", "HDL", "chloride", "Rbs", "ALT (GPT)", "LDL", "CK-mb", "Fbs", "T.Bilirubin", "ALP", "Ldb", "D_Bilirubin", "Triglyceride"] },
  { title: "Serology & Virology", fields: ["Widal_Test", "CRP Alize", "HBSAg", "CMS", "Brucella", "Aso", "BSM", "HSV", "Hb", "ESR", "RVI", "Rubella", "Blood Group", "H.pylori Ab", "HCV", "S-HCG", "RPR", "Toxoplasma", "Viral Markers", "Torch", "RF Aliza", "HS CRP", "H. pylori (Antibody)", "HCG (Urine)", "HCG (Serum)"] },
  { title: "Stool Analysis", fields: ["Others", "microscopic", "mucos", "RBC", "H.pylori Ag", "Colour", "pus_cells", "parasites", "Consistency"] },
  { title: "Hormones", fields: ["IgE", "T3", "Prolactin", "FSH", "LH", "T4", "Progesterone", "Estradiol", "B-HCG", "TSH", "HBA1C", "Vitamin D"] },
  { title: "Dengue", fields: ["Dengue NS1 Antigen", "Dengue anti-body IgM", "Dengue anti-body (IgG)"] },
  { title: "TUMOR MARKERS", fields: ["PSA", "AFP", "CEA", "iF-OB"] },
  { title: "HEMATOLOGY", fields: ["ESR", "Hb/Hgb", "CBC", "Blood Group Type & Rh", "MPs (Malaria)", "Gram Stain", "Procalcitonin (PCT)"] },
  { title: "Diabetes", fields: ["RBS", "FBS", "GTT", "Triglyceride", "Cholesterol", "HDL", "LDL"] },
  { title: "LIVER FUNCTION", fields: ["SGOT/AST", "SGPT/ALT", "ALP", "T Bilirubin", "Direct Bilirubin", "Albumin", "Total Protein"] },
  { title: "RENAL FUNCTION", fields: ["S. Creatinine", "Uric Acid", "Creatinine", "BUN", "24Hr Urine Protein"] },
  { title: "ELECTROLYTES", fields: ["Sodium (k)", "Potassium (K)", "Calcium", "Chloride (Cl)", "Magnesium"] },
  { title: "Others", fields: ["Hga1c", "Vitamin D", "H. pylori Antigen", "Dengue Fever"] },
  { title: "CLINICAL MICROSCOPY", fields: ["Urine Exam", "Stool Exam", "Semen Analysis"] },
  { title: "FERTILITY / HORMONE", fields: ["S. Cortisol", "Estradiol", "Free B-HCG", "insulin", "LH", "prolactin", "Testosterone Test"] },
  { title: "ACID PHOSPHATASE", fields: ["Amylase", "GGT"] },
  { title: "CBC", fields: ["WBC", "Lymph#", "Mid#", "Gran#", "Lymph%", "Mid%", "Gran%", "RBC", "HGB", "HCT", "MCV", "MCH", "MCHC", "RDW-CV", "RDW-SD", "PLT", "MPV", "PDW", "PCT"] },
];

export default function LabRecordForm() {
  const [patients, setPatients] = useState<Person[]>([]); const [doctors, setDoctors] = useState<Person[]>([]);
  const [patientId, setPatientId] = useState(""); const [doctorId, setDoctorId] = useState("");
  const [requestId, setRequestId] = useState("");
  const [sectionOrder, setSectionOrder] = useState<string[]>([]);
  const [sampleDate, setSampleDate] = useState(new Date().toISOString().slice(0, 10)); const [reportDate, setReportDate] = useState(new Date().toISOString().slice(0, 10));
  const [remarks, setRemarks] = useState(""); const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  useEffect(() => { fetch("/api/laboratory/records/options", { cache: "no-store" }).then((r) => r.ok ? r.json() : null).then((p) => { setPatients(p?.data?.patients ?? []); setDoctors(p?.data?.doctors ?? []); }).catch(() => undefined); fetch("/api/laboratory/section-order", { cache: "no-store" }).then((r) => r.ok ? r.json() : null).then((p) => { const config = (p?.data ?? []).find((item: { kind?: string; sections?: string[] }) => item.kind === "lab-section-order"); if (Array.isArray(config?.sections)) setSectionOrder(config.sections); }).catch(() => undefined); const params = new URLSearchParams(window.location.search); setPatientId(params.get("patientId") ?? ""); setRequestId(params.get("requestId") ?? ""); }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    const patient = patients.find((item) => item.id === patientId); const doctor = doctors.find((item) => item.id === doctorId);
    const results = Object.fromEntries(Object.entries(values).filter(([, value]) => value.trim()).map(([key, value]) => [key, value.trim()]));
    try {
      const response = await fetch("/api/laboratory/records", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ patientId, patientName: patient?.fullName ?? "", patientPhone: patient?.phone ?? "", doctorId, doctorName: doctor?.fullName ?? "", requestId: requestId || null, receptionRequestId: requestId || null, sampleDate, reportDate, remarks, results }) });
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "Natiijada lama kaydin.");
      setNotice("Natiijada shaybaarka waa la kaydiyey."); setPatientId(""); setDoctorId(""); setRemarks(""); setValues({});
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Natiijada lama kaydin."); }
    finally { setBusy(false); }
  }
  const orderedGroups = [...labGroups].sort((a, b) => { const ai = sectionOrder.indexOf(a.title); const bi = sectionOrder.indexOf(b.title); return (ai < 0 ? labGroups.length : ai) - (bi < 0 ? labGroups.length : bi); });
  return <main className="lab-record-form-page"><form className="lab-record-form" onSubmit={submit}>
    <header className="lab-record-form-header"><div><span>⚕</span><strong>Add Lab Tests</strong></div><Link href="/patients/new">＋ Register New Patient</Link></header>
    <section className="lab-record-meta">
      <label>Patient <i>*</i><select required value={patientId} onChange={(event) => setPatientId(event.target.value)}><option value="">Select Patient</option>{patients.map((item) => <option value={item.id} key={item.id}>{item.fullName}{item.phone ? ` · ${item.phone}` : ""}</option>)}</select></label>
      <label>Doctor<select value={doctorId} onChange={(event) => setDoctorId(event.target.value)}><option value="">Select Doctor</option>{doctors.map((item) => <option value={item.id} key={item.id}>{item.fullName}</option>)}</select></label>
      <label>Sample Date <i>*</i><input required type="date" value={sampleDate} onChange={(event) => setSampleDate(event.target.value)} /></label>
      <label>Report Date<input type="date" value={reportDate} onChange={(event) => setReportDate(event.target.value)} /></label>
      <label className="lab-remarks">Remarks<textarea value={remarks} onChange={(event) => setRemarks(event.target.value)} rows={2} /></label>
    </section>
    {orderedGroups.map((group) => <section className="lab-result-group" key={group.title}><h2><span>⚕</span>{group.title}</h2><div className="lab-result-grid">{group.fields.map((field) => <label key={`${group.title}-${field}`}>{field}<input value={values[`${group.title}.${field}`] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [`${group.title}.${field}`]: event.target.value }))} /></label>)}</div></section>)}
    {error && <p className="lab-form-message error" role="alert">{error}</p>}{notice && <p className="lab-form-message success" role="status">{notice}</p>}
    <footer className="lab-record-form-footer"><button disabled={busy}>{busy ? "Saving…" : "Confirm"}</button></footer>
  </form></main>;
}
