import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatCompact, formatDateTime } from "@/lib/format";
import {
  Badge,
  Callout,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
} from "@/components/ui";
import { fraudFlagLabel } from "@/lib/labels";
import { resolveFlagAction } from "../actions";
import { DecisionForm } from "../decision-form";

export default async function AdminFraudPage() {
  await requireRole("ADMIN");

  const [flags, akunGanda] = await Promise.all([
    db.fraudFlag.findMany({
      where: { status: { in: ["OPEN", "REVIEWING"] } },
      include: {
        submission: { include: { campaign: true } },
        flaggedUser: { include: { creatorProfile: true } },
        reportedBy: { select: { name: true, role: true } },
      },
      orderBy: [{ severity: "desc" }, { createdAt: "asc" }],
    }),
    // Indikasi akun ganda sederhana: satu nomor HP dipakai lebih dari satu user.
    db.user.groupBy({
      by: ["phone"],
      _count: { _all: true },
      where: { role: "CREATOR", phone: { not: null } },
      having: { phone: { _count: { gt: 1 } } },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Deteksi fraud"
        description="Flag otomatis dari sistem dan laporan manual dari vendor."
      />

      {akunGanda.length > 0 ? (
        <div className="mb-6">
          <Callout tone="warning" title="Indikasi akun ganda">
            {akunGanda.length} nomor HP terdaftar di lebih dari satu akun creator.
            Periksa sebelum payout dicairkan.
          </Callout>
        </div>
      ) : null}

      <Card>
        <CardHeader
          title={`Laporan menunggu tinjauan (${flags.length})`}
          description="Diurutkan dari tingkat keparahan tertinggi."
        />
        {flags.length === 0 ? (
          <EmptyState
            title="Tidak ada laporan terbuka"
            description="Sistem menandai otomatis kalau views turun tidak wajar."
          />
        ) : (
          <ul className="space-y-5">
            {flags.map((flag) => (
              <li key={flag.id} className="rounded-xl border border-line p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={flag.severity >= 3 ? "danger" : "warning"}>
                        {fraudFlagLabel[flag.type]}
                      </Badge>
                      <span className="text-xs text-muted">
                        severity {flag.severity} ·{" "}
                        {flag.reportedBy
                          ? `dilaporkan ${flag.reportedBy.name}`
                          : "flag otomatis sistem"}{" "}
                        · {formatDateTime(flag.createdAt)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm">{flag.detail}</p>
                    {flag.submission ? (
                      <p className="mt-1 text-sm text-muted">
                        {flag.submission.campaign.title} ·{" "}
                        {formatCompact(flag.submission.lastViews)} views ·{" "}
                        <a
                          href={flag.submission.contentUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-brand"
                        >
                          buka konten
                        </a>
                      </p>
                    ) : null}
                  </div>
                  {flag.flaggedUser ? (
                    <div className="text-right text-sm">
                      <p className="font-medium">{flag.flaggedUser.name}</p>
                      <p className="text-xs text-muted">
                        trust {flag.flaggedUser.creatorProfile?.trustScore ?? "—"}/100
                      </p>
                    </div>
                  ) : null}
                </div>

                <div className="mt-4 border-t border-line pt-4">
                  <DecisionForm
                    action={resolveFlagAction}
                    hiddenField="flagId"
                    hiddenValue={flag.id}
                    approveValue="dismiss"
                    rejectValue="confirm"
                    approveLabel="Tutup, tidak terbukti"
                    rejectLabel="Konfirmasi kecurangan"
                    noteLabel="Dasar konfirmasi"
                    noteHint="Trust score creator turun 15 poin dan payout yang belum cair ditahan."
                    requireNoteOnApprove
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
