"use client";

import { useActionState, useMemo, useState } from "react";
import { createCampaignAction, type ActionState } from "../../actions";
import { SubmitButton } from "@/components/ui";
import {
  Callout,
  Card,
  CardHeader,
  Field,
  FormError,
  Input,
  Select,
  Textarea,
} from "@/components/ui";
import { categoryLabel, platformLabel } from "@/lib/labels";
import { formatCompact, formatIDR } from "@/lib/format";
import type { BusinessCategory, SocialPlatform } from "@/generated/prisma/enums";

export type TemplateOption = {
  id: string;
  category: BusinessCategory;
  name: string;
  fields: {
    angleSaran?: string[];
    wajibTampil?: string[];
    larangan?: string[];
    durasiMinimalDetik?: number;
  };
};

const PLATFORMS: SocialPlatform[] = ["TIKTOK", "INSTAGRAM", "YOUTUBE"];
const FEE_RATE = 15;

function tanggalDefault(offsetHari: number) {
  const date = new Date(Date.now() + offsetHari * 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
}

export function CampaignForm({
  templates,
  cpmRekomendasi,
  defaultCategory,
}: {
  templates: TemplateOption[];
  cpmRekomendasi: Record<string, number>;
  defaultCategory: BusinessCategory;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    createCampaignAction,
    {},
  );

  const [category, setCategory] = useState<BusinessCategory>(defaultCategory);
  const [budgetPool, setBudgetPool] = useState(2_500_000);
  const [cpmRate, setCpmRate] = useState(cpmRekomendasi[defaultCategory] || 15_000);
  const [maxCreators, setMaxCreators] = useState(8);

  const template = templates.find((item) => item.category === category);

  // Proyeksi yang dilihat vendor sebelum menyetor dana.
  const proyeksi = useMemo(() => {
    const viewsMaks = cpmRate > 0 ? Math.floor((budgetPool / cpmRate) * 1000) : 0;
    const feePlatform = Math.round((budgetPool * FEE_RATE) / 100);
    return {
      viewsMaks,
      perCreator: maxCreators > 0 ? Math.floor(viewsMaks / maxCreators) : 0,
      feePlatform,
      keCreator: budgetPool - feePlatform,
      cpmEfektifCreator:
        viewsMaks > 0
          ? Math.round(((budgetPool - feePlatform) / viewsMaks) * 1000)
          : 0,
    };
  }, [budgetPool, cpmRate, maxCreators]);

  return (
    <form action={formAction} className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <FormError message={state.error} />

        <Card>
          <CardHeader title="Informasi dasar" />
          <div className="space-y-4">
            <Field label="Judul campaign">
              <Input
                name="title"
                required
                placeholder="Rooftop Coffee Session — Kopi Senja Malang"
              />
            </Field>
            <Field label="Kategori" hint="Menentukan template brief yang dipakai.">
              <Select
                name="category"
                value={category}
                onChange={(event) => {
                  const next = event.target.value as BusinessCategory;
                  setCategory(next);
                  if (cpmRekomendasi[next]) setCpmRate(cpmRekomendasi[next]);
                }}
              >
                {Object.entries(categoryLabel).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Deskripsi singkat" hint="Dilihat creator di halaman listing.">
              <Textarea name="description" rows={3} required minLength={20} />
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Brief konten"
            description={
              template
                ? `Terisi otomatis dari ${template.name}. Sesuaikan seperlunya.`
                : "Jelaskan sedetail mungkin supaya hasil konten sesuai harapan."
            }
          />
          <div className="space-y-4">
            <Field label="Angle wajib">
              <Textarea
                name="briefAngle"
                rows={2}
                required
                minLength={20}
                defaultValue={template?.fields.angleSaran?.[0] ?? ""}
                key={`angle-${category}`}
              />
            </Field>
            <Field
              label="Hal yang wajib ditampilkan"
              hint="Satu poin per baris."
            >
              <Textarea
                name="briefMustShow"
                rows={3}
                required
                defaultValue={(template?.fields.wajibTampil ?? []).join("\n")}
                key={`must-${category}`}
              />
            </Field>
            <Field label="Larangan" hint="Satu poin per baris. Boleh dikosongkan.">
              <Textarea
                name="briefProhibited"
                rows={2}
                defaultValue={(template?.fields.larangan ?? []).join("\n")}
                key={`no-${category}`}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Durasi minimum (detik)">
                <Input
                  name="minDurationSec"
                  type="number"
                  min={5}
                  required
                  defaultValue={template?.fields.durasiMinimalDetik ?? 20}
                  key={`dur-${category}`}
                />
              </Field>
              <Field label="Platform yang diizinkan">
                <div className="flex flex-wrap gap-3 pt-2">
                  {PLATFORMS.map((platform) => (
                    <label key={platform} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        name="platforms"
                        value={platform}
                        defaultChecked={platform !== "YOUTUBE"}
                        className="h-4 w-4 accent-[var(--brand)]"
                      />
                      {platformLabel[platform]}
                    </label>
                  ))}
                </div>
              </Field>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Komplimen di lokasi"
            description="Yang didapat creator saat berkunjung, ditukar dengan kode redeem."
          />
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Jenis komplimen">
                <Input
                  name="complimentType"
                  required
                  placeholder="Gratis 1 menu kopi + 1 snack"
                />
              </Field>
              <Field label="Nilai (Rp)">
                <Input
                  name="complimentValue"
                  type="number"
                  min={0}
                  required
                  defaultValue={65000}
                />
              </Field>
            </div>
            <Field label="Syarat & ketentuan" hint="Opsional.">
              <Textarea
                name="complimentTerms"
                rows={2}
                placeholder="Berlaku 1 orang, jam 15.00-18.00, tunjukkan kode ke kasir."
              />
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader title="Periode campaign" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tanggal mulai">
              <Input
                name="startDate"
                type="date"
                required
                defaultValue={tanggalDefault(3)}
              />
            </Field>
            <Field label="Tanggal selesai">
              <Input
                name="endDate"
                type="date"
                required
                defaultValue={tanggalDefault(33)}
              />
            </Field>
          </div>
          <p className="mt-3 text-xs text-muted">
            Views tetap dilacak 7 hari setelah tanggal selesai sebelum payout
            dihitung final.
          </p>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader title="Budget & tarif" />
          <div className="space-y-4">
            <Field label="Total budget pool (Rp)" hint="Disetor di muka ke escrow.">
              <Input
                name="budgetPool"
                type="number"
                min={100000}
                step={50000}
                required
                value={budgetPool}
                onChange={(event) => setBudgetPool(Number(event.target.value))}
              />
            </Field>
            <Field
              label="CPM rate (Rp per 1.000 views)"
              hint={
                cpmRekomendasi[category]
                  ? `Rata-rata kategori ini: ${formatIDR(cpmRekomendasi[category])}`
                  : "Belum ada acuan untuk kategori ini."
              }
            >
              <Input
                name="cpmRate"
                type="number"
                min={1000}
                step={1000}
                required
                value={cpmRate}
                onChange={(event) => setCpmRate(Number(event.target.value))}
              />
            </Field>
            <Field label="Maksimum creator">
              <Input
                name="maxCreators"
                type="number"
                min={1}
                max={100}
                required
                value={maxCreators}
                onChange={(event) => setMaxCreators(Number(event.target.value))}
              />
            </Field>
          </div>
        </Card>

        <Card className="bg-surface-muted">
          <CardHeader title="Proyeksi" />
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Views maksimum</dt>
              <dd className="tabular font-medium">
                {formatCompact(proyeksi.viewsMaks)}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Rata-rata per creator</dt>
              <dd className="tabular font-medium">
                {formatCompact(proyeksi.perCreator)}
              </dd>
            </div>
            <div className="flex justify-between gap-3 border-t border-line pt-3">
              <dt className="text-muted">Fee platform ({FEE_RATE}%)</dt>
              <dd className="tabular font-medium">
                {formatIDR(proyeksi.feePlatform)}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Diterima creator</dt>
              <dd className="tabular font-medium text-success">
                {formatIDR(proyeksi.keCreator)}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">CPM efektif creator</dt>
              <dd className="tabular font-medium">
                {formatIDR(proyeksi.cpmEfektifCreator)}
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-muted">
            Kalau total tagihan CPM tidak sampai pool, sisa dana dikembalikan ke
            kamu setelah campaign selesai.
          </p>
        </Card>

        <Callout tone="info">
          Campaign masuk antrean approval admin. Setelah disetujui dan deposit
          lunas, campaign langsung terlihat creator.
        </Callout>

        <SubmitButton className="w-full" pendingLabel="Mengajukan...">
          Ajukan campaign
        </SubmitButton>
      </div>
    </form>
  );
}
