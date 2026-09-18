"use client";

import { useActionState, useState } from "react";
import { formatDateTime, formatIDR } from "@/lib/format";
import {
  Badge,
  Button,
  Callout,
  Card,
  CardHeader,
  CopyButton,
  Field,
  FormError,
  IconBank,
  IconLock,
  Input,
  SubmitButton,
} from "@/components/ui";
import { confirmVendorTransferAction, type ActionState } from "../../actions";

interface ManualDepositCardProps {
  campaignId: string;
  budgetPool: number;
  deposit: {
    id: string;
    amount: number;
    status: "PENDING" | "COMPLETED" | "FAILED";
    reference: string | null;
    note: string | null;
    createdAt: Date;
    completedAt: Date | null;
  } | null;
}

export function ManualDepositCard({
  campaignId,
  budgetPool,
  deposit,
}: ManualDepositCardProps) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    confirmVendorTransferAction,
    {},
  );
  const [bukaFormUbah, setBukaFormUbah] = useState(false);

  const transferCode = `KTM-${campaignId.slice(-8).toUpperCase()}`;
  const sudahKonfirmasi = Boolean(
    deposit?.note && !deposit.note.toLowerCase().includes("menunggu pembayaran"),
  );

  // Jika deposit sudah lunas dan terkunci di escrow
  if (deposit?.status === "COMPLETED") {
    return (
      <Card className="border-success/30 bg-success-soft/30">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-success text-white">
              <IconLock className="h-4 w-4" strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">
                Dana Escrow Terkunci Aman
              </h3>
              <p className="text-xs text-muted">
                {deposit.completedAt
                  ? `Diverifikasi pada ${formatDateTime(deposit.completedAt)}`
                  : "Dana telah dikonfirmasi lunas"}
              </p>
            </div>
          </div>
          <Badge tone="success" icon>
            Lunas di Escrow
          </Badge>
        </div>

        <div className="mt-4 grid gap-3 rounded-xl bg-surface p-3 text-sm sm:grid-cols-2">
          <div>
            <span className="text-xs text-muted">Total Budget Pool</span>
            <p className="tabular font-medium text-foreground">
              {formatIDR(deposit.amount)}
            </p>
          </div>
          <div>
            <span className="text-xs text-muted">Nomor Referensi</span>
            <p className="tabular font-mono text-xs font-medium text-foreground">
              {deposit.reference ?? "MANUAL"}
            </p>
          </div>
        </div>
      </Card>
    );
  }

  // Jika deposit masih pending (menunggu transfer & verifikasi)
  return (
    <Card className="border-warning/30">
      <CardHeader
        title="Setor Dana ke Escrow (Transfer Bank Manual)"
        description="Dana wajib disetor ke rekening penampung resmi Kontem sebelum campaign disetujui & ditayangkan."
        action={
          <Badge tone="warning" icon>
            {sudahKonfirmasi ? "Menunggu Verifikasi" : "Menunggu Pembayaran"}
          </Badge>
        }
      />

      {/* Rincian Rekening Penampung Escrow */}
      <div className="space-y-4">
        <div className="rounded-xl border border-line bg-surface-muted p-4 text-sm">
          <div className="flex items-center gap-2 text-foreground font-medium">
            <IconBank className="h-4 w-4 text-brand" />
            <span>Rekening Escrow Resmi Kontem</span>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <span className="text-xs text-muted">Bank Tujuan</span>
              <p className="font-semibold text-foreground">BCA (Bank Central Asia)</p>
            </div>
            <div>
              <span className="text-xs text-muted">Atas Nama Rekening</span>
              <p className="font-semibold text-foreground">
                PT Kontem Media Indonesia
              </p>
            </div>
            <div>
              <span className="text-xs text-muted">Nomor Rekening</span>
              <div className="mt-0.5 flex items-center gap-2">
                <span className="font-mono text-base font-semibold tracking-wide text-foreground">
                  883019283920
                </span>
                <CopyButton value="883019283920" label="Salin No. Rekening" />
              </div>
            </div>
            <div>
              <span className="text-xs text-muted">Nominal Persis</span>
              <div className="mt-0.5 flex items-center gap-2">
                <span className="tabular font-mono text-base font-semibold text-foreground">
                  {formatIDR(budgetPool)}
                </span>
                <CopyButton value={String(budgetPool)} label="Salin Nominal" />
              </div>
            </div>
          </div>

          <div className="mt-3 border-t border-line pt-3">
            <span className="text-xs text-muted">Berita Transfer / Catatan</span>
            <div className="mt-0.5 flex items-center gap-2">
              <span className="font-mono text-xs font-semibold text-foreground">
                {transferCode}
              </span>
              <CopyButton value={transferCode} label="Salin Berita" />
            </div>
            <p className="mt-1 text-xs text-muted">
              Cantumkan kode di atas pada berita transfer mobile/internet banking untuk mempercepat pencocokan mutasi.
            </p>
          </div>
        </div>

        {/* Notifikasi jika vendor sudah konfirmasi */}
        {sudahKonfirmasi && !bukaFormUbah ? (
          <div className="space-y-3">
            <Callout tone="info" title="Konfirmasi transfer telah dikirim ke admin">
              <div className="space-y-1 text-xs">
                <p>
                  <strong className="text-foreground">Detail pengirim: </strong>
                  {deposit?.note}
                </p>
                <p className="text-muted">
                  Admin sedang mencocokkan mutasi rekening bank penampung. Begitu dana terkonfirmasi masuk, campaign akan langsung diproses ke tahap persetujuan (*approval*).
                </p>
              </div>
            </Callout>

            <Button
              variant="ghost"
              size="compact"
              onClick={() => setBukaFormUbah(true)}
            >
              Ubah rincian pengirim transfer
            </Button>
          </div>
        ) : (
          /* Form konfirmasi transfer */
          <form action={formAction} className="space-y-4 border-t border-line pt-4">
            <input type="hidden" name="campaignId" value={campaignId} />
            <FormError message={state.error} />
            {state.success ? (
              <Callout tone="success" title="Berhasil">
                {state.success}
              </Callout>
            ) : null}

            <div>
              <h4 className="text-sm font-semibold text-foreground">
                Konfirmasi Setelah Melakukan Transfer
              </h4>
              <p className="text-xs text-muted">
                Isi data rekening yang kamu gunakan untuk transfer agar admin dapat langsung memvalidasi.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Bank Pengirim">
                <Input
                  name="senderBank"
                  required
                  placeholder="BCA / Mandiri / BRI / Jago"
                />
              </Field>
              <Field label="Nama Pemilik Rekening Pengirim">
                <Input
                  name="senderName"
                  required
                  placeholder="Nama sesuai buku tabungan"
                />
              </Field>
            </div>

            <Field
              label="Catatan Tambahan / 4 Digit Terakhir Rekening (Opsional)"
              hint="Contoh: No. rek belakang ...4819"
            >
              <Input
                name="notes"
                placeholder="Contoh: Transfer via m-BCA a.n. John"
              />
            </Field>

            <div className="flex items-center justify-end gap-3">
              {bukaFormUbah ? (
                <Button
                  variant="ghost"
                  onClick={() => setBukaFormUbah(false)}
                >
                  Batal
                </Button>
              ) : null}
              <SubmitButton pendingLabel="Mengirim konfirmasi...">
                Kirim Konfirmasi Transfer
              </SubmitButton>
            </div>
          </form>
        )}
      </div>
    </Card>
  );
}
