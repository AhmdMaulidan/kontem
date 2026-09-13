import type { ComponentProps, ReactNode } from "react";
import { cn } from "./utils";

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-foreground">{label}</span>
      {hint ? (
        <span className="mt-0.5 block text-xs text-muted">{hint}</span>
      ) : null}
      <div className="mt-1.5">{children}</div>
      {error ? (
        <span className="mt-1 block text-xs text-danger">{error}</span>
      ) : null}
    </label>
  );
}

// Input memakai rounded-xl, bukan rounded-full, supaya teks panjang dan
// textarea tetap terbaca — pill disimpan untuk tombol dan badge.
const controlClass =
  "w-full rounded-xl border border-line bg-surface px-4 py-2.5 text-sm text-body transition-colors outline-none placeholder:text-muted/70 focus:border-brand-400 focus:ring-4 focus:ring-brand-100";

// Select butuh pr lebih lebar supaya native browser arrow tidak menempel
// ke border kanan — px-4 hanya 16px, sedangkan arrow browser butuh ~24px.
const selectClass =
  "w-full rounded-xl border border-line bg-surface pl-4 pr-10 py-2.5 text-sm text-body transition-colors outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-100";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input {...props} className={cn(controlClass, className)} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea {...props} className={cn(controlClass, className)} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select {...props} className={cn(selectClass, className)} />;
}

/** Pesan error hasil validasi server action. */
export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="rounded-2xl border border-danger-line bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
      {message}
    </p>
  );
}
