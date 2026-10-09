#!/bin/bash
# ============================================================
# PharmaCloud — Project Scaffold Script
# Next.js App Router + Prisma
# ============================================================
set -e

echo "🚀 Creating PharmaCloud project structure in current directory..."

# Helper: create a page.tsx placeholder with a comment
make_page () {
  local dir="$1"
  local label="$2"
  mkdir -p "$dir"
  if [ ! -f "$dir/page.tsx" ]; then
    cat > "$dir/page.tsx" <<EOF
// TODO: $label
export default function Page() {
  return <div>$label</div>;
}
EOF
  fi
}

make_route () {
  local dir="$1"
  local label="$2"
  mkdir -p "$dir"
  if [ ! -f "$dir/route.ts" ]; then
    cat > "$dir/route.ts" <<EOF
// TODO: $label
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  return NextResponse.json({ message: "$label - GET not implemented" });
}
EOF
  fi
}

# 1. app/(auth)
make_page "app/(auth)/login" "Login Page"
make_page "app/(auth)/signup" "Signup Page"
make_page "app/(auth)/forgot-password" "Forgot Password Page"

# 2. app/(dashboard) — layout + Home
mkdir -p "app/(dashboard)"
cat > "app/(dashboard)/layout.tsx" <<'EOF'
// TODO: Sidebar + Topbar wrapper layout
import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex">
      <Sidebar />
      <div className="flex-1">
        <Topbar />
        <main>{children}</main>
      </div>
    </div>
  );
}
EOF
make_page "app/(dashboard)/home" "Home Dashboard"

# 2.1 Order Management
OM="app/(dashboard)/order-management"
make_page "$OM/pharmacy-sales" "Pharmacy Sales"
make_page "$OM/laboratory-sales" "Laboratory Sales"
make_page "$OM/services-order" "Services Order Page"
make_page "$OM/xisaab-xidh-cusub" "Xisaab Xidh Cusub"
make_page "$OM/patient-data-report" "Patient Data Report"
make_page "$OM/refund" "Refund"
make_page "$OM/credit-note" "Credit Note"
make_page "$OM/my-transactions" "My Transactions"
make_page "$OM/transfer-transactions" "Transfer Transactions"
make_page "$OM/order-details-report" "Order Details Report"
make_page "$OM/order-report" "Order Report"
make_page "$OM/receive-payments" "Receive Payments"
make_page "$OM/customers-due-payments" "Customers Due Payments"

# 2.2 Products Management
PM="app/(dashboard)/products-management"
make_page "$PM/history" "Products History"
make_page "$PM/add-new" "Add New Product"
make_page "$PM/list" "Products List"
make_page "$PM/lab-list" "Lab List"
make_page "$PM/service-list" "Service List"
make_page "$PM/inactive" "Inactive Products List"
make_page "$PM/low-stock" "Low Stock Products List"
make_page "$PM/expiry" "Expiry Products List"
make_page "$PM/duplicate" "Duplicate Products"

# 2.3 Purchase
PU="app/(dashboard)/purchase"
make_page "$PU/new" "New Purchase"
make_page "$PU/report" "Purchase Report"
make_page "$PU/refund" "Purchase Refund"
make_page "$PU/pay-bill" "Pay Bill"
make_page "$PU/supplier-history" "Supplier Product History"
make_page "$PU/add-supplier" "Add New Supplier"
make_page "$PU/bill-report" "Bill Report"
make_page "$PU/suppliers-list" "Suppliers List"

# 2.4 Requests
make_page "app/(dashboard)/requests" "Requests"

# 2.5 Patients
PT="app/(dashboard)/patients"
make_page "$PT/new" "New Patient"
make_page "$PT/list" "Patients List"
make_page "$PT/deleted" "Deleted Patients List"

# 2.6 Tickets
TK="app/(dashboard)/tickets"
make_page "$TK/add" "Add New Ticket"
make_page "$TK/report" "Tickets Report"

