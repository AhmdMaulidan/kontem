import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatCompact, formatDateTime } from "@/lib/format";
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  cn,
} from "@/components/ui";
import { disputeStatusLabel, roleLabel } from "@/lib/labels";
import { resolveDisputeAction } from "../actions";
import { DecisionForm } from "../decision-form";

export default async function AdminDisputesPage() {
  await requireRole("ADMIN");

  const [terbuka, selesai] = await Promise.all([
    db.dispute.findMany({
      where: { status: { in: ["OPEN", "UNDER_REVIEW"] } },
      include: {
        openedBy: true,
        submission: {
          include: {
            campaign: { include: { vendor: { include: { vendorProfile: true } } } },
            creator: { include: { creatorProfile: true } },
          },
        },
        messages: {
          include: { sender: { select: { name: true, role: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    db.dispute.findMany({
      where: { status: { in: ["RESOLVED_UPHELD", "RESOLVED_OVERTURNED"] } },
      include: {
        submission: { include: { campaign: true, creator: true } },
        resolvedBy: { select: { name: true } },
      },
      orderBy: { resolvedAt: "desc" },
      take: 10,
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Resolusi sengketa"
        description="Penengah saat creator menilai penolakan vendor tidak berdasar."
      />

      <Card className="mb-6">
        <CardHeader
          title={`Sengketa terbuka (${terbuka.length})`}
          description="Dana untuk submission ini tertahan sampai keputusan keluar."
        />
        {terbuka.length === 0 ? (
          <EmptyState title="Tidak ada sengketa terbuka" />
        ) : (
          <ul className="space-y-6">
            {terbuka.map((dispute) => (
              <li key={dispute.id} className="rounded-xl border border-line p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-medium">
                      {dispute.submission.campaign.title}
                    </h3>
                    <p className="mt-0.5 text-sm text-muted">
                      {dispute.submission.creator.name} (trust{" "}
                      {dispute.submission.creator.creatorProfile?.trustScore}) vs{" "}
                      {dispute.submission.campaign.vendor.vendorProfile?.businessName}
                    </p>
                  </div>
                  <Badge tone="warning">{disputeStatusLabel[dispute.status]}</Badge>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl bg-danger-soft p-3 text-sm">
                    <p className="font-medium text-danger">Alasan penolakan vendor</p>
                    <p className="mt-1 text-danger">
                      {dispute.submission.reviewNote ?? "—"}
                    </p>
                  </div>
                  <div className="rounded-xl bg-info-soft p-3 text-sm">
                    <p className="font-medium text-info">Bantahan creator</p>
                    <p className="mt-1 text-info">{dispute.reason}</p>
                  </div>
                </div>

                <div className="mt-4 rounded-xl bg-surface-muted p-3 text-sm">
                  <p className="font-medium">Bukti konten</p>
                  <a
                    href={dispute.submission.contentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 block truncate text-brand"
                  >
                    {dispute.submission.contentUrl}
                  </a>
                  <p className="mt-1 text-muted">
                    {formatCompact(dispute.submission.lastViews)} views · brief wajib:{" "}
                    {dispute.submission.campaign.briefMustShow.join(", ")}
                  </p>
                </div>

                <div className="mt-4">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
                    Riwayat percakapan
                  </p>
                  <ul className="space-y-2">
                    {dispute.messages.map((message) => (
                      <li
                        key={message.id}
                        className={cn(
                          "rounded-xl px-3 py-2 text-sm",
                          message.sender.role === "ADMIN"
                            ? "bg-brand-soft"
                            : "bg-surface-muted",
                        )}
                      >
                        <p className="text-xs text-muted">
                          {message.sender.name} · {roleLabel[message.sender.role]} ·{" "}
                          {formatDateTime(message.createdAt)}
                        </p>
                        <p className="mt-0.5">{message.body}</p>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-4 border-t border-line pt-4">
                  <DecisionForm
                    action={resolveDisputeAction}
                    hiddenField="disputeId"
                    hiddenValue={dispute.id}
                    approveValue="overturn"
                    rejectValue="uphold"
                    approveLabel="Menangkan creator"
                    rejectLabel="Kuatkan penolakan vendor"
                    noteLabel="Dasar keputusan"
                    noteHint="Dikirim ke kedua pihak dan tercatat permanen."
                    requireNoteOnApprove
                  />
                  <p className="mt-2 text-xs text-muted">
                    Menangkan creator = submission kembali dihitung untuk payout.
                    Kuatkan penolakan = submission keluar dari perhitungan dan trust
                    score creator turun.
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="Riwayat keputusan" />
        {selesai.length === 0 ? (
          <EmptyState title="Belum ada sengketa yang diputus" />
        ) : (
          <ul className="divide-y divide-line">
            {selesai.map((dispute) => (
              <li
                key={dispute.id}
                className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="font-medium">{dispute.submission.campaign.title}</p>
                  <p className="text-sm text-muted">
                    {dispute.submission.creator.name} · diputus{" "}
                    {dispute.resolvedBy?.name ?? "—"}
                  </p>
                  <p className="mt-1 max-w-xl text-sm text-muted">
                    {dispute.resolution}
                  </p>
                </div>
                <Badge
                  tone={
                    dispute.status === "RESOLVED_OVERTURNED" ? "success" : "danger"
                  }
                >
                  {disputeStatusLabel[dispute.status]}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
