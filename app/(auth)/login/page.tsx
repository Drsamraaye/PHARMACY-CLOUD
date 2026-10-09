"use client";

import { FormEvent, useState } from "react";
import { canAccessPath } from "@/lib/role-access";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Email-ka ama password-ku sax ma aha. Mar kale isku day.");
        return;
      }

      if (result.data?.status === "inactive") {
        window.location.assign("/account-inactive");
        return;
      }

      const requestedPath = new URLSearchParams(window.location.search).get("next");
      const role = result.data?.role ?? "USER";
      const fallback = role === "SUPER_ADMIN" ? "/platform-analytics" : role === "PHARMACIST" ? "/order-management/pharmacy-sales" : "/home";
      const destination = requestedPath?.startsWith("/") && !requestedPath.startsWith("//") && canAccessPath(role, requestedPath)
        ? requestedPath
        : fallback;
      window.location.assign(destination);
    } catch {
      setError("Xiriirka ayaa go'ay. Hubi internet-kaaga oo mar kale isku day.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="login-card" aria-label="PharmaCloud sign in">
      <aside className="login-brand-panel">
        <div className="brand-topline">
          <span className="brand-mark" aria-hidden="true"><BrandMark /></span>
          <span className="brand-name">Pharma<span>Cloud</span></span>
        </div>

        <div className="brand-message">
          <span className="brand-eyebrow"><span className="status-dot" /> PHARMACY MANAGEMENT, SIMPLIFIED</span>
          <h1>Care for people.<br /><span>Clarity for your business.</span></h1>
          <p>Hal meel ka maamul farmashiyahaaga, bukaannadaada iyo kooxdaada.</p>
        </div>

        <div className="brand-illustration" aria-hidden="true">
          <div className="illustration-orbit orbit-one" />
          <div className="illustration-orbit orbit-two" />
          <div className="illustration-cross"><BrandMark /></div>
          <div className="floating-pill pill-one"><span /> Inventory <strong>Live</strong></div>
          <div className="floating-pill pill-two"><span /> Patient care</div>
          <div className="illustration-spark spark-one">✳</div>
          <div className="illustration-spark spark-two">✦</div>
        </div>

        <div className="brand-footer"><span>MAAMUL FUDUD. DARYEEL WANAAGSAN.</span><span className="footer-line" /></div>
      </aside>

      <div className="login-form-panel">
        <div className="mobile-brand"><span className="brand-mark" aria-hidden="true"><BrandMark /></span><span className="brand-name">Pharma<span>Cloud</span></span></div>
        <div className="form-heading">
          <span className="welcome-label">KU SOO DHAWOOW</span>
          <h2>Ku gal akoonkaaga</h2>
          <p>Geli xogtaada si aad u sii wadato.</p>
        </div>

        <form className="login-form" onSubmit={signIn}>
          <label className="login-field" htmlFor="email">
            <span>Email address</span>
            <span className="input-wrap"><span className="input-icon"><MailIcon /></span><input id="email" name="email" type="email" autoComplete="username" placeholder="magaca@farmashiye.com" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={loading} /></span>
          </label>

          <label className="login-field" htmlFor="password">
            <span>Password</span>
            <span className="input-wrap"><span className="input-icon"><LockIcon /></span><input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Geli password-kaaga" value={password} onChange={(event) => setPassword(event.target.value)} required disabled={loading} /><button className="password-toggle" type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Qari password-ka" : "Muuji password-ka"}><EyeIcon hidden={showPassword} /></button></span>
          </label>

          <div className="form-options"><span className="secure-hint"><ShieldIcon /> Xogtaadu waa ammaan</span><a href="/forgot-password">Password-ka ma illowday?</a></div>

          {error && <p className="login-error" role="alert">{error}</p>}

          <button className="login-submit" type="submit" disabled={loading}>
            {loading ? <><span className="spinner" /> Waa la gelayaa…</> : <>Gal akoonka <ArrowIcon /></>}
          </button>
        </form>

        <p className="signup-prompt">Ma leedahay shirkad cusub? <a href="/signup">Akoon sameyso <ArrowIcon /></a></p>
        <div className="form-legal">Markaad gasho, waxaad oggolaanaysaa isticmaalka adeegga PharmaCloud.</div>
      </div>
    </section>
  );
}

function BrandMark() {
  return <svg viewBox="0 0 40 40" fill="none"><rect x="2" y="2" width="36" height="36" rx="12" fill="currentColor" /><path d="M18 10h4v8h8v4h-8v8h-4v-8h-8v-4h8v-8Z" fill="white" /></svg>;
}

function MailIcon() {
  return <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><rect x="2.5" y="4" width="15" height="12" rx="2.5" stroke="currentColor" strokeWidth="1.5" /><path d="m4 6 6 4.5L16 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function LockIcon() {
  return <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><rect x="3.5" y="8" width="13" height="9" rx="2" stroke="currentColor" strokeWidth="1.5" /><path d="M6.5 8V5.5a3.5 3.5 0 0 1 7 0V8m-3.5 3.5v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>;
}

function EyeIcon({ hidden }: { hidden: boolean }) {
  return <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">{hidden ? <><path d="M2.2 10s2.8-5 7.8-5 7.8 5 7.8 5-2.8 5-7.8 5-7.8-5-7.8-5Z" stroke="currentColor" strokeWidth="1.5" /><circle cx="10" cy="10" r="2.1" stroke="currentColor" strokeWidth="1.5" /></> : <><path d="m3 3 14 14M8.6 5.2A8.8 8.8 0 0 1 10 5c5 0 7.8 5 7.8 5a13 13 0 0 1-2.1 2.7M5.1 5.8C3.2 7 2.2 10 2.2 10s2.8 5 7.8 5c.8 0 1.6-.2 2.3-.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></>}</svg>;
}

function ShieldIcon() {
  return <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 1.7 13 3.5v3.8c0 3.1-2.2 5.7-5 7-2.8-1.3-5-3.9-5-7V3.5l5-1.8Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /><path d="m5.8 7.8 1.5 1.5 3-3.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function ArrowIcon() {
  return <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4 10h11m-4-4 4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
