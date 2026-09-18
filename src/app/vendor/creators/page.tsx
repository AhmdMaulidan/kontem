import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getVendorCollaborators } from "@/domain/creator-collaborator";
import { formatCompact, formatDate } from "@/lib/format";
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  Stat,
} from "@/components/ui";
import { platformLabel } from "@/lib/labels";

export default async function VendorCreatorsPage() {
  const user = await requireRole("VENDOR");
  const collaborators = await getVendorCollaborators(user.id);

  const totalViews = collaborators.reduce(
    (sum, c) => sum + c.totalViewsGenerated,
    0,
  );
  const totalApproved = collaborators.reduce(
    (sum, c) => sum + c.approvedSubmissionsCount,
    0,
  );
  const avgViews =
    collaborators.length > 0 ? Math.round(totalViews / collaborators.length) : 0;

  return (
    <div>
      <PageHeader
        title="Kreator Kolaborator"
        description="Rekam jejak performa para kreator yang pernah menyelesaikan konten di campaign usahamu. Gunakan data ini untuk mengundang kembali (re-invite) kreator berkinerja terbaik."
      />

      {collaborators.length === 0 ? (
        <EmptyState
          title="Belum ada kolaborator"
          description="Kreator yang kontennya telah disetujui pada campaign milikmu akan otomatis dirangkum di direktori ini."
        />
      ) : (
        <div className="space-y-6">
          {/* Ringkasan Performa Kolaborator */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat
              label="Total kolaborator unik"
              value={collaborators.length}
              hint={`${totalApproved} video disetujui`}
            />
            <Stat
              label="Total views disumbangkan"
              value={`${formatCompact(totalViews)} views`}
              hint="Dari seluruh campaign milikmu"
            />
            <Stat
              label="Rata-rata views / kreator"
              value={`${formatCompact(avgViews)} views`}
              hint="Performa rata-rata per kolaborator"
            />
          </div>

          {/* Daftar Kolaborator */}
          <Card className="p-0">
            <div className="p-5 pb-3 border-b border-line">
              <CardHeader
                title={`Direktori Kolaborator (${collaborators.length})`}
                description="Diurutkan berdasarkan kontribusi views tertinggi."
              />
            </div>
            <ul className="divide-y divide-line">
              {collaborators.map((c, index) => (
                <li
                  key={c.creatorId}
                  className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-foreground">
                        #{index + 1} {c.creatorName}
                      </span>
                      <Badge
                        tone={c.trustScore >= 70 ? "success" : "warning"}
                      >
                        Trust {c.trustScore}/100
                      </Badge>
                      <span className="text-xs text-muted">
                        Domisili: {c.city}
                      </span>
                    </div>

                    {/* Akun Sosial */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {c.socialAccounts.length === 0 ? (
                        <span className="text-xs text-muted">
                          Tidak ada tautan sosmed
                        </span>
                      ) : (
                        c.socialAccounts.map((acc) => (
                          <a
                            key={`${acc.platform}-${acc.handle}`}
                            href={acc.profileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-md bg-surface-muted px-2 py-0.5 text-xs text-brand-600 transition-colors hover:bg-brand-soft"
                          >
                            <span className="font-medium">
                              {platformLabel[acc.platform]}:
                            </span>
                            <span>@{acc.handle}</span>
                          </a>
                        ))
                      )}
                    </div>

                    {/* Riwayat Campaign yang Diikuti */}
                    <div className="pt-1.5 text-xs text-muted">
                      <span className="font-medium text-foreground/80">
                        Campaign bersama:{" "}
                      </span>
                      {c.campaignTitles.join(", ")}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-6 text-right sm:text-right">
                    <div>
                      <p className="text-xs text-muted">Total Views</p>
                      <p className="tabular text-base font-bold text-foreground">
                        {formatCompact(c.totalViewsGenerated)}
                      </p>
                      <p className="text-[11px] text-muted">
                        {c.approvedSubmissionsCount} konten · {c.campaignsCount}{" "}
                        campaign
                      </p>
                    </div>

                    <div className="hidden border-l border-line pl-6 sm:block">
                      <p className="text-xs text-muted">Terakhir aktif</p>
                      <p className="text-xs font-medium text-foreground/90">
                        {formatDate(c.lastCollaboratedAt)}
                      </p>
                      <Link
                        href="/vendor/campaigns/new"
                        className="mt-1 inline-block text-xs font-medium text-brand-600 hover:underline"
                      >
                        Ajak lagi →
                      </Link>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}
    </div>
  );
}
