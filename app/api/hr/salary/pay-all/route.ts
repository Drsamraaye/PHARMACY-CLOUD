import { NextRequest } from "next/server";
import { collectionGET, collectionPOST, collectionPATCH, collectionDELETE } from "@/lib/http/module-records";

export function GET(req: NextRequest) { return collectionGET(req, "hr/salary/pay-all"); }
export function POST(req: NextRequest) { return collectionPOST(req, "hr/salary/pay-all"); }
export function PUT(req: NextRequest) { return collectionPATCH(req, "hr/salary/pay-all"); }
export function PATCH(req: NextRequest) { return collectionPATCH(req, "hr/salary/pay-all"); }
export function DELETE(req: NextRequest) { return collectionDELETE(req, "hr/salary/pay-all"); }
