/**
 * Barrel design system Kontem.
 *
 * Semua halaman mengimpor dari "@/components/ui" saja, tidak pernah langsung
 * ke file per komponen — sehingga penyesuaian visual cukup dilakukan di dalam
 * folder ini tanpa menyentuh halaman.
 */
export * from "./icon";
export {
  LogoTikTok,
  LogoInstagram,
  LogoYouTube,
  LogoGoogle,
  socialBrandColor,
} from "./social-logo";
export { cn } from "./utils";
export { toneClasses, toneIcons } from "./tone";

export { Button, ButtonLink, buttonVariants, buttonSizes, buttonClass } from "./button";
export type { ButtonVariant, ButtonSize, ButtonShape } from "./button";
export { SubmitButton } from "./submit-button";

export { Accordion } from "./accordion";
export type { AccordionItem } from "./accordion";
export { Card, CardHeader } from "./card";
export { Logo } from "./logo";
export { CountUp } from "./count-up";
export { CatalogCard } from "./catalog-card";
// Chip pada baris fakta kartu katalog (design.md 6.3 & 6.5). Diekspor karena
// dipakai ulang di luar kartu juga.
export { FactChip } from "./fact-chip";
export { PageHeader } from "./page-header";
export { EmptyState } from "./empty-state";

export { Badge } from "./badge";
export { Callout } from "./callout";
export { Stat } from "./stat";
export { ProgressBar } from "./progress";

export { Table, Th, Td, DescriptionList } from "./table";
// Pola tabel kerja admin: header judul + ringkasan antrean, kolom nomor
// menerus lintas halaman, toolbar cari/filter, kaki pagination.
export {
  DataTable,
  TableCaptionRow,
  TableEmptyRow,
  rowNumber,
} from "./data-table";
export { TableToolbar, Pagination, PageSizeSelect } from "./toolbar";
export type { ToolbarFilter, ToolbarToggle, TableParams } from "./toolbar";
export {
  ENTRY_SIZE_OPTIONS,
  resolvePageSize,
  paginationArgs,
} from "./pagination-utils";
export { DetailDrawer, CopyButton } from "./detail-drawer";
export { BarChart } from "./bar-chart";
export { Field, Input, Textarea, Select, FormError } from "./form";
