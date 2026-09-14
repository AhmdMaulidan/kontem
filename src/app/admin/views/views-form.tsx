"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { updateViewsAction, type ActionState } from "../actions";
import {
  DetailDrawer,
  IconAlert,
  IconEdit,
  IconExternal,
  Input,
  SubmitButton,
  Td,
  cn,
} from "@/components/ui";

const angkaID = new Intl.NumberFormat("id-ID");

/**
 * Kolom Aksi. Edit-nya dibuka lewat `DetailDrawer` supaya baris tabel tidak
 * berubah jadi form saat ikon edit ditekan — pola yang sama dengan halaman
 * admin lain (vendors, campaigns, fraud).
 */
export function ViewsRowCells({
  submissionId,
  contentUrl,
  currentViews,
  currentLikes,
  currentComments,
}: {
  submissionId: string;
  contentUrl: string;
  currentViews: number;
  currentLikes: number;
  currentComments: number;
}) {
  return (
    <Td align="right">
      <div className="flex items-center justify-end gap-3">
        <a
          href={contentUrl}
          target="_blank"
          rel="noreferrer"
          title="Buka konten"
          className="text-brand-600 transition-colors hover:text-brand-700"
        >
          <IconExternal className="h-4 w-4" strokeWidth={2} />
        </a>
        <DetailDrawer
          label="Edit views"
          icon={<IconEdit className="h-4 w-4" strokeWidth={2} />}
          title="Update views"
          subtitle={`Views tercatat saat ini: ${angkaID.format(currentViews)}`}
        >
          <ViewsForm
            submissionId={submissionId}
            currentViews={currentViews}
            currentLikes={currentLikes}
            currentComments={currentComments}
          />
        </DetailDrawer>
      </div>
    </Td>
  );
}

function ViewsForm({
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
  const [nilai, setNilai] = useState("");

  const angka = nilai === "" ? null : Number(nilai);
  const selisih =
    angka === null || Number.isNaN(angka) ? null : angka - currentViews;
  const turun = selisih !== null && selisih < 0;

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="submissionId" value={submissionId} />
      <input type="hidden" name="likes" value={currentLikes} />
      <input type="hidden" name="comments" value={currentComments} />

      <div>
        <label className="text-sm font-medium text-muted" htmlFor="views">
          Views baru
        </label>
        <Input
          id="views"
          name="views"
          type="number"
          min={0}
          value={nilai}
          onChange={(event) => setNilai(event.target.value)}
          placeholder={String(currentViews)}
          autoFocus
          className={cn("tabular mt-1.5 w-full", turun && "border-danger")}
        />
      </div>

      {selisih !== null && selisih !== 0 ? (
        turun ? (
          <Link
            href="/admin/fraud"
            className="tabular inline-flex items-center gap-1 text-sm font-medium text-danger"
            title="Views turun — akan ditandai fraud"
          >
            <IconAlert className="h-3.5 w-3.5 shrink-0" />
            Selisih {angkaID.format(selisih)} — akan ditandai fraud
          </Link>
        ) : (
          <p className="tabular text-sm text-success">
            Selisih +{angkaID.format(selisih)}
          </p>
        )
      ) : null}

      {state.error ? (
        <p className="text-sm font-medium text-danger">{state.error}</p>
      ) : null}
      {state.success ? (
        <p className="text-sm font-medium text-success">{state.success}</p>
      ) : null}

      <SubmitButton>Simpan</SubmitButton>
    </form>
  );
}
