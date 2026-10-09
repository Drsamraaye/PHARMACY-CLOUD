import { NextRequest } from "next/server";
import { collectionGET, collectionPOST, collectionPATCH, collectionDELETE } from "@/lib/http/module-records";

export function GET(req: NextRequest) { return collectionGET(req, "tickets"); }
export function POST(req: NextRequest) { return collectionPOST(req, "tickets"); }
export function PUT(req: NextRequest) { return collectionPATCH(req, "tickets"); }
export function PATCH(req: NextRequest) { return collectionPATCH(req, "tickets"); }
export function DELETE(req: NextRequest) { return collectionDELETE(req, "tickets"); }
