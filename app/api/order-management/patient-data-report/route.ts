import { NextRequest } from "next/server";
import { patientSalesReport } from "@/lib/http/sales-reports";
export function GET(req: NextRequest) { return patientSalesReport(req); }
