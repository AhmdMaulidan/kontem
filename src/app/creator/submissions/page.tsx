import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatCompact, formatDateTime } from "@/lib/format";
import {
  Badge,
  ButtonLink,
  Card,
  EmptyState,
  PageHeader,
  Callout,
} from "@/components/ui";
import { submissionStatusLabel, submissionStatusTone, platformLabel } from "@/lib/labels";
import { AppealForm } from "./appeal-form";

export default async function CreatorSubmissionsPage() {
  const user = await requireRole("CREATOR");

  const submissions = await db.submission.findMany({
    where: { creatorId: user.id },
    include: {
      campaign: { include: { vendor: { include: { vendorProfile: true } } } },
      disputes: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { submittedAt: "desc" },
  });

  return (
    <div>
      <PageHeader
        title="Submission saya"
        description="Semua konten yang sudah kamu kirim beserta status reviewnya."
        action={<ButtonLink href="/creator/campaigns">Cari campaign</ButtonLink>}
      />

      {submissions.length === 0 ? (
        <EmptyState
          title="Belum ada submission"
          description="Ikut campaign, kunjungi lokasi, lalu kirim link kontenmu di sini."
          action={<ButtonLink href="/creator/campaigns">Lihat campaign</ButtonLink>}
        />
      ) : (
        <div className="space-y-4">
          {submissions.map((submission) => (
            <Card key={submission.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    href={`/creator/campaigns/${submission.campaignId}`}
                    className="font-medium hover:text-brand"
                  >
                    {submission.campaign.title}
                  </Link>
                  <p className="mt-0.5 text-sm text-muted">
                    {submission.campaign.vendor.vendorProfile?.businessName} ·{" "}
                    {platformLabel[submission.platform]} · dikirim{" "}
                    {formatDateTime(submission.submittedAt)}
                  </p>
                  <a
                    href={submission.contentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 block max-w-md truncate text-sm text-brand"
                  >
                    {submission.contentUrl}
                  </a>
                </div>
                <div className="text-right">
                  <Badge tone={submissionStatusTone[submission.status]}>
                    {submissionStatusLabel[submission.status]}
                  </Badge>
                  <p className="tabular mt-2 text-sm font-medium">
                    {formatCompact(submission.lastViews)} views
                  </p>
                </div>
              </div>

              {submission.reviewNote ? (
                <div className="mt-4">
                  <Callout
                    tone={
                      submission.status === "APPROVED" ||
                      submission.status === "ADMIN_APPROVED"
                        ? "success"
                        : "danger"
                    }
                    title="Catatan reviewer"
                  >
                    {submission.reviewNote}
                  </Callout>
                </div>
              ) : null}

              {submission.status === "REJECTED" ? (
                <div className="mt-4 border-t border-line pt-4">
                  <p className="text-sm font-medium">Tidak setuju dengan penolakan?</p>
                  <p className="mt-0.5 mb-3 text-xs text-muted">
                    Ajukan banding dan admin akan menjadi penengah. Jelaskan bagian
                    konten mana yang menurutmu sudah memenuhi brief.
                  </p>
                  <AppealForm submissionId={submission.id} />
                </div>
              ) : null}

              {submission.disputes.length > 0 ? (
                <div className="mt-4">
                  <Callout tone="warning" title="Banding sedang diproses">
                    {submission.disputes[0].reason}
                  </Callout>
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