# 2.7 Laboratory
LB="app/(dashboard)/laboratory"
make_page "$LB/add-record" "Add New Lab Record"
make_page "$LB/record-report" "Lab Record Report"
make_page "$LB/deleted-results" "Deleted Results"
make_page "$LB/reception-report" "Lab Reception Report"
make_page "$LB/register-test" "Register New Test"
make_page "$LB/test-lists" "Test Lists"
make_page "$LB/edit-doctornote-fields" "Edit DoctorNote Fields"
make_page "$LB/edit-section-order" "Edit Lab Section Order"
make_page "$LB/requests-from-doctors" "Request From Doctors"
make_page "$LB/requests-from-reception" "Request From Reception"
make_page "$LB/default-values" "Lab Default Values"

# 2.8 Dr Note
DN="app/(dashboard)/dr-note"
make_page "$DN/add-new" "Add New Dr Note"
make_page "$DN/report" "Dr Note Report"
make_page "$DN/my-patients" "My Patients (Dr Note)"
make_page "$DN/fields" "Dr Note Fields"

# 2.9 Patient Medications
PMD="app/(dashboard)/patient-medications"
make_page "$PMD/add-plan" "Add Medication Plan"
make_page "$PMD/add-record" "Add Medication Record"
make_page "$PMD/report" "Medication Report"

# 2.10 Expenses / Private Expenses / Deposits
EX="app/(dashboard)/expenses"
make_page "$EX/details-report" "Expenses Details Report"
make_page "$EX/summary-report" "Expenses Summary Report"
make_page "$EX/my-report" "My Expenses Report"
make_page "$EX/types" "Expenses Types"
make_page "$EX/add-new" "Add New Expense (Dollar/Shiling)"

make_page "app/(dashboard)/private-expenses" "Private Expenses"
make_page "app/(dashboard)/deposits" "Deposits"

# 2.11 Human Resource
HR="app/(dashboard)/human-resource"
make_page "$HR/warnings" "Warnings List"
make_page "$HR/employees" "Employees"
make_page "$HR/salary" "Employee Salary"
make_page "$HR/payroll-report" "Payroll Detail Report"
make_page "$HR/leave" "Leave"
make_page "$HR/attendance" "Attendance"

# 2.12 Reports
RP="app/(dashboard)/reports"
make_page "$RP/income-statement" "Income Statement Report"
make_page "$RP/cash-flow" "Cash Flow Report"
make_page "$RP/customer-statement" "Customer Statement Report"
make_page "$RP/customer-balance" "Customer Balance Report"
make_page "$RP/top-products" "Top Products Sells"
make_page "$RP/net-profit" "Net Profit Report"

# 2.13 Cash In / Debt Management
make_page "app/(dashboard)/cash-in" "Cash In"
make_page "app/(dashboard)/debt-management" "Debt Management"

# 2.14 Users Management
UM="app/(dashboard)/users-management"
make_page "$UM/users-list" "Users List"
make_page "$UM/admin-groups" "Admin Groups"
make_page "$UM/privileges" "Privileges"

# 2.15 Setup
SU="app/(dashboard)/setup"
make_page "$SU/payment-methods" "Payment Methods"
make_page "$SU/companies" "Companies"
make_page "$SU/branches" "Branches List"
make_page "$SU/exchange-rate" "Exchange Rate"
make_page "$SU/accounts" "Accounts"
make_page "$SU/category" "Category"

# 2.16 Bank / Asset Management
make_page "app/(dashboard)/bank" "Bank"
make_page "app/(dashboard)/asset-management" "Asset Management"

# 3. app/(super-admin)
make_page "app/(super-admin)/tenants" "Tenants (Super Admin)"
make_page "app/(super-admin)/subscriptions" "Subscriptions (Super Admin)"
make_page "app/(super-admin)/platform-analytics" "Platform Analytics"

# 4. app/api — Backend Routes
make_route "app/api/auth/login" "Login"
make_route "app/api/auth/logout" "Logout"
make_route "app/api/auth/session" "Session"

