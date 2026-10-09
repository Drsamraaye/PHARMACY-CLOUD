import { NextRequest } from "next/server";
import { collectionGET, collectionPOST, collectionPATCH, collectionDELETE } from "@/lib/http/module-records";

export function GET(req: NextRequest) { return collectionGET(req, "dr-note"); }
export function POST(req: NextRequest) { return collectionPOST(req, "dr-note"); }
export function PUT(req: NextRequest) { return collectionPATCH(req, "dr-note"); }
export function PATCH(req: NextRequest) { return collectionPATCH(req, "dr-note"); }
export function DELETE(req: NextRequest) { return collectionDELETE(req, "dr-note"); }
