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
import { NoteCell } from "./note-cell";

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
                <Th>No</Th>
                <Th>Campaign</Th>
                <Th>Konten</Th>
                <Th>Dikirim</Th>
                <Th align="right">Views</Th>
                <Th>Status</Th>
                <Th>Catatan</Th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((submission, index) => (
                <tr key={submission.id}>
                  <Td className="text-xs text-muted">{index + 1}</Td>
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
                  <Td align="right" className="font-medium text-body">
                    {formatCompact(submission.lastViews)}
                  </Td>
                  <Td>
                    <Badge tone={submissionStatusTone[submission.status]}>
                      {submissionStatusLabel[submission.status]}
                    </Badge>
                  </Td>
                  <Td>
                    <NoteCell
                      submissionId={submission.id}
                      campaignTitle={submission.campaign.title}
                      disputeReason={submission.disputes[0]?.reason ?? null}
                      reviewNote={submission.reviewNote}
                      reviewNoteTone={
                        submission.status === "APPROVED" ||
                        submission.status === "ADMIN_APPROVED"
                          ? "success"
                          : "danger"
                      }
                      showAppealForm={submission.status === "REJECTED"}
                    />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </div>
  );
}