make_route "app/api/order-management/pharmacy-sales" "Pharmacy Sales API"
make_route "app/api/order-management/pharmacy-sales/[id]" "Pharmacy Sale by ID"
make_route "app/api/order-management/laboratory-sales" "Laboratory Sales API"
make_route "app/api/order-management/laboratory-sales/[id]" "Laboratory Sale by ID"
make_route "app/api/order-management/services-order" "Services Order API"
make_route "app/api/order-management/xisaab-xidh" "Xisaab Xidh Cusub API"
make_route "app/api/order-management/patient-data-report" "Patient Data Report API"
make_route "app/api/order-management/refund" "Refund API"
make_route "app/api/order-management/credit-note" "Credit Note API"
make_route "app/api/order-management/my-transactions" "My Transactions API"
make_route "app/api/order-management/transfer-transactions" "Transfer Transactions API"
make_route "app/api/order-management/order-details-report" "Order Details Report API"
make_route "app/api/order-management/order-report" "Order Report API"
make_route "app/api/order-management/receive-payments" "Receive Payments API"
make_route "app/api/order-management/customers-due-payments" "Customers Due Payments API"

make_route "app/api/products" "Products API"
make_route "app/api/products/[id]" "Product by ID"
make_route "app/api/products/history" "Products History API"
make_route "app/api/products/lab-list" "Lab List API"
make_route "app/api/products/service-list" "Service List API"
make_route "app/api/products/inactive" "Inactive Products API"
make_route "app/api/products/low-stock" "Low Stock Products API"
make_route "app/api/products/expiry" "Expiry Products API"
make_route "app/api/products/duplicate" "Duplicate Products API"

make_route "app/api/purchase" "Purchase API"
make_route "app/api/purchase/[id]" "Purchase by ID"
make_route "app/api/purchase/report" "Purchase Report API"
make_route "app/api/purchase/refund" "Purchase Refund API"
make_route "app/api/purchase/pay-bill" "Pay Bill API"
make_route "app/api/purchase/suppliers" "Suppliers API"
make_route "app/api/purchase/suppliers/[id]" "Supplier by ID"
make_route "app/api/purchase/suppliers/[id]/history" "Supplier History API"
make_route "app/api/purchase/bill-report" "Bill Report API"

make_route "app/api/requests" "Requests API"

make_route "app/api/patients" "Patients API"
make_route "app/api/patients/[id]" "Patient by ID"
make_route "app/api/patients/deleted" "Deleted Patients API"

make_route "app/api/tickets" "Tickets API"
make_route "app/api/tickets/report" "Tickets Report API"

make_route "app/api/laboratory/records" "Lab Records API"
make_route "app/api/laboratory/records/[id]" "Lab Record by ID"
make_route "app/api/laboratory/records/deleted" "Deleted Lab Results API"
make_route "app/api/laboratory/reception-report" "Lab Reception Report API"
make_route "app/api/laboratory/tests" "Lab Tests API"
make_route "app/api/laboratory/doctor-note-fields" "Doctor Note Fields API"
make_route "app/api/laboratory/section-order" "Lab Section Order API"
make_route "app/api/laboratory/requests-from-doctors" "Requests From Doctors API"
make_route "app/api/laboratory/requests-from-reception" "Requests From Reception API"
make_route "app/api/laboratory/default-values" "Lab Default Values API"

make_route "app/api/dr-note" "Dr Note API"
make_route "app/api/dr-note/report" "Dr Note Report API"
make_route "app/api/dr-note/my-patients" "Dr Note My Patients API"
make_route "app/api/dr-note/fields" "Dr Note Fields API"

make_route "app/api/patient-medications/plans" "Medication Plans API"
make_route "app/api/patient-medications/records" "Medication Records API"
make_route "app/api/patient-medications/report" "Medication Report API"

