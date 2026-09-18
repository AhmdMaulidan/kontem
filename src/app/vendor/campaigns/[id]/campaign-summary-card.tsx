import type { CampaignSettlementSummary } from "@/domain/campaign";
import {
  Badge,
  Card,
  CardHeader,
  ProgressBar,
  Stat,
  IconCheck,
  IconExternal,
  IconEye,
  IconTrend,
} from "@/components/ui";
import { formatCompact, formatDate, formatIDR } from "@/lib/format";
import { platformLabel } from "@/lib/labels";

type CampaignSummaryCardProps = {
  summary: CampaignSettlementSummary;
};

export function CampaignSummaryCard({ summary }: CampaignSummaryCardProps) {
  return (
    <div className="space-y-6">
      <Card className="border-brand/30 bg-gradient-to-br from-surface via-surface to-brand-soft/20 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Badge tone="teal">
                <span className="flex items-center gap-1">
                  <IconCheck className="h-3 w-3" />
                  Laporan Selesai Campaign
                </span>
              </Badge>
              {summary.settledAt ? (
                <span className="text-xs text-muted">
                  Diselesaikan {formatDate(summary.settledAt)}
                </span>
              ) : null}
            </div>
            <h2 className="mt-2 text-xl font-bold text-foreground">
              Ringkasan Performa & Hasil Promosi
            </h2>
            <p className="mt-1 text-sm text-muted">
              Rekapitulasi total reach, konten terkumpul, efisiensi CPM aktual, dan kreator terbaik.
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2 rounded-xl bg-surface-muted/80 p-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted">
                Efisiensi CPM
              </p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-bold text-foreground">
                  {formatIDR(summary.realizedCpm)}
                </span>
                <span className="text-xs text-muted">/ 1k views</span>
              </div>
              {summary.cpmEfficiencyPercent > 0 ? (
                <p className="mt-0.5 text-xs font-semibold text-success">
                  {summary.cpmEfficiencyPercent}% lebih hemat dari target
                </p>
              ) : (
                <p className="mt-0.5 text-xs text-muted">
                  Sesuai target {formatIDR(summary.targetCpm)}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* 4 Pilar Metrik Utama */}
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat
            label="Total Reach (Views Riil)"
            value={formatCompact(summary.totalReach)}
            hint={`${summary.approvedSubmissions} video terverifikasi`}
            tone="brand"
          />
          <Stat
            label="Konten Terkumpul"
            value={`${summary.approvedSubmissions} Konten`}
            hint={
              summary.rejectedSubmissions > 0
                ? `${summary.rejectedSubmissions} submission ditolak`
                : "Semua submission lolos"
            }
          />
          <Stat
            label="Budget Terpakai"
            value={formatIDR(summary.budgetSpent)}
            hint={`${summary.budgetAbsorptionRate}% dari ${formatIDR(summary.budgetPool)}`}
          />
          <Stat
            label="Pengembalian Escrow"
            value={formatIDR(summary.refundAmount)}
            hint={
              summary.refundAmount > 0
                ? "Sisa pool dikembalikan ke rekening"
                : "Seluruh budget pool terserap optimal"
            }
            tone={summary.refundAmount > 0 ? "brand" : undefined}
          />
        </div>

        {/* Penyerapan Dana */}
        <div className="mt-6 rounded-xl bg-surface-muted/50 p-4">
          <div className="mb-2 flex justify-between text-xs">
            <span className="font-medium text-muted">Serapan Budget Pool Vendor</span>
            <span className="tabular font-semibold text-foreground">
              {formatIDR(summary.budgetSpent)} ({summary.budgetAbsorptionRate}%) dari {formatIDR(summary.budgetPool)}
            </span>
          </div>
          <ProgressBar value={summary.budgetSpent} max={summary.budgetPool} tone="brand" />
        </div>
      </Card>

      {/* Top Performer Creators & Platform Breakdown Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Top Performer Creators */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Kreator Top Performer"
            description="Kreator dengan jangkauan views tertinggi yang berkontribusi paling besar pada campaign ini."
          />

          {summary.topPerformers.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">
              Belum ada data performer yang tercatat.
            </p>
          ) : (
            <div className="space-y-3">
              {summary.topPerformers.map((performer) => {
                const medalColor =
                  performer.rank === 1
                    ? "bg-amber-100 text-amber-800 border-amber-300"
                    : performer.rank === 2
                      ? "bg-slate-100 text-slate-700 border-slate-300"
                      : "bg-orange-100 text-orange-800 border-orange-300";

                return (
                  <div
                    key={performer.submissionId}
                    className="flex flex-col gap-3 rounded-xl border border-border bg-surface-muted/40 p-4 transition-colors hover:bg-surface-muted/70 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${medalColor}`}
                      >
                        #{performer.rank}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-foreground">
                            {performer.creatorName}
                          </p>
                          <Badge tone="neutral">
                            {platformLabel[performer.platform]}
                          </Badge>
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                          <span className="flex items-center gap-1">
                            <IconEye className="h-3.5 w-3.5" />
                            {formatCompact(performer.rawViews)} views
                          </span>
                          <span>·</span>
                          <span className="flex items-center gap-1">
                            <IconTrend className="h-3.5 w-3.5" />
                            {performer.sharePercent.toFixed(1)}% share
                          </span>
                          {performer.isCapped ? (
                            <span className="text-amber-700 font-medium">
                              (plafon maks {formatCompact(performer.views)})
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-4 border-t border-border pt-2 sm:border-t-0 sm:pt-0">
                      <div className="text-left sm:text-right">
                        <p className="text-[11px] uppercase tracking-wider text-muted">
                          Bagi Hasil
                        </p>
                        <p className="tabular font-semibold text-foreground">
                          {formatIDR(performer.grossAmount)}
                        </p>
                      </div>
                      <a
                        href={performer.contentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-surface-muted hover:text-brand"
                      >
                        <span>Lihat Video</span>
                        <IconExternal className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Platform Breakdown */}
        <Card>
          <CardHeader
            title="Sebaran Platform"
            description="Distribusi konten & jangkauan per media sosial."
          />

          {summary.platforms.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">
              Tidak ada data platform.
            </p>
          ) : (
            <div className="space-y-4">
              {summary.platforms.map((p) => (
                <div key={p.platform} className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-foreground">
                      {platformLabel[p.platform]} ({p.submissionsCount} video)
                    </span>
                    <span className="tabular font-medium text-muted">
                      {formatCompact(p.totalViews)} views ({p.sharePercent.toFixed(1)}%)
                    </span>
                  </div>
                  <ProgressBar
                    value={p.totalViews}
                    max={summary.totalReach}
                    tone="brand"
                  />
                </div>
              ))}

              <div className="mt-6 rounded-xl border border-dashed border-border p-3 text-center text-xs text-muted">
                Total {summary.approvedSubmissions} video terverifikasi menghasilkan{" "}
                <strong className="text-foreground">{formatCompact(summary.totalReach)} views</strong>{" "}
                untuk bisnismu.
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
