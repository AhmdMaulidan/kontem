"use server";

import { redirect } from "next/navigation";
import { destroySession } from "@/lib/auth";

/**
 * Keluar dari sesi. Ditaruh di _actions karena dipakai shell dashboard yang
 * dipakai bersama ketiga role, bukan milik salah satu route group.
 */
export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
