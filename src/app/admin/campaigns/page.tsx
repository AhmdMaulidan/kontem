import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { getCampaignPerformance } from "@/domain/campaign";
import { formatCompact, formatDate, formatIDR } from "@/lib/format";
import {
  Badge,
  Callout,
  Card,
  CardHeader,
  DescriptionList,
  EmptyState,
  PageHeader,
  ProgressBar,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { campaignStatusLabel, campaignStatusTone, categoryLabel } from "@/lib/labels";
import { confirmDepositAction, reviewCampaignAction } from "../actions";
import { DecisionForm, SimpleActionForm } from "../decision-form";

export default async function AdminCampaignsPage() {
  await requireRole("ADMIN");

  const [antrean, berjalan] = await Promise.all([
    db.campaign.findMany({
      where: { status: "PENDING_REVIEW" },
      include: {
        vendor: { include: { vendorProfile: true } },
        escrow: true,
      },
      orderBy: { submittedAt: "asc" },
    }),
    db.campaign.findMany({
      where: { status: { in: ["ACTIVE", "ENDED", "SETTLING", "SETTLED"] } },
      include: {
        vendor: { include: { vendorProfile: true } },
        _count: { select: { participations: true, submissions: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const monitoring = await Promise.all(
    berjalan.map(async (campaign) => ({
      campaign,
      performance: await getCampaignPerformance(campaign.id),
    })),
  );

  return (
    <div>
      <PageHeader
        title="Approval & monitoring campaign"
        description="Campaign hanya boleh live kalau vendor terverifikasi dan deposit pool sudah lunas."
      />

      <Card className="mb-6">
        <CardHeader title={`Menunggu approval (${antrean.length})`} />
        {antrean.length === 0 ? (
          <EmptyState title="Tidak ada campaign menunggu" />
        ) : (
          <ul className="space-y-5">
            {antrean.map((campaign) => {
              const deposit = campaign.escrow.find((trx) => trx.type === "DEPOSIT");
              const depositLunas = deposit?.status === "COMPLETED";
              const vendorTerverifikasi = campaign.vendor.status === "VERIFIED";

              return (
                <li key={campaign.id} className="rounded-xl border border-line p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-medium">{campaign.title}</h3>
                      <p className="mt-0.5 text-sm text-muted">
                        {campaign.vendor.vendorProfile?.businessName} ·{" "}
                        {campaign.vendor.vendorProfile?.city} ·{" "}
                        {categoryLabel[campaign.category]}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge tone={vendorTerverifikasi ? "success" : "danger"}>
                        {vendorTerverifikasi
                          ? "Vendor terverifikasi"
                          : "Vendor belum terverifikasi"}
                      </Badge>
                      <Badge tone={depositLunas ? "success" : "warning"}>
                        {depositLunas ? "Deposit lunas" : "Deposit pending"}
                      </Badge>
                    </div>
                  </div>

                  <div className="mt-4">
                    <DescriptionList
                      items={[
                        { label: "Pool budget", value: formatIDR(campaign.budgetPool) },
                        {
                          label: "CPM rate",
                          value: `${formatIDR(campaign.cpmRate)} / 1.000 views`,
                        },
                        { label: "Kuota creator", value: campaign.maxCreators },
                        {
                          label: "Periode",
                          value: `${formatDate(campaign.startDate)} – ${formatDate(campaign.endDate)}`,
                        },
                        {
                          label: "Komplimen",
                          value: `${campaign.complimentType} (${formatIDR(campaign.complimentValue)})`,
                        },
                        {
                          label: "Views maksimum",
                          value: formatCompact(
                            Math.floor((campaign.budgetPool / campaign.cpmRate) * 1000),
                          ),
                        },
                      ]}
                    />
                  </div>

                  <div className="mt-4 rounded-xl bg-surface-muted p-3 text-sm">
                    <p className="font-medium">Brief</p>
                    <p className="mt-1 text-muted">{campaign.briefAngle}</p>
                    <ul className="mt-2 space-y-0.5 text-muted">
                      {campaign.briefMustShow.map((item) => (
                        <li key={item}>✓ {item}</li>
                      ))}
                      {campaign.briefProhibited.map((item) => (
                        <li key={item}>✕ {item}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-4 space-y-3 border-t border-line pt-4">
                    {!depositLunas ? (
                      <div>
                        <Callout tone="warning">
                          Deposit {formatIDR(campaign.budgetPool)} belum tercatat
                          lunas. Konfirmasi setelah dana masuk rekening platform.
                        </Callout>
                        <div className="mt-3">
                          <SimpleActionForm
                            action={confirmDepositAction}
                            hiddenField="campaignId"
                            hiddenValue={campaign.id}
                            label="Tandai deposit diterima"
                            variant="secondary"
                          />
                        </div>
                      </div>
                    ) : null}

                    <DecisionForm
                      action={reviewCampaignAction}
                      hiddenField="campaignId"
                      hiddenValue={campaign.id}
                      approveLabel="Setujui & publikasikan"
                      rejectLabel="Tolak"
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Monitoring campaign berjalan"
          description="Serapan budget dan perolehan views setiap campaign yang sudah live."
        />
        {monitoring.length === 0 ? (
          <EmptyState title="Belum ada campaign berjalan" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Campaign</Th>
                <Th>Status</Th>
                <Th align="right">Creator</Th>
                <Th align="right">Views</Th>
                <Th align="right">Serapan</Th>
              </tr>
            </thead>
            <tbody>
              {monitoring.map(({ campaign, performance }) => (
                <tr key={campaign.id}>
                  <Td>
                    <Link
                      href={`/admin/payouts#${campaign.id}`}
                      className="font-medium hover:text-brand"
                    >
                      {campaign.title}
                    </Link>
                    <p className="text-xs text-muted">
                      {campaign.vendor.vendorProfile?.businessName}
                    </p>
                  </Td>
                  <Td>
                    <Badge tone={campaignStatusTone[campaign.status]}>
                      {campaignStatusLabel[campaign.status]}
                    </Badge>
                  </Td>
                  <Td align="right">
                    {campaign._count.participations}/{campaign.maxCreators}
                  </Td>
                  <Td align="right">
                    {formatCompact(performance?.totalViews ?? 0)}
                  </Td>
                  <Td align="right">
                    <span className="tabular">
                      {formatIDR(performance?.totalDistributed ?? 0)}
                    </span>
                    <div className="mt-1 w-24">
                      <ProgressBar
                        value={performance?.totalDistributed ?? 0}
                        max={campaign.budgetPool}
                      />
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
