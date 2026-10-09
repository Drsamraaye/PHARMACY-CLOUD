import { NextRequest } from "next/server";
import { collectionGET, collectionPOST, collectionPATCH, collectionDELETE } from "@/lib/http/module-records";

export function GET(req: NextRequest) { return collectionGET(req, "laboratory/section-order"); }
export function POST(req: NextRequest) { return collectionPOST(req, "laboratory/section-order"); }
export function PUT(req: NextRequest) { return collectionPATCH(req, "laboratory/section-order"); }
export function PATCH(req: NextRequest) { return collectionPATCH(req, "laboratory/section-order"); }
export function DELETE(req: NextRequest) { return collectionDELETE(req, "laboratory/section-order"); }
