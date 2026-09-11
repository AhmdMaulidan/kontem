import type { ReactNode } from "react";
import { cn } from "./utils";

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[36rem] text-sm">{children}</table>
    </div>
  );
}

export function Th({
  children,
  align,
}: {
  children: ReactNode;
  align?: "right";
}) {
  return (
    <th
      className={cn(
        "border-b border-line px-3 py-2.5 text-xs font-semibold tracking-wide text-muted",
        align === "right" ? "text-right" : "text-left",
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  align,
  className,
}: {
  children: ReactNode;
  align?: "right";
  className?: string;
}) {
  return (
    <td
      className={cn(
        "border-b border-line px-3 py-3 align-middle",
        align === "right" ? "tabular text-right" : "",
        className,
      )}
    >
      {children}
    </td>
  );
}

export function DescriptionList({
  items,
}: {
  items: Array<{ label: string; value: ReactNode }>;
}) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label}>
          <dt className="text-xs font-semibold tracking-wide text-muted">
            {item.label}
          </dt>
          <dd className="mt-0.5 text-sm text-body">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
