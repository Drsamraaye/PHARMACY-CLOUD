import { NextRequest } from "next/server";
import { collectionGET, collectionPOST, collectionPATCH, collectionDELETE } from "@/lib/http/module-records";

export function GET(req: NextRequest) { return collectionGET(req, "laboratory/records"); }
export function POST(req: NextRequest) { return collectionPOST(req, "laboratory/records"); }
export function PUT(req: NextRequest) { return collectionPATCH(req, "laboratory/records"); }
export function PATCH(req: NextRequest) { return collectionPATCH(req, "laboratory/records"); }
export function DELETE(req: NextRequest) { return collectionDELETE(req, "laboratory/records"); }
