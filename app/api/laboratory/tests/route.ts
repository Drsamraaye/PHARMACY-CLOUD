import { NextRequest } from "next/server";
import { collectionGET, collectionPOST, collectionPATCH, collectionDELETE } from "@/lib/http/module-records";

export function GET(req: NextRequest) { return collectionGET(req, "laboratory/tests"); }
export function POST(req: NextRequest) { return collectionPOST(req, "laboratory/tests"); }
export function PUT(req: NextRequest) { return collectionPATCH(req, "laboratory/tests"); }
export function PATCH(req: NextRequest) { return collectionPATCH(req, "laboratory/tests"); }
export function DELETE(req: NextRequest) { return collectionDELETE(req, "laboratory/tests"); }
