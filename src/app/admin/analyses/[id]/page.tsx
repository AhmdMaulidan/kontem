import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import {
  Badge,
  ButtonLink,
  Callout,
  Card,
  CardHeader,
  DescriptionList,
  IconCheck,
  IconX,
  PageHeader,
} from "@/components/ui";
import {
  analysisStatusLabel,
  analysisStatusTone,
  analysisVerdictLabel,
  analysisVerdictTone,
  type BadgeTone,
} from "@/lib/labels";
import { ReviewForm } from "./review-form";
import { TranscriptToggle } from "./transcript-toggle";

// ---------------------------------------------------------------- parser Json
// Field Json dari Prisma bertipe longgar; engine menjamin bentuknya, tapi
// cast defensif membuat halaman tidak crash kalau kontraknya berubah.

type EngineCheck = {
  type?: unknown;
  label?: unknown;
  impact?: unknown;
  passed?: unknown;
  detail?: unknown;
};

type InterpretedRule = {
  source?: unknown;
  checks?: unknown;
};

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

function asRules(value: unknown): InterpretedRule[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (v): v is InterpretedRule => typeof v === "object" && v !== null,
  );
}

const impactTone: Record<string, BadgeTone> = {
  critical: "danger",
  normal: "warning",
  info: "info",
};

const impactLabel: Record<string, string> = {
  critical: "Wajib",
  normal: "Normal",
  info: "Catatan",
};

