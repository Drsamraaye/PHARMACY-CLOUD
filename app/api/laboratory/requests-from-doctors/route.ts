import { NextRequest } from "next/server";
import { collectionGET, collectionPOST, collectionPATCH, collectionDELETE } from "@/lib/http/module-records";

export function GET(req: NextRequest) { return collectionGET(req, "laboratory/requests-from-doctors"); }
export function POST(req: NextRequest) { return collectionPOST(req, "laboratory/requests-from-doctors"); }
export function PUT(req: NextRequest) { return collectionPATCH(req, "laboratory/requests-from-doctors"); }
export function PATCH(req: NextRequest) { return collectionPATCH(req, "laboratory/requests-from-doctors"); }
export function DELETE(req: NextRequest) { return collectionDELETE(req, "laboratory/requests-from-doctors"); }
