import { NextRequest } from "next/server";
import { moveBankFunds } from "@/lib/http/bank";
export function POST(req: NextRequest) { return moveBankFunds(req, "DEPOSIT"); }
