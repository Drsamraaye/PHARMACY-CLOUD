import { NextRequest } from "next/server";
import { collectionGET, collectionPOST, collectionPATCH, collectionDELETE } from "@/lib/http/module-records";

export function GET(req: NextRequest) { return collectionGET(req, "patient-medications/plans"); }
export function POST(req: NextRequest) { return collectionPOST(req, "patient-medications/plans"); }
export function PUT(req: NextRequest) { return collectionPATCH(req, "patient-medications/plans"); }
export function PATCH(req: NextRequest) { return collectionPATCH(req, "patient-medications/plans"); }
export function DELETE(req: NextRequest) { return collectionDELETE(req, "patient-medications/plans"); }
