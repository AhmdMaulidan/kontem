"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ButtonLink,
  Card,
  CardHeader,
  Field,
  FormError,
  Input,
  Select,
  SubmitButton,
} from "@/components/ui";
import { analyzeUrlAction, type AnalyzeState } from "./actions";

const initialState: AnalyzeState = {};

export function AnalyzeForm({
  campaigns,
  initialUrl = "",
  initialCampaignId = "",
}: {
  campaigns: { id: string; title: string }[];
  initialUrl?: string;
  initialCampaignId?: string;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(analyzeUrlAction, initialState);

  useEffect(() => {
    if (state.success && state.analysisId) {
      router.push(`/admin/analyses/${state.analysisId}`);
    }
  }, [state.success, state.analysisId, router]);

  return (
    <Card>
      <CardHeader
        title="Analisis Video"
        description="Tempel URL video TikTok/Instagram/YouTube, pilih campaign, lalu biarkan engine compliance menilai kesesuaiannya dengan brief."
      />
      <form action={action} className="mt-4 flex flex-col gap-4">
        <Field
          label="URL Video"
          hint="Hanya menerima link tiktok.com, instagram.com, atau youtube.com"
        >
          <Input
            name="url"
            type="url"
            required
            defaultValue={initialUrl}
            placeholder="https://www.tiktok.com/@username/video/..."
          />
        </Field>
        <Field
          label="Campaign"
          hint="Hanya campaign yang sudah punya brief yang muncul di sini"
        >
          <Select name="campaignId" required defaultValue={initialCampaignId || ""}>
            <option value="" disabled>
              — pilih campaign —
            </option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </Select>
        </Field>
        <FormError message={state.error} />
        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton pendingLabel="Menganalisis... (bisa beberapa menit)">
            Analisis
          </SubmitButton>
          {state.error && state.analysisId && !pending ? (
            <ButtonLink href={`/admin/analyses/${state.analysisId}`} variant="ghost">
              Lihat hasil (status gagal)
            </ButtonLink>
          ) : null}
        </div>
        {campaigns.length === 0 ? (
          <p className="text-xs text-muted">
            Belum ada campaign dengan brief. Isi brief lewat menu Approval Campaign
            terlebih dulu.
          </p>
        ) : null}
      </form>
    </Card>
  );
}
