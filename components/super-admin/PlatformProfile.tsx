"use client";

import { FormEvent, useEffect, useState } from "react";

type Profile = { fullName: string; email: string; role: string };

export default function PlatformProfile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/auth/session", { cache: "no-store" }).then(async (response) => {
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not load profile");
      setProfile(payload.data);
    }).catch((reason) => setError(reason instanceof Error ? reason.message : "Could not load profile")).finally(() => setLoading(false));
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!profile) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/auth/session", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(profile) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not update profile");
      setProfile(payload.data); setMessage("Profile-kaaga waa la kaydiyey.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not update profile"); }
    finally { setSaving(false); }
  }

  return <div className="platform-page">
    <header className="platform-page-heading"><div><span className="platform-eyebrow">YOUR ACCOUNT</span><h1>My profile</h1><p>Arag oo cusboonaysii xogta akoonkaaga Super Admin.</p></div></header>
    {error && <p className="platform-alert" role="alert">{error}</p>}{message && <p className="platform-success" role="status">{message}</p>}
    {loading ? <section className="platform-panel platform-empty">Loading your profile…</section> : profile && <section className="platform-panel platform-profile-panel">
      <div className="platform-profile-summary"><span className="platform-profile-avatar">{profile.fullName.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span><div><h2>{profile.fullName}</h2><p>{profile.role === "SUPER_ADMIN" ? "Platform administrator" : profile.role}</p></div><span className="platform-status is-active"><i />Secure account</span></div>
      <form className="platform-form-grid" onSubmit={(event) => void save(event)}>
        <label>Magaca buuxa<input value={profile.fullName} onChange={(event) => setProfile({ ...profile, fullName: event.target.value })} required minLength={2} maxLength={120} /></label>
        <label>Email<input type="email" value={profile.email} onChange={(event) => setProfile({ ...profile, email: event.target.value })} required maxLength={254} /></label>
        <label>Account role<input value={profile.role} readOnly /></label>
        <div className="platform-form-actions"><button className="platform-primary-link platform-button" disabled={saving}>{saving ? "Waa la kaydinayaa…" : "Save profile"}</button></div>
      </form>
    </section>}
  </div>;
}
