import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { getCampaignPerformance } from "@/domain/campaign";
import { formatCompact, formatDate, formatIDR, daysUntil } from "@/lib/format";
import {
  Badge,
  Callout,
  Card,
  CardHeader,
  DescriptionList,
  IconCheck,
  IconX,
  PageHeader,
  ProgressBar,
} from "@/components/ui";
import {
  campaignStatusLabel,
  campaignStatusTone,
  categoryLabel,
  platformLabel,
  submissionStatusLabel,
  submissionStatusTone,
} from "@/lib/labels";
import { JoinForm, SubmitContentForm } from "./forms";

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole("CREATOR");
  const { id } = await params;

  const campaign = await db.campaign.findUnique({
    where: { id },
    include: {
      vendor: { include: { vendorProfile: true } },
      participations: {
        where: { status: { not: "CANCELLED" } },
        select: { creatorId: true },
      },
    },
  });

  if (!campaign) notFound();

  const participation = await db.campaignParticipation.findUnique({
    where: { campaignId_creatorId: { campaignId: id, creatorId: user.id } },
    include: { redeemCode: true, submission: true },
  });

  const performance = await getCampaignPerformance(id);
  const estimasiSaya = performance?.lines.find((l) => l.creatorId === user.id);

  const terisi = campaign.participations.length;
  const penuh = terisi >= campaign.maxCreators;
  const sisaHari = daysUntil(campaign.endDate);
  const bisaJoin =
    campaign.status === "ACTIVE" && !penuh && !participation && sisaHari >= 0;

  return (
    <div>
      <PageHeader
        title={campaign.title}
        description={`${campaign.vendor.vendorProfile?.businessName} · ${campaign.vendor.vendorProfile?.city}`}
        action={
          <Badge tone={campaignStatusTone[campaign.status]}>
            {campaignStatusLabel[campaign.status]}
          </Badge>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Brief konten" />
            <p className="text-sm">{campaign.description}</p>

            <div className="mt-4 rounded-xl bg-surface-muted p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">
                Angle wajib
              </p>
              <p className="mt-1 text-sm">{campaign.briefAngle}</p>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted">
                  Wajib ditampilkan
                </p>
                <ul className="mt-1.5 space-y-1 text-sm">
                  {campaign.briefMustShow.map((item) => (
                    <li key={item} className="flex gap-2">
                      <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted">
                  Larangan
                </p>
                {campaign.briefProhibited.length === 0 ? (
                  <p className="mt-1.5 text-sm text-muted">Tidak ada larangan khusus.</p>
                ) : (
                  <ul className="mt-1.5 space-y-1 text-sm">
                    {campaign.briefProhibited.map((item) => (
                      <li key={item} className="flex gap-2">
                        <IconX className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="mt-5 border-t border-line pt-4">
              <DescriptionList
                items={[
                  {
                    label: "Durasi minimum",
                    value: `${campaign.minDurationSec} detik`,
                  },
                  {
                    label: "Platform diizinkan",
                    value: campaign.allowedPlatforms
                      .map((p) => platformLabel[p])
                      .join(", "),
                  },
                  { label: "Kategori", value: categoryLabel[campaign.category] },
                  {
                    label: "Periode",
                    value: `${formatDate(campaign.startDate)} – ${formatDate(campaign.endDate)}`,
                  },
                ]}
              />
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Lokasi & komplimen"
              description="Tunjukkan kode redeem ke petugas di lokasi."
            />
            <DescriptionList
              items={[
                {
                  label: "Alamat",
                  value: campaign.vendor.vendorProfile?.address ?? "—",
                },
                {
                  label: "Titik peta",
                  value: campaign.vendor.vendorProfile ? (
                    <a
                      className="text-brand"
                      href={
                        campaign.vendor.vendorProfile.mapsUrl ??
                        `https://maps.google.com/?q=${campaign.vendor.vendorProfile.latitude},${campaign.vendor.vendorProfile.longitude}`
                      }
                      target="_blank"
                      rel="noreferrer"
                    >
                      Buka di Google Maps
                    </a>
                  ) : (
                    "—"
                  ),
                },
                {
                  label: "Komplimen",
                  value: `${campaign.complimentType} (${formatIDR(campaign.complimentValue)})`,
                },
                {
                  label: "Syarat komplimen",
                  value: campaign.complimentTerms ?? "—",
                },
              ]}
            />
          </Card>

          {performance && performance.ranking.length > 0 ? (
            <Card>
              <CardHeader
                title="Papan peringkat sementara"
                description="Pool dibagi menurut proporsi views tiap creator."
              />
              <ul className="space-y-3">
                {performance.ranking.map((row, index) => (
                  <li key={row.submissionId}>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate">
                        <span className="text-muted">{index + 1}.</span>{" "}
                        {row.creatorId === user.id ? (
                          <strong>{row.creatorName} (kamu)</strong>
                        ) : (
                          row.creatorName
                        )}
                      </span>
                      <span className="tabular whitespace-nowrap text-muted">
                        {formatCompact(row.views)} views ·{" "}
                        {row.sharePercent.toFixed(1)}%
                      </span>
                    </div>
                    <div className="mt-1.5">
                      <ProgressBar
                        value={row.views}
                        max={performance.ranking[0].views}
                        tone={row.creatorId === user.id ? "brand" : "success"}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Ekonomi campaign" />
            <DescriptionList
              items={[
                { label: "Pool budget", value: formatIDR(campaign.budgetPool) },
                {
                  label: "CPM rate",
                  value: `${formatIDR(campaign.cpmRate)} / 1.000 views`,
                },
                {
                  label: "Fee platform",
                  value: `${campaign.platformFeeRate}%`,
                },
                {
                  label: "Slot",
                  value: `${terisi} / ${campaign.maxCreators}`,
                },
              ]}
            />
            <div className="mt-3">
              <ProgressBar value={terisi} max={campaign.maxCreators} />
            </div>

            {estimasiSaya ? (
              <div className="mt-4 rounded-xl bg-brand-soft p-3">
                <p className="text-xs text-brand">Estimasi kamu saat ini</p>
                <p className="tabular mt-0.5 text-xl font-semibold text-brand">
                  {formatIDR(estimasiSaya.netAmount)}
                </p>
                <p className="mt-0.5 text-xs text-brand">
                  {formatCompact(estimasiSaya.viewsCounted)} views ·{" "}
                  {estimasiSaya.sharePercent.toFixed(1)}% dari total
                </p>
              </div>
            ) : null}

            {performance?.poolExhausted ? (
              <p className="mt-3 text-xs text-muted">
                Total tagihan CPM sudah melampaui pool, jadi pembagian memakai
                proporsi views.
              </p>
            ) : null}
          </Card>

          {!participation ? (
            <Card>
              <CardHeader title="Ikut campaign ini" />
              <JoinForm
                campaignId={campaign.id}
                disabled={!bisaJoin}
                disabledReason={
                  penuh
                    ? "Slot sudah penuh."
                    : campaign.status !== "ACTIVE"
                      ? "Campaign belum/tidak aktif."
                      : sisaHari < 0
                        ? "Periode campaign sudah berakhir."
                        : undefined
                }
              />
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader title="Kode redeem kamu" />
                {participation.redeemCode ? (
                  <>
                    <div className="rounded-2xl border border-dashed border-line-brand bg-brand-50 px-4 py-5 text-center">
                      <p className="text-xs font-medium text-muted">
                        Tunjukkan kode ini di lokasi
                      </p>
                      <p className="mt-2 font-mono text-2xl font-bold tracking-[0.18em] text-brand-700">
                        {participation.redeemCode.code}
                      </p>
                      <div className="mt-3 flex justify-center">
                        <Badge
                          tone={
                            participation.redeemCode.status === "USED"
                              ? "sky"
                              : "warning"
                          }
                          icon
                        >
                          {participation.redeemCode.status === "USED"
                            ? "Kunjungan Terverifikasi"
                            : "Menunggu Kunjungan"}
                        </Badge>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-muted">
                      {participation.redeemCode.status === "USED"
                        ? `Sudah dipakai pada ${formatDate(participation.redeemCode.redeemedAt!)}. Kunjungan kamu tercatat.`
                        : "Tunjukkan kode ini ke petugas di lokasi untuk klaim komplimen. Kode harus ditandai terpakai sebelum kamu bisa mengirim konten."}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted">Kode belum tersedia.</p>
                )}
              </Card>

              <Card>
                <CardHeader title="Kirim konten" />
                {participation.submission ? (
                  <div className="space-y-3">
                    <Badge
                      tone={submissionStatusTone[participation.submission.status]}
                    >
                      {submissionStatusLabel[participation.submission.status]}
                    </Badge>
                    <a
                      href={participation.submission.contentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="block truncate text-sm text-brand"
                    >
                      {participation.submission.contentUrl}
                    </a>
                    <p className="tabular text-sm">
                      {formatCompact(participation.submission.lastViews)} views
                    </p>
                    {participation.submission.reviewNote ? (
                      <Callout
                        tone={
                          participation.submission.status === "APPROVED"
                            ? "success"
                            : "danger"
                        }
                        title="Catatan reviewer"
                      >
                        {participation.submission.reviewNote}
                      </Callout>
                    ) : null}
                  </div>
                ) : (
                  <SubmitContentForm
                    campaignId={campaign.id}
                    allowedPlatforms={campaign.allowedPlatforms}
                    locked={participation.redeemCode?.status !== "USED"}
                    lockedReason="Kunjungan belum terverifikasi. Datang ke lokasi dan minta petugas menandai kode redeem kamu terlebih dahulu."
                  />
                )}
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
