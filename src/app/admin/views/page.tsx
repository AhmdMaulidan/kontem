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
import { platformLabel, submissionStatusLabel, submissionStatusTone } from "@/lib/labels";
import { ViewsForm } from "./views-form";

export default async function AdminViewsPage() {
  await requireRole("ADMIN");

  // Hanya konten dari campaign yang masih dalam masa pelacakan yang perlu
  // diperbarui; campaign yang sudah settle memakai finalViews yang terkunci.
  const submissions = await db.submission.findMany({
    where: {
      status: { in: ["APPROVED", "ADMIN_APPROVED", "PENDING_REVIEW"] },
      campaign: { status: { in: ["ACTIVE", "ENDED", "SETTLING"] } },
    },
    include: {
      campaign: { select: { id: true, title: true } },
      creator: { select: { name: true } },
    },
    orderBy: [{ lastSyncedAt: "asc" }, { submittedAt: "asc" }],
  });

  return (
    <div>
      <PageHeader
        title="Update views"
        description="Sinkronisasi angka views konten selama masa pelacakan campaign."
      />

      <div className="mb-6">
        <Callout tone="info" title="Mode demo">
          Angka views diinput manual di halaman ini. Di produksi, pekerjaan ini
          diambil alih job terjadwal yang menarik data dari API TikTok/Instagram —
          antarmuka dan perhitungan di belakangnya tidak berubah. Penurunan angka
          otomatis memunculkan flag fraud.
        </Callout>
      </div>

      <Card>
        <CardHeader
          title={`Submission dalam pelacakan (${submissions.length})`}
          description="Diurutkan dari yang paling lama tidak disinkronkan."
        />
        {submissions.length === 0 ? (
          <EmptyState title="Tidak ada konten yang perlu disinkronkan" />
        ) : (
          <ul className="space-y-4">
            {submissions.map((submission) => (
              <li key={submission.id} className="rounded-xl border border-line p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{submission.creator.name}</p>
                    <p className="mt-0.5 text-sm text-muted">
                      {submission.campaign.title} ·{" "}
                      {platformLabel[submission.platform]}
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
                    <p className="tabular mt-1 text-sm font-medium">
                      {formatCompact(submission.lastViews)} views
                    </p>
                    <p className="text-xs text-muted">
                      {submission.lastSyncedAt
                        ? `Sinkron ${formatDateTime(submission.lastSyncedAt)}`
                        : "Belum pernah disinkronkan"}
                    </p>
                  </div>
                </div>

                <div className="mt-4 border-t border-line pt-4">
                  <ViewsForm
                    submissionId={submission.id}
                    currentViews={submission.lastViews}
                    currentLikes={submission.lastLikes}
                    currentComments={submission.lastComments}
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
