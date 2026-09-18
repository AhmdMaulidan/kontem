import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatCompact, formatDateTime } from "@/lib/format";
import {
  Badge,
  ButtonLink,
  Card,
  EmptyState,
  IconExternal,
  PageHeader,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { submissionStatusLabel, submissionStatusTone, platformLabel } from "@/lib/labels";
import {
  RefreshViewsButton,
  SubmissionActionMenu,
} from "./submission-actions";

export default async function CreatorSubmissionsPage() {
  const user = await requireRole("CREATOR");

  const submissions = await db.submission.findMany({
    where: { creatorId: user.id },
    include: {
      campaign: { include: { vendor: { include: { vendorProfile: true } } } },
      withdrawal: true,
      payout: true,
    },
    orderBy: { submittedAt: "desc" },
  });

  return (
    <div>
      <PageHeader
        title="Submission saya"
        description="Semua konten yang sudah kamu kirim beserta status reviewnya."
      />

      {submissions.length === 0 ? (
        <EmptyState
          title="Belum ada submission"
          description="Ikut campaign lalu kirim link kontenmu di sini."
          action={<ButtonLink href="/creator/campaigns">Lihat campaign</ButtonLink>}
        />
      ) : (
        <Card>
          <Table>
            <thead>
              <tr>
                <Th>Campaign</Th>
                <Th>Konten</Th>
                <Th>Dikirim</Th>
                <Th align="right">Views</Th>
                <Th>Status</Th>
                <Th align="right">Aksi</Th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((submission) => {
                const hasPayout = !!submission.payout;
                const hasActiveWithdrawal =
                  !!submission.withdrawal &&
                  submission.withdrawal.status !== "REJECTED";
                const isSettled = submission.campaign.status === "SETTLED";
                const canDelete = !hasPayout && !hasActiveWithdrawal && !isSettled;

                let deleteDisabledReason: string | undefined;
                if (hasPayout) {
                  deleteDisabledReason = "Submission sudah memiliki data pembayaran.";
                } else if (hasActiveWithdrawal) {
                  deleteDisabledReason =
                    "Pengajuan penarikan dana sedang diproses atau sudah dicairkan.";
                } else if (isSettled) {
                  deleteDisabledReason = "Campaign sudah selesai (settled).";
                }

                return (
                  <tr key={submission.id}>
                    <Td>
                      <Link
                        href={`/creator/campaigns/${submission.campaignId}`}
                        className="font-medium text-body hover:text-brand"
                      >
                        {submission.campaign.title}
                      </Link>
                      <p className="mt-0.5 text-xs text-muted">
                        {submission.campaign.vendor.vendorProfile?.businessName} ·{" "}
                        {submission.campaign.vendor.vendorProfile?.city}
                      </p>
                    </Td>
                    <Td>
                      <span className="text-xs font-semibold text-body">
                        {platformLabel[submission.platform]}
                      </span>
                      <a
                        href={submission.contentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 flex max-w-[220px] items-center gap-1 truncate text-xs text-brand hover:underline"
                      >
                        <IconExternal className="h-3 w-3 shrink-0" />
                        <span className="truncate">{submission.contentUrl}</span>
                      </a>
                    </Td>
                    <Td className="whitespace-nowrap text-xs text-muted">
                      {formatDateTime(submission.submittedAt)}
                    </Td>
                    <Td align="right">
                      <div className="flex items-center justify-end gap-1.5 font-medium text-body">
                        <span>{formatCompact(submission.lastViews)}</span>
                        <RefreshViewsButton
                          submissionId={submission.id}
                          lastSyncedAt={submission.lastSyncedAt}
                        />
                      </div>
                    </Td>
                    <Td>
                      <Badge tone={submissionStatusTone[submission.status]}>
                        {submissionStatusLabel[submission.status]}
                      </Badge>
                    </Td>
                    <Td align="right">
                      <SubmissionActionMenu
                        submissionId={submission.id}
                        campaignTitle={submission.campaign.title}
                        contentUrl={submission.contentUrl}
                        status={submission.status}
                        reviewNote={submission.reviewNote}
                        canDelete={canDelete}
                        deleteDisabledReason={deleteDisabledReason}
                      />
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      )}
    </div>
  );
}

