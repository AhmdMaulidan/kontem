"use client";

import { useActionState } from "react";
import { updateViewsAction, type ActionState } from "../actions";
import { SubmitButton } from "@/components/ui";
import { Callout, FormError, Input } from "@/components/ui";

export function ViewsForm({
  submissionId,
  currentViews,
  currentLikes,
  currentComments,
}: {
  submissionId: string;
  currentViews: number;
  currentLikes: number;
  currentComments: number;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    updateViewsAction,
    {},
  );

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="submissionId" value={submissionId} />
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-muted">
          Views
          <Input
            name="views"
            type="number"
            min={0}
            defaultValue={currentViews}
            className="tabular mt-1 w-28"
          />
        </label>
        <label className="text-xs text-muted">
          Likes
          <Input
            name="likes"
            type="number"
            min={0}
            defaultValue={currentLikes}
            className="tabular mt-1 w-24"
          />
        </label>
        <label className="text-xs text-muted">
          Komentar
          <Input
            name="comments"
            type="number"
            min={0}
            defaultValue={currentComments}
            className="tabular mt-1 w-24"
          />
        </label>
        <SubmitButton variant="secondary" pendingLabel="Menyimpan...">
          Simpan
        </SubmitButton>
      </div>
      <FormError message={state.error} />
      {state.success ? <Callout tone="success">{state.success}</Callout> : null}
    </form>
  );
}
