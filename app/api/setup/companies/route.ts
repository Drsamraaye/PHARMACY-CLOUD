import { NextRequest } from "next/server";
import { collectionGET, collectionPOST, collectionPATCH, collectionDELETE } from "@/lib/http/module-records";

export function GET(req: NextRequest) { return collectionGET(req, "setup/companies"); }
export function POST(req: NextRequest) { return collectionPOST(req, "setup/companies"); }
export function PUT(req: NextRequest) { return collectionPATCH(req, "setup/companies"); }
export function PATCH(req: NextRequest) { return collectionPATCH(req, "setup/companies"); }
export function DELETE(req: NextRequest) { return collectionDELETE(req, "setup/companies"); }
