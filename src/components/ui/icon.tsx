/**
 * Set ikon Kontem.
 *
 * Halaman mengimpor ikon dari `@/components/ui`, tidak pernah langsung dari
 * `lucide-react`, supaya pustaka ikon bisa diganti cukup dari file ini.
 *
 * Ikon dipakai sebagai SVG stroke — jangan memakai emoji sebagai ikon
 * antarmuka, karena bentuknya berbeda-beda di tiap sistem operasi dan
 * membuat tampilan terlihat tidak dirancang.
 */
export {
  AlertTriangle as IconAlert,
  ArrowRight as IconArrowRight,
  Banknote as IconBanknote,
  Bell as IconBell,
  Building2 as IconBusiness,
  Check as IconCheck,
  ChevronRight as IconChevronRight,
  Clock as IconClock,
  Coffee as IconCoffee,
  CreditCard as IconCard,
  ExternalLink as IconExternal,
  Eye as IconEye,
  Gift as IconGift,
  Landmark as IconBank,
  Lock as IconLock,
  LogOut as IconLogout,
  MapPin as IconPin,
  Megaphone as IconMegaphone,
  Scale as IconScale,
  Search as IconSearch,
  ShieldCheck as IconShield,
  Sparkles as IconSparkles,
  Star as IconStar,
  TrendingUp as IconTrend,
  Users as IconUsers,
  Wallet as IconWallet,
  X as IconX,
} from "lucide-react";

export type { LucideIcon } from "lucide-react";
