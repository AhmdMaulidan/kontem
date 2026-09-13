"use client";

import { useActionState } from "react";
import {
  joinCampaignAction,
  submitContentAction,
  type ActionState,
} from "../../actions";
import { SubmitButton } from "@/components/ui";
import { Callout, Field, FormError, Input, Select, Textarea } from "@/components/ui";
import { platformLabel } from "@/lib/labels";
import type { SocialPlatform } from "@/generated/prisma/enums";

export function JoinForm({
  campaignId,
  disabled,
  disabledReason,
}: {
  campaignId: string;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    joinCampaignAction,
    {},
  );

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="campaignId" value={campaignId} />
      <FormError message={state.error} />
      <SubmitButton
        className="w-full"
        disabled={disabled}
        pendingLabel="Mengambil slot..."
      >
        Ambil slot campaign
      </SubmitButton>
      {disabled && disabledReason ? (
        <p className="text-center text-xs text-muted">{disabledReason}</p>
      ) : null}
    </form>
  );
}

export function SubmitContentForm({
  campaignId,
  allowedPlatforms,
  locked = false,
  lockedReason,
}: {
  campaignId: string;
  allowedPlatforms: SocialPlatform[];
  locked?: boolean;
  lockedReason?: string;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    submitContentAction,
    {},
  );

  if (locked) {
    return <Callout tone="warning">{lockedReason}</Callout>;
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="campaignId" value={campaignId} />
      <FormError message={state.error} />
      {state.success ? <Callout tone="success">{state.success}</Callout> : null}

      <Field label="Platform">
        <Select name="platform" defaultValue={allowedPlatforms[0]}>
          {allowedPlatforms.map((platform) => (
            <option key={platform} value={platform}>
              {platformLabel[platform]}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label="Link konten"
        hint="Tempel URL video yang sudah tayang publik."
      >
        <Input
          name="contentUrl"
          type="url"
          required
          placeholder="https://tiktok.com/@akunmu/video/..."
        />
      </Field>

      <Field label="Caption (opsional)">
        <Textarea name="caption" rows={2} />
      </Field>

      <SubmitButton className="w-full" pendingLabel="Mengirim...">
        Kirim konten
      </SubmitButton>
    </form>
  );
}