export default async function AnalysisDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("ADMIN");
  const { id } = await params;

  const analysis = await db.videoAnalysis.findUnique({
    where: { id },
    include: { campaign: { select: { title: true } } },
  });
  if (!analysis) notFound();

  const alasan = asStringArray(analysis.alasan);
  const rules = asRules(analysis.interpretedRules);
  const results = analysis.results as Record<string, unknown> | null;
  const engineErrors =
    results && typeof results === "object" ? asStringArray(results.errors) : [];

  const processing = analysis.status === "PROCESSING";
  const failed = analysis.status === "FAILED";
  const showReview =
    (analysis.verdict === "perlu_verifikasi" || failed) &&
    !analysis.humanDecision;

  const rerunHref = `/admin/analyzer?url=${encodeURIComponent(analysis.sourceUrl)}${
    analysis.campaignId ? `&campaignId=${analysis.campaignId}` : ""
  }`;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Hasil Analisis"
        description={`Diajukan ${formatDate(analysis.createdAt)}`}
        action={
          <ButtonLink href={rerunHref} variant="secondary">
            Analisis Ulang
          </ButtonLink>
        }
      />

      {/* ------------------------------------------------ verdict utama */}
      <Card>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {failed ? (
              <Badge tone="neutral">GAGAL</Badge>
            ) : processing ? (
              <Badge tone={analysisStatusTone.PROCESSING}>
                Menganalisis...
              </Badge>
            ) : analysis.verdict ? (
              <Badge tone={analysisVerdictTone[analysis.verdict]}>
                {analysisVerdictLabel[analysis.verdict]}
              </Badge>
            ) : null}

            {analysis.humanDecision ? (
              <Badge tone={analysisVerdictTone[analysis.humanDecision]}>
                Keputusan Admin:{" "}
                {analysisVerdictLabel[analysis.humanDecision]}
              </Badge>
            ) : null}

            {!failed && !processing ? (
              <Badge tone={analysisStatusTone[analysis.status]}>
                {analysisStatusLabel[analysis.status]}
              </Badge>
            ) : null}
          </div>

          <DescriptionList
            items={[
              {
                label: "Skor",
                value:
                  typeof analysis.score === "number"
                    ? `${analysis.score.toFixed(1)}/100`
                    : "—",
              },
              {
                label: "Durasi video",
                value:
                  typeof analysis.durationSec === "number"
                    ? `${analysis.durationSec} detik`
                    : "—",
              },
              {
                label: "Campaign",
                value: analysis.campaign?.title ?? "—",
              },
              {
                label: "Link sumber",
                value: (
                  <a
                    href={analysis.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="break-all text-brand-600 hover:underline"
                  >
                    {analysis.sourceUrl}
                  </a>
                ),
              },
            ]}
          />
        </div>
      </Card>

      {/* --------------------------------------- error teknis engine */}
      {engineErrors.length > 0 ? (
        <Callout tone="warning" title="Catatan teknis dari engine">
          <ul className="list-inside list-disc text-sm">
            {engineErrors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </Callout>
      ) : null}

      {/* ------------------------------------------------ alasan */}
      <Card>
        <CardHeader
          title="Alasan"
          description="Penilaian engine per aturan brief."
        />
        {alasan.length === 0 ? (
          <p className="text-sm text-muted">
            {processing ? "Menunggu hasil engine..." : "Tidak ada alasan."}
          </p>
        ) : (
          <ol className="flex flex-col gap-2">
            {alasan.map((item, i) => (
              <li
                key={i}
                className="rounded-xl bg-surface-muted px-4 py-2.5 text-sm text-body"
              >
                {item}
              </li>
            ))}
          </ol>
        )}
      </Card>

      {/* ------------------------------- pemahaman engine terhadap brief */}
      <Card>
        <CardHeader
          title="Pemahaman Engine terhadap Brief"
          description="Beginilah engine menafsirkan tiap baris brief. Kalau tafsirannya keliru, perbaiki brief di halaman campaign lalu klik Analisis Ulang."
        />
        {rules.length === 0 ? (
          <p className="text-sm text-muted">
            {processing
              ? "Menunggu hasil engine..."
              : "Engine tidak mengembalikan penafsiran aturan."}
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {rules.map((rule, i) => {
              const checks = Array.isArray(rule.checks)
                ? (rule.checks as EngineCheck[])
                : [];
              return (
                <div
                  key={i}
                  className="rounded-xl border border-line bg-surface-muted/60 p-4"
                >
                  <p className="text-sm font-semibold text-foreground">
                    {typeof rule.source === "string" ? rule.source : "—"}
                  </p>
                  <ul className="mt-2 flex flex-col gap-2">
                    {checks.map((check, j) => {
                      const passed = check.passed === true;
                      return (
                        <li key={j} className="flex items-start gap-2 text-sm">
                          {passed ? (
                            <IconCheck className="mt-0.5 h-4 w-4 flex-none text-success" />
                          ) : (
                            <IconX className="mt-0.5 h-4 w-4 flex-none text-danger" />
                          )}
                          <span className="text-body">
                            {typeof check.label === "string"
                              ? check.label
                              : "—"}{" "}
                            {typeof check.impact === "string" ? (
                              <Badge
                                tone={impactTone[check.impact] ?? "neutral"}
                              >
                                {impactLabel[check.impact] ?? check.impact}
                              </Badge>
                            ) : null}
                            {typeof check.detail === "string" &&
                            check.detail !== "" ? (
                              <span className="mt-0.5 block text-xs text-muted">
                                {check.detail}
                              </span>
                            ) : null}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* ------------------------------------------------ transkrip */}
      <Card>
        <CardHeader
          title="Transkrip"
          description="Teks hasil transkrip suara video."
        />
        <TranscriptToggle transcript={analysis.transcript} />
      </Card>

      {/* ------------------------------------------------ brief snapshot */}
      <Card>
        <CardHeader
          title="Brief Saat Analisis"
          description="Salinan brief campaign ketika analisis dijalankan."
        />
        <p className="text-sm leading-relaxed text-body whitespace-pre-wrap">
          {analysis.brief}
        </p>
      </Card>

      {/* ------------------------------------------------ review manual */}
      {showReview ? (
        <Card>
          <CardHeader
            title="Review Manual"
            description={
              failed
                ? "Analisis gagal diproses engine — ambil keputusan manual di sini."
                : "Engine ragu dengan hasil ini. Verifikasi manual lalu putuskan."
            }
          />
          <ReviewForm analysisId={analysis.id} decided={false} />
        </Card>
      ) : null}

      <Link
        href="/admin/analyzer"
        className="text-sm font-semibold text-brand-600 hover:underline"
      >
        &larr; Kembali ke Automated Analyzer
      </Link>
    </div>
  );
}
