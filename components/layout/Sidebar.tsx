"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { canAccessPath } from "@/lib/role-access";

export const navigationGroups = [
  { title: "Workspace", links: [["Home", "/home"], ["Create ticket", "/tickets/add"]] },
  { title: "Order Management", links: [["Pharmacy sales", "/order-management/pharmacy-sales"], ["Laboratory sales", "/order-management/laboratory-sales"], ["Service order page", "/order-management/services-order"], ["New closeout", "/order-management/xisaab-xidh-cusub"], ["Patient data report", "/order-management/patient-data-report"], ["Refund", "/order-management/refund"], ["Credit note", "/order-management/credit-note"], ["My transactions", "/order-management/my-transactions"], ["Transfer transactions", "/order-management/transfer-transactions"], ["Order details report", "/order-management/order-details-report"], ["Order report", "/order-management/order-report"], ["Receive payments", "/order-management/receive-payments"], ["Customers due payments", "/order-management/customers-due-payments"]] },
  { title: "Product Management", links: [["Products list", "/products-management/list"], ["Add new product", "/products-management/add-new"], ["Product history", "/products-management/history"], ["Laboratory list", "/products-management/lab-list"], ["Service list", "/products-management/service-list"], ["Inactive products", "/products-management/inactive"], ["Low stock", "/products-management/low-stock"], ["Expiry alerts", "/products-management/expiry"], ["Duplicate products", "/products-management/duplicate"]] },
  { title: "Purchase", links: [["New Purchase", "/purchase/new"], ["Purchase report", "/purchase/report"], ["Purchase Refund", "/purchase/refund"], ["Pay Bill", "/purchase/pay-bill"], ["Supplier Product History", "/purchase/supplier-history"], ["Add New Supplier", "/purchase/add-supplier"], ["Bill Report", "/purchase/bill-report"], ["Suppliers List", "/purchase/suppliers-list"]] },
  { title: "Patients", links: [["Patient list", "/patients/list"], ["Register patient", "/patients/new"], ["Deleted patients", "/patients/deleted"]] },
  { title: "Tickets", links: [["Ticket report", "/tickets/report"], ["Create ticket", "/tickets/add"]] },
  { title: "Laboratory", links: [["Add New Lab Record", "/laboratory/add-record"], ["Lab Record Report", "/laboratory/record-report"], ["Deleted Results", "/laboratory/deleted-results"], ["Lab Reception Report", "/laboratory/reception-report"], ["Register New Test", "/laboratory/register-test"], ["Test Lists", "/laboratory/test-lists"], ["Assign Tests to lab", "/laboratory/assign-tests"], ["Edit Doctor Note fields", "/laboratory/edit-doctornote-fields"], ["Edit Lab Section Order", "/laboratory/edit-section-order"], ["Add new test Doctor Note", "/laboratory/add-doctor-note-test"], ["Doctor Note Test List", "/laboratory/doctor-note-test-list"], ["Request From Doctors", "/laboratory/requests-from-doctors"], ["Request From Reception", "/laboratory/requests-from-reception"], ["Add Default Values", "/laboratory/default-values"], ["Lab Default Values Report", "/laboratory/default-values-report"]] },
  { title: "Dr Note", links: [["Add new", "/dr-note/add-new"], ["Dr Note report", "/dr-note/report"], ["My patients", "/dr-note/my-patients"], ["Dr Note fields", "/dr-note/fields"]] },
  { title: "Patient Medications", links: [["Add medication plan", "/patient-medications/add-plan"], ["Add medication record", "/patient-medications/add-record"], ["Medication report", "/patient-medications/report"]] },
  { title: "Expenses", links: [["Expenses Details Report", "/expenses/details-report"], ["Expenses Summary Report", "/expenses/summary-report"], ["My Expenses Report", "/expenses/my-report"], ["Expenses Types", "/expenses/types"], ["Add New Expenses Dollar", "/expenses/add-new-dollar"], ["Add New Expenses Shilling", "/expenses/add-new-shilling"]] },
  { title: "Private Expenses", links: [["Add private expense", "/private-expenses"], ["View private expenses", "/private-expenses/report"]] },
  { title: "Deposits", links: [["Add deposit", "/deposits"], ["View deposits", "/deposits/report"]] },
  { title: "Human Resource", links: [["Warnings list", "/human-resource/warnings"], ["Add new employee", "/human-resource/employees/add"], ["Employee list", "/human-resource/employees"], ["Employee salary", "/human-resource/salary"], ["Pay Salaries at once", "/human-resource/salary/pay-all"], ["Payroll Detail Report", "/human-resource/payroll-report"], ["Register leave", "/human-resource/leave"], ["Leave report", "/human-resource/leave/report"], ["Upload Salary", "/human-resource/salary/upload"], ["Add Attendance", "/human-resource/attendance"], ["Attendance_Report", "/human-resource/attendance/report"]] },
  { title: "Reports", links: [["Income statement report", "/reports/income-statement"], ["Cash flow report", "/reports/cash-flow"], ["Customer statement report", "/reports/customer-statement"], ["Customer balance report", "/reports/customer-balance"], ["Top products sells", "/reports/top-products"], ["Net profit report", "/reports/net-profit"], ["My transactions", "/order-management/my-transactions"], ["Products list", "/products-management/list"], ["Inactive products list", "/products-management/inactive"], ["Low stock product list", "/products-management/low-stock"], ["Expenses details report", "/expenses/details-report"], ["Expenses summary report", "/expenses/summary-report"]] },
  { title: "Cash In", links: [["Cash in report", "/cash-in"], ["Business loan", "/debt-management"], ["Cash in types", "/cash-in/types"], ["Add new cash", "/cash-in/new"]] },
  { title: "Debt Management", links: [["Add debt", "/debt-management/add"], ["Debt report", "/debt-management/report"]] },
  { title: "Users Management", links: [["Users list", "/users-management/users-list"], ["Admin groups", "/users-management/admin-groups"], ["Privileges", "/users-management/privileges"]] },
  { title: "Setup", links: [["Payment Methods", "/setup/payment-methods"], ["Companies", "/setup/companies"], ["Exchange Rate", "/setup/exchange-rate"], ["Branches List", "/setup/branches"], ["Accounts", "/setup/accounts"], ["Accounts History", "/setup/accounts/history"], ["Category", "/setup/category"]] },
  { title: "Bank", links: [["Bank statement", "/bank"], ["Accounts list", "/setup/accounts"], ["Create bank account", "/bank/accounts/new"], ["Accounts deposit", "/bank/deposit"], ["Accounts withdraw", "/bank/withdraw"]] },
  { title: "Asset Management", links: [["Asset list", "/asset-management"]] },
] as const;

