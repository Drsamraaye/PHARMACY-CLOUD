"use client";

import { useEffect, useState } from "react";

const REFRESH_KEY = "pharmacloud-platform-refresh-minutes";
const DENSITY_KEY = "pharmacloud-platform-density";

export default function PlatformSettings() {
  const [refreshMinutes, setRefreshMinutes] = useState("0");
  const [density, setDensity] = useState("comfortable");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const storedRefresh = window.localStorage.getItem(REFRESH_KEY);
    const storedDensity = window.localStorage.getItem(DENSITY_KEY);
    if (storedRefresh && ["0", "1", "5", "15"].includes(storedRefresh)) setRefreshMinutes(storedRefresh);
    if (storedDensity === "compact" || storedDensity === "comfortable") setDensity(storedDensity);
  }, []);

  function save() {
    window.localStorage.setItem(REFRESH_KEY, refreshMinutes);
    window.localStorage.setItem(DENSITY_KEY, density);
    document.documentElement.dataset.platformDensity = density;
    setSaved(true);
  }

  return <div className="platform-page">
    <header className="platform-page-heading"><div><span className="platform-eyebrow">CONSOLE PREFERENCES</span><h1>Platform settings</h1><p>Habee sida dashboard-ka Super Admin-ku u cusboonaado iyo cufnaanta liisaska.</p></div></header>
    {saved && <p className="platform-success" role="status">Settings-ka waa la kaydiyey browser-kan.</p>}
    <section className="platform-panel platform-settings-panel">
      <div className="platform-panel-heading"><div><h2>Display & updates</h2><p>Doorashooyinkan waxay khuseeyaan console-kan iyo browser-kan.</p></div></div>
      <div className="platform-setting-row"><span><strong>Dashboard auto-refresh</strong><small>Si toos ah u cusboonaysii tirooyinka dashboard-ka.</small></span><select value={refreshMinutes} onChange={(event) => { setRefreshMinutes(event.target.value); setSaved(false); }}><option value="0">Off</option><option value="1">Every minute</option><option value="5">Every 5 minutes</option><option value="15">Every 15 minutes</option></select></div>
      <div className="platform-setting-row"><span><strong>Table spacing</strong><small>Dooro inta bannaan ee ku wareegsan safafka miisaska.</small></span><select value={density} onChange={(event) => { setDensity(event.target.value); setSaved(false); }}><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select></div>
      <div className="platform-settings-actions"><button className="platform-primary-link platform-button" onClick={save}>Save settings</button></div>
    </section>
    <section className="platform-note"><strong>Profile-kaaga?</strong> Waxaad ka beddeli kartaa magaca iyo email-ka qaybta <a href="/profile">My profile</a>.</section>
  </div>;
}
