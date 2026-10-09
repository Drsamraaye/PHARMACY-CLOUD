import { NextRequest } from "next/server";
import { collectionGET, collectionPOST, collectionPATCH, collectionDELETE } from "@/lib/http/module-records";

export function GET(req: NextRequest) { return collectionGET(req, "hr/leave"); }
export function POST(req: NextRequest) { return collectionPOST(req, "hr/leave"); }
export function PUT(req: NextRequest) { return collectionPATCH(req, "hr/leave"); }
export function PATCH(req: NextRequest) { return collectionPATCH(req, "hr/leave"); }
export function DELETE(req: NextRequest) { return collectionDELETE(req, "hr/leave"); }
