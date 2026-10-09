import { prisma } from "@/lib/prisma";

/** Checks a user's explicit group privilege; tenant owners and platform admins bypass the matrix. */
export async function checkPermission(userId: string, permission: string): Promise<boolean> {
  const user = await prisma.userProfile.findUnique({ where: { id: userId }, select: { role: true, groupId: true } });
  if (!user) return false;
  if (user.role === "OWNER" || user.role === "SUPER_ADMIN") return true;
  if (!user.groupId) return false;
  const grant = await prisma.privilege.findUnique({ where: { groupId_key: { groupId: user.groupId, key: permission } }, select: { allowed: true } });
  return grant?.allowed ?? false;
}

/** Resolves API requests to the page permission represented in the navigation matrix. */
export async function checkRequestPermission(userId: string, pathname: string, method = "GET"): Promise<boolean> {
  const aliases: Record<string, string> = {
    "/api/dashboard": "/home", "/api/dashboard/finance": "/home",
    "/api/users": "/users-management/users-list", "/api/users/admin-groups": "/users-management/admin-groups", "/api/users/privileges": "/users-management/privileges",
    "/api/setup/branches": "/setup/branches", "/api/setup/accounts": "/setup/accounts", "/api/setup/payment-methods": "/setup/payment-methods",
    "/api/setup/companies": "/setup/companies", "/api/setup/category": "/setup/category", "/api/setup/exchange-rate": "/setup/exchange-rate",
    "/api/patients": method === "POST" ? "/patients/new" : "/patients/list",
    "/api/products": method === "POST" ? "/products-management/add-new" : "/products-management/list",
    "/api/products/low-stock": "/products-management/low-stock", "/api/products/expiry": "/products-management/expiry",
    "/api/products/history": "/products-management/history", "/api/products/inactive": "/products-management/inactive",
    "/api/products/lab-list": "/products-management/lab-list", "/api/products/service-list": "/products-management/service-list",
    "/api/products/duplicate": "/products-management/duplicate",
    "/api/laboratory/records": method === "POST" ? "/laboratory/add-record" : "/laboratory/record-report",
    "/api/laboratory/reception-report": "/laboratory/reception-report", "/api/laboratory/assignments": "/laboratory/assign-tests",
    "/api/laboratory/section-order": "/laboratory/edit-section-order", "/api/laboratory/doctor-note-fields": "/laboratory/edit-doctornote-fields",
    "/api/laboratory/default-values": "/laboratory/default-values",
    "/api/dr-note": method === "POST" ? "/dr-note/add-new" : "/dr-note/report", "/api/dr-note/report": "/dr-note/report", "/api/dr-note/my-patients": "/dr-note/my-patients", "/api/dr-note/fields": "/dr-note/fields",
    "/api/tickets": method === "POST" ? "/tickets/add" : "/tickets/report", "/api/tickets/report": "/tickets/report", "/api/requests": "/requests",
    "/api/patient-medications/plans": method === "POST" ? "/patient-medications/add-plan" : "/patient-medications/report", "/api/patient-medications/records": method === "POST" ? "/patient-medications/add-record" : "/patient-medications/report", "/api/patient-medications/report": "/patient-medications/report",
    "/api/purchase": method === "POST" ? "/purchase/new" : "/purchase/report", "/api/purchase/report": "/purchase/report", "/api/purchase/refund": "/purchase/refund", "/api/purchase/pay-bill": "/purchase/pay-bill", "/api/purchase/suppliers": "/purchase/suppliers-list", "/api/purchase/supplier-history": "/purchase/supplier-history", "/api/purchase/bill-report": "/purchase/bill-report",
    "/api/cash-in": method === "POST" ? "/cash-in/new" : "/cash-in", "/api/cash-in/report": "/cash-in", "/api/cash-in/types": "/cash-in/types", "/api/cash-in/loan": "/debt-management",
    "/api/debt-management": "/debt-management/report", "/api/deposits": "/deposits", "/api/private-expenses": "/private-expenses",
    "/api/expenses": method === "POST" ? "/expenses/add-new" : "/expenses/details-report", "/api/expenses/summary-report": "/expenses/summary-report", "/api/expenses/my-report": "/expenses/my-report",
    "/api/expenses/types": "/expenses/types", "/api/expenses/deleted": "/expenses/deleted",
    "/api/bank/accounts": "/setup/accounts", "/api/bank/statement": "/bank", "/api/bank/deposit": "/deposits", "/api/bank/withdraw": "/bank", "/api/bank/transfer": "/bank",
    "/api/assets": "/asset-management", "/api/hr/employees": "/human-resource/employees", "/api/hr/attendance": "/human-resource/attendance", "/api/hr/warnings": "/human-resource/warnings", "/api/hr/salary": "/human-resource/salary", "/api/hr/leave": "/human-resource/leave", "/api/hr/payroll-report": "/human-resource/payroll-report",
  };
  const candidates = new Set<string>();
  if (!pathname.startsWith("/api/")) {
    candidates.add(pathname === "/debt-management" ? "/debt-management/report" : pathname);
    const parent = pathname.replace(/\/$/, "").replace(/\/[^/]+$/, "");
    if (parent && parent !== pathname) candidates.add(parent);
    if (pathname === "/debt-management/add") candidates.add("/debt-management/report");
  }
  else {
    const direct = aliases[pathname] ?? Object.entries(aliases).sort(([left],[right])=>right.length-left.length).find(([apiPath])=>pathname.startsWith(`${apiPath}/`))?.[1];
    if (direct) candidates.add(direct);
    if (pathname === "/api/debt-management") { candidates.add("/debt-management/add"); candidates.add("/debt-management/report"); }
    const normalized = pathname.replace(/^\/api/, "");
    candidates.add(normalized);
    if (pathname.startsWith("/api/users/")) candidates.add("/users-management/users-list");
    if (pathname.startsWith("/api/patients/")) candidates.add("/patients/list");
    if (pathname.startsWith("/api/products/")) candidates.add("/products-management/list");
    if (pathname.startsWith("/api/order-management/")) candidates.add(`/order-management/${pathname.split("/")[3]}`);
    if (pathname.startsWith("/api/reports/")) candidates.add(`/reports/${pathname.split("/")[3]}`);
    if (pathname.startsWith("/api/hr/")) candidates.add(`/human-resource/${pathname.split("/")[3]}`);
  }
  const user = await prisma.userProfile.findUnique({ where: { id: userId }, select: { role: true, groupId: true } });
  if (!user?.groupId) return false;
  if (user.role === "OWNER" || user.role === "ADMIN" || user.role === "SUPER_ADMIN") return true;
  const grants = await prisma.privilege.findMany({ where: { groupId: user.groupId, key: { in: [...candidates] }, allowed: true }, select: { key: true } });
  return grants.length > 0;
}
