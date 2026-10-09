"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type StatusData = { status: "USER_INACTIVE" | "PHARMACY_INACTIVE" | "ACTIVE"; fullName: string; email: string; pharmacyName: string };

export default function InactiveAccountPage() {
  const [data, setData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    fetch("/api/auth/inactive-status", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error("expired");
        setData(payload.data);
      })
      .catch(() => setExpired(true))
      .finally(() => setLoading(false));
  }, []);

  const restored = data?.status === "ACTIVE";
  const title = restored ? "Akoonka waa la furay" : data?.status === "PHARMACY_INACTIVE" ? "Pharmacy-gu waa inactive" : "Akoonkaagu waa inactive";
  const description = restored
    ? "Akoonkaaga hadda waa firfircoon yahay. Ku noqo bogga gelitaanka si aad u gasho."
    : data?.status === "PHARMACY_INACTIVE"
      ? "Akoonkaagu wuu jiraa, laakiin pharmacy-gaaga ayaa hakad ku jira. La xiriir maamulka PharmaCloud si ay dib ugu hawlgeliyaan."
      : "Email-ka iyo password-ku waa sax, laakiin maamulka pharmacy-ga ayaa joojiyey akoonkaaga. La xiriir maamulka pharmacy-ga si ay dib ugu hawlgeliyaan.";

  return <section className="inactive-card" aria-labelledby="inactive-title">
    <div className={`inactive-icon${restored ? " is-restored" : ""}`} aria-hidden="true">{restored ? "✓" : "!"}</div>
    <span className="inactive-eyebrow">PHARMACLOUD ACCOUNT STATUS</span>
    <h1 id="inactive-title">{loading ? "Xaaladda akoonka…" : expired ? "Mar kale gal akoonkaaga" : title}</h1>
    <p className="inactive-description">{loading ? "Waxaan hubinaynaa xaaladda gelitaankaaga." : expired ? "Xaqiijinta gelitaanka way dhacday. Ku noqo bogga gelitaanka oo mar kale isku day." : description}</p>
    {!loading && data && !expired && <div className="inactive-account-details"><div><span>Magaca</span><strong>{data.fullName}</strong></div><div><span>Email</span><strong>{data.email}</strong></div><div><span>Pharmacy</span><strong>{data.pharmacyName}</strong></div><div><span>Xaaladda</span><strong className={restored ? "status-active-text" : "status-inactive-text"}>{restored ? "Active" : "Inactive"}</strong></div></div>}
    <Link href="/login" className="inactive-login-link">{restored || expired ? "Ku noqo gelitaanka" : "Ku noqo gelitaanka"}<span aria-hidden="true">→</span></Link>
    <small className="inactive-footnote">Akoonka inactive-ka ahi ma geli karo xogta pharmacy-ga.</small>
  </section>;
}
