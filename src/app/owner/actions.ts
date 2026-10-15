"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { UserRole } from "@prisma/client";
import { requireStaff } from "@/lib/session";
import { setStaffRole } from "@/lib/staff-roles";

export async function changeRole(fd: FormData) {
  const owner = await requireStaff("OWNER");
  if (!owner) redirect("/feed");

  const result = await setStaffRole({
    actor: owner,
    userId: String(fd.get("userId") ?? ""),
    role: String(fd.get("role") ?? "") as UserRole,
    reason: String(fd.get("reason") ?? ""),
  });
  revalidatePath("/owner/staff");
  const q = String(fd.get("q") ?? "");
  const params = new URLSearchParams(
    result.ok ? { ok: result.message } : { error: result.error },
  );
  if (q) params.set("q", q);
  redirect(`/owner/staff?${params}`);
}