export default function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState("");
  const [groupId, setGroupId] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => { let active = true; fetch("/api/auth/session", { cache: "no-store" }).then((response) => response.ok ? response.json() : null).then((payload) => { if (active) { setRole(payload?.data?.role ?? ""); setGroupId(payload?.data?.groupId ?? null); setPermissions(payload?.data?.permissions ?? []); } }).catch(() => { if (active) setRole(""); }); return () => { active = false; }; }, []);
  const groupManaged = Boolean(groupId) && !["OWNER", "ADMIN", "SUPER_ADMIN"].includes(role);
  const visibleGroups = role ? navigationGroups.filter((group) => groupManaged || role !== "PHARMACIST" || ["Order Management", "Product Management"].includes(group.title)).map((group) => ({ ...group, links: group.links.filter(([, href]) => groupManaged ? permissions.includes(href) : canAccessPath(role, href)) })).filter((group) => group.links.length > 0) : [];
  const currentPath = pathname.replace(/\/+$/, "") || "/";
  const matchingHrefs = visibleGroups.flatMap((group) => group.links.map(([, href]) => href))
    .filter((href) => currentPath === href || currentPath.startsWith(`${href}/`));
  const activeHref = matchingHrefs.sort((a, b) => b.length - a.length)[0];
  return <>
    <button className="ph-menu-toggle" aria-label="Fur menu-ga" aria-expanded={open} onClick={() => setOpen((value) => !value)}>☰</button>
    {open && <button className="ph-sidebar-scrim" aria-label="Xir menu-ga" onClick={() => setOpen(false)} />}
    <aside className={`ph-sidebar${open ? " is-open" : ""}`}>
      <Link href="/home" className="ph-brand"><span className="ph-brand-mark">✚</span><span>Pharma<span>Cloud</span><small>PHARMACY WORKSPACE</small></span></Link>
      <nav className="ph-navigation" aria-label="Pharmacy navigation">
        {visibleGroups.map((group) => <details className="ph-nav-group" key={group.title} open={group.links.some(([, href]) => href === activeHref)}>
          <summary><span className="ph-nav-icon" aria-hidden="true">{groupIcon(group.title)}</span><span className="ph-nav-label">{group.title}</span></summary>
          <ul>{group.links.map(([label, href]) => <li key={`${label}-${href}`}><Link href={href} aria-current={href === activeHref ? "page" : undefined} className={href === activeHref ? "is-active" : ""}>{label}</Link></li>)}</ul>
        </details>)}
      </nav>
      <div className="ph-sidebar-footer"><span className="ph-online-dot"/> Xogta pharmacy-gaagu waa gaar</div>
    </aside>
  </>;
}

function groupIcon(title: string) {
  const icons: Record<string, string> = { Workspace: "⌂", "Order Management": "▣", "Product Management": "▤", Purchase: "▣", Patients: "♟", Tickets: "♧", Laboratory: "▤", "Dr Note": "▣", "Patient Medications": "▣", Expenses: "⇵", "Private Expenses": "⇵", Deposits: "⇵", "Human Resource": "♣", Reports: "▤", "Cash In": "▣", "Debt Management": "▤", "Users Management": "♟", Setup: "⚙", Bank: "▣", "Asset Management": "⌂" };
  return icons[title] ?? "•";
}
