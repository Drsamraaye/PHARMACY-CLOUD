"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const groups = [
  { label: "OVERVIEW", items: [{ href: "/platform-analytics", label: "Dashboard", icon: "▦" }] },
  { label: "BUSINESS", items: [{ href: "/tenants", label: "Pharmacies", icon: "▤" }, { href: "/branches", label: "Branches", icon: "▥" }, { href: "/platform-users", label: "Users", icon: "♙" }] },
  { label: "BILLING", items: [{ href: "/subscriptions", label: "Subscriptions", icon: "◇" }, { href: "/plans", label: "Plans", icon: "▱" }] },
  { label: "PLATFORM", items: [{ href: "/analytics", label: "Analytics", icon: "⌁" }, { href: "/notifications", label: "Notifications", icon: "♧" }, { href: "/roles", label: "Roles & access", icon: "⚿" }] },
  { label: "SYSTEM", items: [{ href: "/settings", label: "System settings", icon: "⚙" }] },
];

export default function PlatformNavigation() {
  const pathname = usePathname();
  return <nav aria-label="Super-admin navigation" className="platform-nav">
    {groups.map((group) => <section className="platform-nav-group" key={group.label}>
      <p>{group.label}</p>
      {group.items.map((item) => <Link href={item.href} key={item.href} aria-current={pathname === item.href ? "page" : undefined} className={`platform-nav-link${pathname === item.href ? " is-current" : ""}`}><span aria-hidden="true">{item.icon}</span>{item.label}</Link>)}
    </section>)}
  </nav>;
}
