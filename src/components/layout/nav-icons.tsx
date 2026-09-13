import {
  IconBanknote,
  IconBell,
  IconBusiness,
  IconCompass,
  IconDashboard,
  IconEye,
  IconFileCheck,
  IconGavel,
  IconMegaphone,
  IconPlus,
  IconShieldAlert,
  IconStore,
  IconTicket,
  IconVideo,
  IconWallet,
  type LucideIcon,
} from "@/components/ui";

/**
 * Ikon menu samping.
 *
 * Layout role adalah Server Component, sedangkan menu sampingnya Client
 * Component — komponen React tidak bisa dioper melewati batas itu. Karena itu
 * item menu hanya membawa *nama* ikon, dan pemetaannya ke komponen dilakukan
 * di sisi klien lewat tabel ini.
 */
export const navIcons = {
  dashboard: IconDashboard,
  vendor: IconBusiness,
  campaign: IconMegaphone,
  plus: IconPlus,
  views: IconEye,
  dispute: IconGavel,
  fraud: IconShieldAlert,
  payout: IconBanknote,
  explore: IconCompass,
  submission: IconVideo,
  review: IconFileCheck,
  ticket: IconTicket,
  earnings: IconWallet,
  outlet: IconStore,
  notification: IconBell,
} satisfies Record<string, LucideIcon>;

export type NavIconName = keyof typeof navIcons;
