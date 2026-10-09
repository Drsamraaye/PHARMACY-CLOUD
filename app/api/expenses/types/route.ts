import { NextRequest } from "next/server";
import { collectionGET, collectionPOST, collectionPATCH, collectionDELETE } from "@/lib/http/module-records";

export function GET(req: NextRequest) { return collectionGET(req, "expenses/types"); }
export function POST(req: NextRequest) { return collectionPOST(req, "expenses/types"); }
export function PUT(req: NextRequest) { return collectionPATCH(req, "expenses/types"); }
export function PATCH(req: NextRequest) { return collectionPATCH(req, "expenses/types"); }
export function DELETE(req: NextRequest) { return collectionDELETE(req, "expenses/types"); }
