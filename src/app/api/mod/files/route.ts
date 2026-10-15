import { NextResponse } from "next/server";
import { isAdmin, requireStaff } from "@/lib/session";
import { getObject } from "@/lib/storage";
import { logAction } from "@/lib/moderation/staff-actions";

/**
 * Selfies under review (moderators) and preserved evidence (admins only, every
 * download logged).
 */
export async function GET(req: Request) {
  const staff = await requireStaff();
  if (!staff) return new NextResponse(null, { status: 404 });

  const key = new URL(req.url).searchParams.get("key") ?? "";
  if (!/^(selfies|evidence)\/[\w./-]+$/.test(key) || key.includes("..")) {
    return new NextResponse(null, { status: 400 });
  }
  if (key.startsWith("evidence/") && !isAdmin(staff.role)) {
    return new NextResponse(null, { status: 404 });
  }
  const body = await getObject(key);
  if (!body) return new NextResponse(null, { status: 404 });

  if (key.startsWith("evidence/")) {
    await logAction({ actorId: staff.id, action: "evidence_view", note: key });
  }

  const type = key.endsWith(".json")
    ? "application/json"
    : key.endsWith(".webp")
      ? "image/webp"
      : "application/octet-stream";
  return new NextResponse(new Uint8Array(body), {
    headers: {
      "Content-Type": type,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": type.startsWith("image/")
        ? "inline"
        : "attachment",
    },
  });
}