make_route "app/api/expenses" "Expenses API"
make_route "app/api/expenses/details-report" "Expenses Details Report API"
make_route "app/api/expenses/summary-report" "Expenses Summary Report API"
make_route "app/api/expenses/my-report" "My Expenses Report API"
make_route "app/api/expenses/types" "Expenses Types API"

make_route "app/api/private-expenses" "Private Expenses API"
make_route "app/api/deposits" "Deposits API"

make_route "app/api/hr/employees" "Employees API"
make_route "app/api/hr/employees/[id]" "Employee by ID"
make_route "app/api/hr/warnings" "Warnings API"
make_route "app/api/hr/salary" "Salary API"
make_route "app/api/hr/salary/pay-all" "Pay Salaries At Once API"
make_route "app/api/hr/payroll-report" "Payroll Report API"
make_route "app/api/hr/leave" "Leave API"
make_route "app/api/hr/leave/report" "Leave Report API"
make_route "app/api/hr/attendance" "Attendance API"

make_route "app/api/reports/income-statement" "Income Statement API"
make_route "app/api/reports/cash-flow" "Cash Flow API"
make_route "app/api/reports/customer-statement" "Customer Statement API"
make_route "app/api/reports/customer-balance" "Customer Balance API"
make_route "app/api/reports/top-products" "Top Products API"
make_route "app/api/reports/net-profit" "Net Profit API"

make_route "app/api/cash-in" "Cash In API"
make_route "app/api/cash-in/report" "Cash In Report API"
make_route "app/api/cash-in/types" "Cash In Types API"
make_route "app/api/cash-in/loan" "Business Loan API"

make_route "app/api/debt-management" "Debt Management API"

make_route "app/api/users" "Users API"
make_route "app/api/users/[id]" "User by ID"
make_route "app/api/users/admin-groups" "Admin Groups API"
make_route "app/api/users/privileges" "Privileges API"

make_route "app/api/setup/payment-methods" "Payment Methods API"
make_route "app/api/setup/companies" "Companies API"
make_route "app/api/setup/branches" "Branches API"
make_route "app/api/setup/exchange-rate" "Exchange Rate API"
make_route "app/api/setup/accounts" "Accounts API"
make_route "app/api/setup/accounts/history" "Accounts History API"
make_route "app/api/setup/category" "Category API"

make_route "app/api/bank/statement" "Bank Statement API"
make_route "app/api/bank/accounts" "Bank Accounts API"
make_route "app/api/bank/deposit" "Bank Deposit API"
make_route "app/api/bank/withdraw" "Bank Withdraw API"

make_route "app/api/assets" "Assets API"

make_route "app/api/billing/subscription" "Subscription API"
make_route "app/api/billing/invoices" "Invoices API"

make_route "app/api/webhooks/stripe" "Stripe Webhook"
make_route "app/api/webhooks/mobile-money" "Mobile Money Webhook"

make_route "app/api/cron/expiry-check" "Expiry Check Cron"
make_route "app/api/cron/subscription-renewal" "Subscription Renewal Cron"

make_route "app/api/super-admin/tenants" "Super Admin Tenants API"
make_route "app/api/super-admin/tenants/[id]" "Super Admin Tenant by ID"
make_route "app/api/super-admin/analytics" "Super Admin Analytics API"

# 5. components/
mkdir -p components/layout components/sales components/products components/purchase \
         components/patients components/tickets components/laboratory components/dr-note \
         components/patient-medications components/finance components/hr components/reports \
         components/users components/setup components/bank components/assets components/shared components/ui

cat > components/layout/Sidebar.tsx <<'EOF'
// TODO: Full sidebar nav tree (see PharmaCloud-Full-Spec.md section 4)
export default function Sidebar() {
  return <aside>Sidebar</aside>;
}
EOF

cat > components/layout/Topbar.tsx <<'EOF'
// TODO: Exchange Rate, User, Branch switcher
export default function Topbar() {
  return <header>Topbar</header>;
}
EOF

cat > components/layout/BranchSwitcher.tsx <<'EOF'
// TODO: Branch switcher dropdown
export default function BranchSwitcher() {
  return <div>BranchSwitcher</div>;
}
EOF

