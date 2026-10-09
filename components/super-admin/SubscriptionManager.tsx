"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type Tenant = { id: string; name: string; slug: string };
type Subscription = { id: string; tenantId: string; plan: string; status: string; trialEnds: string | null; createdAt: string; tenant: { id: string; name: string; slug: string; isActive: boolean } };

/** Shows tenant subscription history and lets the platform owner grant or upgrade plans. */
export default function SubscriptionManager() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [tenantId, setTenantId] = useState("");
  const [plan, setPlan] = useState("BASIC");
  const [status, setStatus] = useState("ACTIVE");
  const [trialDays, setTrialDays] = useState("14");
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [subscriptionResponse, tenantResponse] = await Promise.all([
        fetch("/api/super-admin/subscriptions", { cache: "no-store" }),
        fetch("/api/super-admin/tenants", { cache: "no-store" }),
      ]);
      const [subscriptionJson, tenantJson] = await Promise.all([subscriptionResponse.json(), tenantResponse.json()]);
      if (!subscriptionResponse.ok || !tenantResponse.ok) throw new Error(subscriptionJson.error || tenantJson.error || "Could not load subscriptions");
      setSubscriptions(subscriptionJson.data);
      setTenants((tenantJson.data as (Tenant & { slug: string })[]).filter((tenant) => tenant.slug !== "pharmacloud-platform"));
      setTenantId((current) => current || (tenantJson.data as Tenant[]).find((tenant) => tenant.slug !== "pharmacloud-platform")?.id || "");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load subscriptions"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function grantPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/super-admin/subscriptions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenantId, plan, status, trialDays: Number(trialDays) }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not update the subscription");
      setMessage(`${tenants.find((tenant) => tenant.id === tenantId)?.name ?? "Pharmacy"} plan-kiisa waxaa loo dejiyey ${plan} (${status}).`);
      setFormOpen(false); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not update the subscription"); }
    finally { setSaving(false); }
  }

  function prepareUpgrade(subscription: Subscription) {
    setTenantId(subscription.tenantId); setPlan(subscription.plan === "TRIAL" || subscription.plan === "BASIC" ? "PRO" : "ENTERPRISE"); setStatus("ACTIVE"); setFormOpen(true); setMessage(""); setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return <div className="platform-page">
    <header className="platform-page-heading"><div><span className="platform-eyebrow">BILLING CONTROL</span><h1>Subscriptions</h1><p>Samee subscription ama u dallacii pharmacy plan cusub.</p></div><button className="platform-primary-link platform-button" onClick={() => { setFormOpen((open) => !open); setError(""); }}>{formOpen ? "Xir form-ka" : "+ Samee / upgrade plan"}</button></header>
    <p className="platform-note"><strong>Admin plan assignment:</strong> tani waxay diiwaan gelisaa plan-ka iyo status-ka. Wax Stripe payment ah kama qaaddo pharmacy-ga.</p>
    {error && <p role="alert" className="platform-alert">{error}</p>}{message && <p role="status" className="platform-success">{message}</p>}

    {formOpen && <section className="platform-panel"><div className="platform-panel-heading"><div><h2>Grant ama upgrade plan</h2><p>Record cusub ayaa lagu daraa history-ga; kuwii hore lama tirtirayo.</p></div></div><form className="platform-form-grid subscription-form" onSubmit={grantPlan}>
      <label>Pharmacy<select value={tenantId} onChange={(event) => setTenantId(event.target.value)} required><option value="" disabled>Dooro pharmacy</option>{tenants.map((tenant) => <option value={tenant.id} key={tenant.id}>{tenant.name}</option>)}</select></label>
      <label>Plan<select value={plan} onChange={(event) => { setPlan(event.target.value); if (event.target.value === "TRIAL") setStatus("TRIALING"); else if (status === "TRIALING") setStatus("ACTIVE"); }}><option value="TRIAL">Trial</option><option value="BASIC">Basic</option><option value="PRO">Pro</option><option value="ENTERPRISE">Enterprise</option></select></label>
      <label>Status<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="ACTIVE">Active</option><option value="TRIALING">Trialing</option><option value="PAST_DUE">Past due</option><option value="CANCELED">Canceled</option><option value="SUSPENDED">Suspended</option></select></label>
      {status === "TRIALING" && <label>Trial (maalmo)<input type="number" min={1} max={90} value={trialDays} onChange={(event) => setTrialDays(event.target.value)} required /></label>}
      <div className="platform-form-actions"><button type="button" className="platform-secondary-button" onClick={() => setFormOpen(false)}>Cancel</button><button disabled={saving || !tenantId} className="platform-primary-link platform-button">{saving ? "Waa la keydinayaa…" : "Keydi subscription"}</button></div>
    </form>{tenants.length === 0 && <p className="platform-empty">Marka hore diiwaan geli pharmacy.</p>}</section>}

    <section className="platform-panel"><div className="platform-panel-heading"><div><h2>Subscription history</h2><p>{subscriptions.length} records</p></div><button className="platform-secondary-button" onClick={() => void load()}>Refresh</button></div>
      {loading ? <p className="platform-empty">Loading subscription history…</p> : subscriptions.length === 0 ? <div className="platform-empty"><strong>Subscriptions lama abuurin.</strong><span>Samee trial ama plan marka pharmacy la diiwaan geliyo.</span></div> : <div className="platform-table-wrap"><table className="platform-table"><thead><tr><th>Pharmacy</th><th>Plan</th><th>Status</th><th>Trial ends</th><th>Record date</th><th>Action</th></tr></thead><tbody>{subscriptions.map((subscription) => <tr key={subscription.id}><td><strong>{subscription.tenant.name}</strong><small>{subscription.tenant.slug}{!subscription.tenant.isActive ? " · Pharmacy inactive" : ""}</small></td><td><span className={`platform-plan-pill plan-${subscription.plan.toLowerCase()}`}>{subscription.plan}</span></td><td><span className={`platform-status ${subscription.status === "ACTIVE" || subscription.status === "TRIALING" ? "is-active" : "is-inactive"}`}><i />{subscription.status}</span></td><td>{subscription.trialEnds ? new Date(subscription.trialEnds).toLocaleDateString() : "—"}</td><td>{new Date(subscription.createdAt).toLocaleDateString()}</td><td><button className="platform-small-button" onClick={() => prepareUpgrade(subscription)}>Upgrade</button></td></tr>)}</tbody></table></div>}
    </section>
  </div>;
}
