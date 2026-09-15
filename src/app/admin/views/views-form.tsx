"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  updateViewsAction,
  syncSingleSubmissionViewsAction,
  type ActionState,
} from "../actions";
import { isWithinCooldown } from "@/domain/views";
import {
  DetailDrawer,
  IconAlert,
  IconEdit,
  IconExternal,
  IconRestore,
  Input,
  SubmitButton,
  Td,
  cn,
} from "@/components/ui";

const angkaID = new Intl.NumberFormat("id-ID");

/**
 * Tombol Auto-Sync cepat pada baris tabel (Opsi 1: HTTP-based fetch tanpa Chromium/browser).
 */
export function AutoSyncButton({
  submissionId,
  lastSyncedAt,
}: {
  submissionId: string;
  lastSyncedAt?: Date | string | null;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    syncSingleSubmissionViewsAction,
    {},
  );
  const inCooldown = isWithinCooldown(lastSyncedAt);

  return (
    <form action={formAction} className="inline-flex items-center">
      <input type="hidden" name="submissionId" value={submissionId} />
      {inCooldown ? (
        <input type="hidden" name="isCorrection" value="true" />
      ) : null}
      <button
        type="submit"
        title={
          inCooldown
            ? "Tarik metrik terbaru (Cooldown aktif - mode koreksi)"
            : "Tarik views otomatis via HTTP (Opsi 1 - Hemat Resource)"
        }
        className="inline-flex items-center gap-1 rounded-md border border-line bg-surface px-2 py-1 text-xs font-medium text-foreground transition-colors hover:border-brand/40 hover:bg-brand/10 hover:text-brand"
      >
        <IconRestore className="h-3.5 w-3.5 text-brand" strokeWidth={2} />
        <span>Tarik</span>
      </button>
      {state.error ? (
        <span className="sr-only">{state.error}</span>
      ) : null}
    </form>
  );
}

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
  lastSyncedAt,
}: {
  submissionId: string;
  contentUrl: string;
  currentViews: number;
  currentLikes: number;
  currentComments: number;
  lastSyncedAt?: Date | string | null;
}) {
  return (
    <Td align="right">
      <div className="flex items-center justify-end gap-2.5">
        <AutoSyncButton
          submissionId={submissionId}
          lastSyncedAt={lastSyncedAt}
        />
        <a
          href={contentUrl}
          target="_blank"
          rel="noreferrer"
          title="Buka konten di tab baru"
          className="text-brand-600 transition-colors hover:text-brand-700"
        >
          <IconExternal className="h-4 w-4" strokeWidth={2} />
        </a>
        <DetailDrawer
          label="Edit"
          icon={<IconEdit className="h-4 w-4" strokeWidth={2} />}
          title="Update views manual"
          subtitle={`Views tercatat saat ini: ${angkaID.format(currentViews)}`}
        >
          <ViewsForm
            submissionId={submissionId}
            currentViews={currentViews}
            currentLikes={currentLikes}
            currentComments={currentComments}
            lastSyncedAt={lastSyncedAt}
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
  lastSyncedAt,
}: {
  submissionId: string;
  currentViews: number;
  currentLikes: number;
  currentComments: number;
  lastSyncedAt?: Date | string | null;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    updateViewsAction,
    {},
  );
  const [nilai, setNilai] = useState("");
  const [isCorrection, setIsCorrection] = useState(false);

  const angka = nilai === "" ? null : Number(nilai);
  const selisih =
    angka === null || Number.isNaN(angka) ? null : angka - currentViews;
  const turun = selisih !== null && selisih < 0;

  const inCooldown = isWithinCooldown(lastSyncedAt);

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

      {inCooldown ? (
        <div className="rounded-xl border border-warning/30 bg-surface-muted p-2.5 text-xs text-muted">
          <p className="font-medium text-foreground">
            Jeda throttling aktif (minimal 5 menit)
          </p>
          <p className="mt-0.5">
            Konten ini baru disinkronkan. Untuk merevisi salah ketik angka, centang opsi di bawah.
          </p>
          <label className="mt-2 flex cursor-pointer items-center gap-2 text-foreground font-medium">
            <input
              type="checkbox"
              name="isCorrection"
              value="true"
              checked={isCorrection}
              onChange={(e) => setIsCorrection(e.target.checked)}
              className="rounded border-line"
            />
            <span>Koreksi input salah (bypass jeda 5 menit)</span>
          </label>
        </div>
      ) : (
        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted">
          <input
            type="checkbox"
            name="isCorrection"
            value="true"
            checked={isCorrection}
            onChange={(e) => setIsCorrection(e.target.checked)}
            className="rounded border-line"
          />
          <span>Tandai sebagai koreksi input</span>
        </label>
      )}

      {state.error ? (
        <p className="text-sm font-medium text-danger">{state.error}</p>
      ) : null}
      {state.success ? (
        <p className="text-sm font-medium text-success">{state.success}</p>
      ) : null}

      <div className="flex items-center justify-between gap-3 pt-2">
        <span className="text-[11px] text-muted">Maks. 20 pembaruan / menit</span>
        <SubmitButton>Simpan</SubmitButton>
      </div>
    </form>
  );
}
