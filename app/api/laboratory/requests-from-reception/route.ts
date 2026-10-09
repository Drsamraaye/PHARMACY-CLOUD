import { NextRequest } from "next/server";
import { collectionGET, collectionPOST, collectionPATCH, collectionDELETE } from "@/lib/http/module-records";

export function GET(req: NextRequest) { return collectionGET(req, "laboratory/requests-from-reception"); }
export function POST(req: NextRequest) { return collectionPOST(req, "laboratory/requests-from-reception"); }
export function PUT(req: NextRequest) { return collectionPATCH(req, "laboratory/requests-from-reception"); }
export function PATCH(req: NextRequest) { return collectionPATCH(req, "laboratory/requests-from-reception"); }
export function DELETE(req: NextRequest) { return collectionDELETE(req, "laboratory/requests-from-reception"); }
