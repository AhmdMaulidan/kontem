const idr = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const number = new Intl.NumberFormat("id-ID");

const dateFmt = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const dateTimeFmt = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatIDR(value: number) {
  return idr.format(value);
}

export function formatNumber(value: number) {
  return number.format(value);
}

/** 1.234 -> "1,2 rb", 1.234.567 -> "1,2 jt" — untuk kartu statistik. */
export function formatCompact(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(".", ",")} jt`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace(".", ",")} rb`;
  return number.format(value);
}

export function formatDate(value: Date | string) {
  return dateFmt.format(new Date(value));
}

export function formatDateTime(value: Date | string) {
  return dateTimeFmt.format(new Date(value));
}

export function daysUntil(value: Date | string) {
  const diff = new Date(value).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
