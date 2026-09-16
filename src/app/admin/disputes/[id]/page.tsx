import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatCompact, formatDateTime } from "@/lib/format";
import {
  Badge,
  Card,
  CardHeader,
  IconArrowLeft,
  IconCheck,
  IconExternal,
  IconX,
} from "@/components/ui";
import { disputeStatusLabel, platformLabel, type BadgeTone } from "@/lib/labels";
import { VerdictForm } from "./verdict-form";
import { DisputeChatForm } from "./chat-form";

export default async function AdminDisputeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("ADMIN");
  const { id } = await params;

  const dispute = await db.dispute.findUnique({
    where: { id },
    include: {
      openedBy: { select: { name: true } },
      messages: {
        include: {
          sender: { select: { id: true, name: true, role: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      submission: {
        include: {
          campaign: {
            include: { vendor: { include: { vendorProfile: true } } },
          },
          creator: {
            include: {
              creatorProfile: true,
              socialAccounts: true,
              _count: { select: { participations: true, flaggedAgainst: true } },
            },
          },
        },
      },
    },
  });

  if (!dispute) notFound();

  const { submission } = dispute;
  const sudahDiputus = dispute.status.startsWith("RESOLVED");
  const handle = submission.creator.socialAccounts.find(
    (akun) => akun.platform === submission.platform,
  )?.handle;

  return (
    <div>
      <Link
        href="/admin/disputes"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-brand-600"
      >
        <IconArrowLeft className="h-4 w-4" />
        Kembali ke daftar sengketa
      </Link>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">
            {submission.creator.name} vs{" "}
            {submission.campaign.vendor.vendorProfile?.businessName ?? "Vendor"}
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            {submission.campaign.title} · dibuka {formatDateTime(dispute.createdAt)}{" "}
            oleh {dispute.openedBy.name}
          </p>
        </div>
        <Badge tone={sudahDiputus ? "success" : "warning"} icon>
          {disputeStatusLabel[dispute.status]}
        </Badge>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader title="Konten Brief" />
          <a
            href={submission.contentUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-xl bg-surface-muted px-3 py-2.5 text-sm text-brand-600"
          >
            <IconExternal className="h-4 w-4 shrink-0" />
            <span className="truncate">{submission.contentUrl}</span>
          </a>
          <p className="mt-2 text-sm text-muted">
            {submission.creator.name} · {platformLabel[submission.platform]}
            {handle ? ` @${handle}` : ""} ·{" "}
            {formatCompact(submission.lastViews)} views
          </p>

          <div className="mt-4 border-t border-line pt-4 text-sm">
            <p className="font-medium">Brief campaign</p>
            <p className="mt-1 text-muted">
              <span className="font-medium">Angle wajib:</span>{" "}
              {submission.campaign.briefAngle}
            </p>
            <ul className="mt-2 space-y-1 text-muted">
              {submission.campaign.briefMustShow.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <IconCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                  {item}
                </li>
              ))}
              {submission.campaign.briefProhibited.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <IconX className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-4 grid gap-3 border-t border-line pt-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-danger-soft p-4 text-sm">
              <p className="font-semibold text-danger">Alasan penolakan vendor</p>
              <p className="mt-1 text-danger">{submission.reviewNote ?? "—"}</p>
            </div>
            <div className="rounded-2xl bg-info-soft p-4 text-sm">
              <p className="font-semibold text-info">Bantahan creator</p>
              <p className="mt-1 text-info">{dispute.reason}</p>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader
            title={`Riwayat Chat & Mediasi (${dispute.messages.length})`}
            description="Klarifikasi bukti dan tanggapan antara Creator, Vendor, dan Admin."
          />
          {dispute.messages.length === 0 ? (
            <p className="text-sm text-muted">Belum ada pesan mediasi tambahan.</p>
          ) : (
            <div className="space-y-3">
              {dispute.messages.map((msg) => {
                const roleTone: BadgeTone =
                  msg.sender.role === "ADMIN"
                    ? "sky"
                    : msg.sender.role === "VENDOR"
                      ? "warning"
                      : "info";

                return (
                  <div
                    key={msg.id}
                    className="rounded-xl border border-line bg-surface-muted/60 p-3.5 text-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">
                          {msg.sender.name}
                        </span>
                        <Badge tone={roleTone}>
                          {msg.sender.role}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted">
                        {formatDateTime(msg.createdAt)}
                      </span>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-foreground/90">
                      {msg.body}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          {!sudahDiputus ? (
            <div className="mt-5 border-t border-line pt-4">
              <DisputeChatForm disputeId={dispute.id} />
            </div>
          ) : null}
        </Card>

        <Card>
          <CardHeader title="Riwayat Creator" />
          <p className="text-sm text-muted">
            Trust {submission.creator.creatorProfile?.trustScore ?? "—"} ·{" "}
            {submission.creator._count.participations} campaign ·{" "}
            {submission.creator._count.flaggedAgainst} flag
          </p>
        </Card>

        <Card>
          <CardHeader
            title="Putusan Admin"
            description="Keputusan bersifat final dan mengikat kedua pihak."
          />
          {sudahDiputus ? (
            <div className="rounded-xl bg-surface-muted px-3 py-2.5 text-sm">
              <p className="font-medium">Sudah diputus</p>
              <p className="mt-0.5 text-muted">{dispute.resolution}</p>
            </div>
          ) : (
            <VerdictForm disputeId={dispute.id} />
          )}
        </Card>
      </div>
    </div>
  );
}
