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
          {/* Desktop view: Table */}
          <div className="hidden md:block">
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
          </div>

          {/* Mobile view: Cards */}
          <div className="divide-y divide-line md:hidden">
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
                <div key={submission.id} className="p-3.5 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/creator/campaigns/${submission.campaignId}`}
                        className="font-medium text-body hover:text-brand text-sm leading-snug block break-words"
                      >
                        {submission.campaign.title}
                      </Link>
                      <p className="mt-0.5 text-xs text-muted">
                        {submission.campaign.vendor.vendorProfile?.businessName} ·{" "}
                        {submission.campaign.vendor.vendorProfile?.city}
                      </p>
                    </div>
                    <div className="shrink-0">
                      <SubmissionActionMenu
                        submissionId={submission.id}
                        campaignTitle={submission.campaign.title}
                        contentUrl={submission.contentUrl}
                        status={submission.status}
                        reviewNote={submission.reviewNote}
                        canDelete={canDelete}
                        deleteDisabledReason={deleteDisabledReason}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <span className="font-semibold text-body">
                      {platformLabel[submission.platform]}
                    </span>
                    <span className="text-muted">·</span>
                    <a
                      href={submission.contentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex max-w-[200px] items-center gap-1 truncate text-brand hover:underline"
                    >
                      <IconExternal className="h-3 w-3 shrink-0" />
                      <span className="truncate">{submission.contentUrl}</span>
                    </a>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-line/60 text-xs">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge tone={submissionStatusTone[submission.status]}>
                        {submissionStatusLabel[submission.status]}
                      </Badge>
                      <span className="text-[11px] text-muted whitespace-nowrap">
                        {formatDateTime(submission.submittedAt)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 font-medium text-body shrink-0">
                      <span>{formatCompact(submission.lastViews)} views</span>
                      <RefreshViewsButton
                        submissionId={submission.id}
                        lastSyncedAt={submission.lastSyncedAt}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

