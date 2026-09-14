import Link from "next/link";
import { Badge, EmptyState, Table, Td, Th } from "@/components/ui";

type Row = {
  id: string;
  sourceUrl: string;
  status: string;
  score: number | null;
  compliant: boolean | null;
  campaign: { title: string } | null;
  createdAt: Date;
};

const statusTone: Record<string, "neutral" | "info" | "success" | "warning" | "danger"> = {
  QUEUED: "neutral",
  PROCESSING: "info",
  COMPLETED: "success",
  FAILED: "danger",
};

export function RecentAnalyses({ analyses }: { analyses: Row[] }) {
  if (analyses.length === 0) return <EmptyState title="Belum ada analisis" />;

  return (
    <Table>
      <thead>
        <tr>
          <Th>Sumber</Th>
          <Th>Skor</Th>
          <Th>Status</Th>
          <Th>{" "}</Th>
        </tr>
      </thead>
      <tbody>
        {analyses.map((a) => (
          <tr key={a.id}>
            <Td>
              <span className="line-clamp-1 max-w-[200px] font-medium">{a.campaign?.title ?? "—"}</span>
              <span className="block max-w-[200px] truncate text-xs text-muted">{a.sourceUrl}</span>
            </Td>
            <Td>
              {a.score === null ? (
                <span className="text-muted">—</span>
              ) : (
                <span className={a.compliant ? "font-semibold text-success" : "font-semibold text-danger"}>
                  {Math.round(a.score)}/100
                </span>
              )}
            </Td>
            <Td>
              <Badge tone={statusTone[a.status] ?? "neutral"} icon>
                {a.status}
              </Badge>
            </Td>
            <Td align="right">
              <Link href={`/admin/analyzer/report/${a.id}`} className="text-brand hover:underline">
                Detail →
              </Link>
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
