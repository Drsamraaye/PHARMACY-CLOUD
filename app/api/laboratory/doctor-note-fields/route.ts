import { NextRequest } from "next/server";
import { collectionGET, collectionPOST, collectionPATCH, collectionDELETE } from "@/lib/http/module-records";

export function GET(req: NextRequest) { return collectionGET(req, "laboratory/doctor-note-fields"); }
export function POST(req: NextRequest) { return collectionPOST(req, "laboratory/doctor-note-fields"); }
export function PUT(req: NextRequest) { return collectionPATCH(req, "laboratory/doctor-note-fields"); }
export function PATCH(req: NextRequest) { return collectionPATCH(req, "laboratory/doctor-note-fields"); }
export function DELETE(req: NextRequest) { return collectionDELETE(req, "laboratory/doctor-note-fields"); }
