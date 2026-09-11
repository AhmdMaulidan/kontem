"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

/** Tandai semua notifikasi milik user yang sedang login sebagai sudah dibaca. */
export async function markAllReadAction(formData: FormData) {
  const user = await requireUser();
  await db.notification.updateMany({
    where: { userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath(String(formData.get("path") ?? "/"));
}
