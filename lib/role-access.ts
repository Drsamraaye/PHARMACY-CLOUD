/** Shared page/API role policy. OWNER and ADMIN may open every pharmacy module. */
const roleModules: Record<string, readonly string[]> = {
  PHARMACIST: ["products", "orders"],
  DOCTOR: ["home", "patients", "doctor-notes", "laboratory", "medications", "tickets", "requests"],
  RECEPTIONIST: ["home", "patients", "laboratory", "tickets", "requests", "doctor-notes"],
  CASHIER: ["home", "orders", "patients", "reports", "cash-in", "deposits", "tickets"],
  ACCOUNTANT: ["home", "orders", "purchase", "reports", "expenses", "private-expenses", "deposits", "cash-in", "debt", "bank"],
  USER: ["home"],
};

const pagePrefixes: Array<[string, string]> = [
  ["/home", "home"], ["/products-management", "products"], ["/purchase", "purchase"],
  ["/order-management", "orders"], ["/patients", "patients"], ["/tickets", "tickets"],
  ["/laboratory", "laboratory"], ["/dr-note", "doctor-notes"], ["/patient-medications", "medications"],
  ["/reports", "reports"], ["/expenses", "expenses"], ["/private-expenses", "private-expenses"],
  ["/deposits", "deposits"], ["/cash-in", "cash-in"], ["/debt-management", "debt"], ["/bank", "bank"],
  ["/requests", "requests"], ["/asset-management", "admin-only"], ["/human-resource", "admin-only"],
  ["/setup/branches", "admin-only"], ["/setup/category", "products"], ["/setup/companies", "products"],
  ["/setup/payment-methods", "orders"], ["/setup/exchange-rate", "purchase"], ["/setup/accounts", "bank"],
  ["/setup", "admin-only"], ["/users-management", "admin-only"],
];

const apiPrefixes: Array<[string, string]> = [
  ["/api/auth", "public"], ["/api/super-admin", "super-admin"],
  ["/api/dashboard/finance", "home"], ["/api/dashboard", "home"], ["/api/products", "products"], ["/api/purchase", "purchase"],
  ["/api/order-management", "orders"], ["/api/patients", "patients"], ["/api/tickets", "tickets"],
  ["/api/laboratory", "laboratory"], ["/api/dr-note", "doctor-notes"], ["/api/patient-medications", "medications"],
  ["/api/reports", "reports"], ["/api/expenses", "expenses"], ["/api/private-expenses", "private-expenses"],
  ["/api/deposits", "deposits"], ["/api/cash-in", "cash-in"], ["/api/debt-management", "debt"],
  ["/api/bank", "bank"], ["/api/requests", "requests"], ["/api/assets", "admin-only"],
  ["/api/hr", "admin-only"], ["/api/users", "admin-only"], ["/api/setup/branches", "admin-only"],
  ["/api/setup/category", "products"], ["/api/setup/companies", "products"], ["/api/setup/payment-methods", "orders"],
  ["/api/setup/exchange-rate", "purchase"], ["/api/setup/accounts", "bank"],
  ["/api/setup", "admin-only"], ["/api/billing", "admin-only"],
];

function findModule(pathname: string, prefixes: Array<[string, string]>): string | null {
  return prefixes.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`))?.[1] ?? null;
}

export function canAccessPath(role: string, pathname: string, method = "GET", searchParams?: URLSearchParams): boolean {
  if (["/login", "/signup", "/forgot-password", "/account-inactive", "/access-denied"].some((path) => pathname === path || pathname.startsWith(`${path}/`))) return true;
  if (pathname === "/") return role !== "INACTIVE_NOTICE";
  if (["/profile", "/settings"].some((path) => pathname === path || pathname.startsWith(`${path}/`))) return role === "SUPER_ADMIN";

  const module = pathname.startsWith("/api/")
    ? findModule(pathname, apiPrefixes)
    : findModule(pathname, pagePrefixes);
  if (module === "public") return true;
  if (module === "super-admin") return role === "SUPER_ADMIN";
  if (role === "SUPER_ADMIN") return pathname === "/platform-analytics" || pathname.startsWith("/platform-") || ["/tenants", "/subscriptions", "/branches", "/roles", "/plans", "/analytics", "/notifications"].some((path) => pathname === path || pathname.startsWith(`${path}/`));
  if (role === "OWNER" || role === "ADMIN") return true;
  if (role === "PHARMACIST") {
    if (!pathname.startsWith("/api/")) return ["/order-management", "/products-management"].some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
    if (pathname === "/api/patients") return method === "GET" || method === "POST";
    if (["/api/setup/accounts", "/api/setup/payment-methods", "/api/setup/branches"].includes(pathname)) return method === "GET";
    if (["/api/setup/category", "/api/setup/companies"].some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) return method === "GET";
    return ["/api/order-management", "/api/products"].some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  }
  if (!module || module === "admin-only") return false;
  return roleModules[role]?.includes(module) ?? false;
}

export function canChooseAnyBranch(role: string): boolean { return role === "OWNER"; }
