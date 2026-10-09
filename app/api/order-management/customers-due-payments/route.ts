import { NextRequest } from "next/server";
import { customersDue } from "@/lib/http/sales-reports";
export function GET(req: NextRequest) { return customersDue(req); }
