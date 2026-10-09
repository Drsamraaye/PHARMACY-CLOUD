import { NextRequest } from "next/server";
import { collectionGET, collectionPOST, collectionPATCH, collectionDELETE } from "@/lib/http/module-records";

export function GET(req: NextRequest) { return collectionGET(req, "expenses"); }
export function POST(req: NextRequest) { return collectionPOST(req, "expenses"); }
export function PUT(req: NextRequest) { return collectionPATCH(req, "expenses"); }
export function PATCH(req: NextRequest) { return collectionPATCH(req, "expenses"); }
export function DELETE(req: NextRequest) { return collectionDELETE(req, "expenses"); }