cat > components/sales/SalesPageTemplate.tsx <<'EOF'
// TODO: shared by Pharmacy/Lab/Service Sales pages
export default function SalesPageTemplate({ type }: { type: "pharmacy" | "lab" | "service" }) {
  return <div>SalesPageTemplate: {type}</div>;
}
EOF
touch components/sales/PharmacySalesClient.tsx
touch components/sales/LaboratorySalesClient.tsx
touch components/sales/ServicesOrderClient.tsx
touch components/sales/ProductLineTable.tsx
touch components/sales/PaymentSummary.tsx

touch components/dr-note/DrNoteForm.tsx
touch components/dr-note/DrNoteList.tsx

touch components/shared/DataTable.tsx
touch components/shared/FilterBar.tsx
touch components/shared/ConfirmDialog.tsx

# 6. lib/
mkdir -p lib/actions lib/validators lib/utils lib/supabase

cat > lib/prisma.ts <<'EOF'
// Prisma client singleton — THE ONLY database access layer.
// Supabase (if used) is for Auth/Storage ONLY, never for DB queries.
import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
EOF

cat > lib/auth.ts <<'EOF'
// TODO: getSession() helper — reads auth cookie, returns { userId, tenantId, branchId, groupId }
export async function getSession(req: Request) {
  return null;
}
EOF

cat > lib/rbac.ts <<'EOF'
// TODO: checkPermission(userId, "module.action") using Prisma Privilege table
export async function checkPermission(userId: string, permission: string): Promise<boolean> {
  return false;
}
EOF

touch lib/actions/sales.actions.ts
touch lib/actions/inventory.actions.ts
touch lib/actions/purchase.actions.ts
touch lib/actions/patients.actions.ts
touch lib/actions/laboratory.actions.ts
touch lib/actions/hr.actions.ts
touch lib/actions/reports.actions.ts
touch lib/actions/billing.actions.ts

touch lib/validators/sales.schema.ts
touch lib/validators/products.schema.ts

cat > lib/utils/currency.ts <<'EOF'
// TODO: multi-currency conversion helper (USD, SOS, ETB, tenant-configurable)
export function convertCurrency(amount: number, fromRate: number, toRate: number) {
  return (amount / fromRate) * toRate;
}
EOF
touch lib/utils/formatters.ts

# Supabase used ONLY for Auth/Storage, not DB access
cat > lib/supabase/client.ts <<'EOF'
// Browser client — Auth/Storage only. DB access goes through Prisma (lib/prisma.ts).
import { createBrowserClient } from "@supabase/ssr";

export const supabaseBrowser = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
EOF

cat > lib/supabase/server.ts <<'EOF'
// Server client — Auth/Storage only. DB access goes through Prisma (lib/prisma.ts).
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export function supabaseServer() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name) => cookieStore.get(name)?.value } }
  );
}
EOF

# 7. middleware.ts
cat > middleware.ts <<'EOF'
// TODO: auth guard + tenant/branch context + privilege route check
import { NextResponse, type NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
EOF

# 8. prisma/ — Prisma ONLY, no raw .sql files
mkdir -p prisma
touch prisma/schema.prisma
touch prisma/seed.ts

# 9. types/
mkdir -p types
touch types/index.ts

# 10. Root config files
touch .env.example
cat > .env.example <<'EOF'
DATABASE_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
EOF

cat > package.json <<'EOF'
{
  "name": "pharmacloud",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:seed": "tsx prisma/seed.ts"
  },
  "dependencies": {
    "next": "^15.0.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "@prisma/client": "^5.20.0",
    "@supabase/ssr": "^0.5.0",
    "zod": "^3.23.0",
    "stripe": "^16.0.0"
  },
  "devDependencies": {
    "prisma": "^5.20.0",
    "typescript": "^5.5.0",
    "tsx": "^4.16.0"
  }
}
EOF

echo "✅ Done. Project structure created."
