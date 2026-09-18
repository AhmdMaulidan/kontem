import Link from "next/link";
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
import {
  platformLabel,
  submissionStatusLabel,
  submissionStatusTone,
} from "@/lib/labels";
import { FlagForm, ReviewForm } from "./review-form";

export default async function VendorSubmissionsPage() {
  const user = await requireRole("VENDOR");

  const [antrean, riwayat] = await Promise.all([
    db.submission.findMany({
      where: { campaign: { vendorId: user.id }, status: "PENDING_REVIEW" },
      include: {
        campaign: true,
        creator: { include: { creatorProfile: true } },
      },
      orderBy: { submittedAt: "asc" },
    }),
    db.submission.findMany({
      where: {
        campaign: { vendorId: user.id },
        status: { not: "PENDING_REVIEW" },
      },
      include: { campaign: true, creator: true },
      orderBy: { reviewedAt: "desc" },
      take: 20,
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Review submission"
        description="Setujui konten yang sesuai brief. Penolakan wajib disertai alasan."
      />

      <div className="mb-6">
        <Callout tone="info">
          Setiap keputusan tercatat di audit trail. Creator yang merasa
          penolakannya keliru bisa mengajukan banding dan admin yang memutus.
        </Callout>
      </div>

      <Card className="mb-6">
        <CardHeader
          title={`Antrean review (${antrean.length})`}
          description="Diurutkan dari yang paling lama menunggu."
        />
        {antrean.length === 0 ? (
          <EmptyState
            title="Tidak ada antrean"
            description="Semua submission sudah kamu putuskan."
          />
        ) : (
          <ul className="space-y-5">
            {antrean.map((submission) => (
              <li
                key={submission.id}
                className="rounded-xl border border-line p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{submission.creator.name}</p>
                    <p className="mt-0.5 text-sm text-muted">
                      {submission.campaign.title} ·{" "}
                      {platformLabel[submission.platform]} ·{" "}
                      {formatDateTime(submission.submittedAt)}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      Trust score creator:{" "}
                      {submission.creator.creatorProfile?.trustScore ?? "—"}/100
                    </p>
                    <a
                      href={submission.contentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 block max-w-lg truncate text-sm text-brand"
                    >
                      {submission.contentUrl}
                    </a>
                    {submission.caption ? (
                      <p className="mt-1 text-sm text-muted">
                        &ldquo;{submission.caption}&rdquo;
                      </p>
                    ) : null}
                  </div>
                  <div className="text-right">
                    <p className="tabular text-sm font-medium">
                      {formatCompact(submission.lastViews)} views
                    </p>
                  </div>
                </div>

                <div className="mt-4 border-t border-line pt-4">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
                    Cek terhadap brief
                  </p>
                  <ul className="mb-4 space-y-1 text-sm">
                    {submission.campaign.briefMustShow.map((item) => (
                      <li key={item} className="flex gap-2 text-muted">
                        <span>•</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                  <ReviewForm submissionId={submission.id} />
                  <div className="mt-3">
                    <FlagForm submissionId={submission.id} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="Riwayat keputusan" />
        {riwayat.length === 0 ? (
          <EmptyState title="Belum ada riwayat" />
        ) : (
          <ul className="divide-y divide-line">
            {riwayat.map((submission) => (
              <li
                key={submission.id}
                className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="font-medium">{submission.creator.name}</p>
                  <Link
                    href={`/vendor/campaigns/${submission.campaignId}`}
                    className="text-sm text-muted hover:text-brand"
                  >
                    {submission.campaign.title}
                  </Link>
                  {submission.reviewNote ? (
                    <p className="mt-1 max-w-lg text-sm text-muted">
                      Catatan: {submission.reviewNote}
                    </p>
                  ) : null}
                </div>
                <div className="text-right">
                  <Badge tone={submissionStatusTone[submission.status]}>
                    {submissionStatusLabel[submission.status]}
                  </Badge>
                  <p className="tabular mt-1 text-sm text-muted">
                    {formatCompact(submission.lastViews)} views
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
