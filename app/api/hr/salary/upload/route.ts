import { NextRequest } from "next/server";
import { collectionGET, collectionPOST } from "@/lib/http/module-records";

export function GET(req: NextRequest) { return collectionGET(req, "hr/salary-upload"); }
export function POST(req: NextRequest) { return collectionPOST(req, "hr/salary-upload"); }
