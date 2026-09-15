"use client";

import { useActionState, useState } from "react";
import { formatDateTime, formatIDR } from "@/lib/format";
import {
  Badge,
  Button,
  Callout,
  Card,
  CardHeader,
  Field,
  FormError,
  IconBank,
  IconCheck,
  IconWallet,
  Input,
  SubmitButton,
} from "@/components/ui";
import { updateVendorBankAction, type ActionState } from "../../actions";

interface RefundCardProps {
  campaignId: string;
  refundTrx: {
    id: string;
    amount: number;
    status: "PENDING" | "COMPLETED" | "FAILED";
    reference: string | null;
    note: string | null;
    completedAt: Date | null;
  } | null;
  vendorBank: {
    bankName: string | null;
    bankAccountNumber: string | null;
    bankAccountName: string | null;
  } | null;
}

export function RefundCard({
  campaignId,
  refundTrx,
  vendorBank,
}: RefundCardProps) {
  const [bukaFormUbah, setBukaFormUbah] = useState(false);
  const [state, formAction] = useActionState<ActionState, FormData>(
    updateVendorBankAction,
    {},
  );

  if (!refundTrx || refundTrx.amount <= 0) {
    return null;
  }

  const adaRekening = Boolean(
    vendorBank?.bankName &&
      vendorBank?.bankAccountNumber &&
      vendorBank?.bankAccountName,
  );

  // Jika refund sudah selesai ditransfer oleh admin
  if (refundTrx.status === "COMPLETED") {
    return (
      <Card className="border-success/30 bg-success-soft/20">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-success text-white">
              <IconCheck className="h-4 w-4" strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">
                Sisa Budget Pool Telah Dikembalikan (Refund)
              </h3>
              <p className="text-xs text-muted">
                {refundTrx.completedAt
                  ? `Ditransfer pada ${formatDateTime(refundTrx.completedAt)}`
                  : "Dana refund telah berhasil ditransfer"}
              </p>
            </div>
          </div>
          <Badge tone="success" icon>
            Refund Selesai
          </Badge>
        </div>

        <div className="mt-4 grid gap-3 rounded-xl bg-surface p-3 text-sm sm:grid-cols-3">
          <div>
            <span className="text-xs text-muted">Nominal Refund</span>
            <p className="tabular font-medium text-foreground">
              {formatIDR(refundTrx.amount)}
            </p>
          </div>
          <div>
            <span className="text-xs text-muted">Rekening Penerima</span>
            <p className="font-medium text-foreground">
              {vendorBank?.bankName}{" "}
              <span className="tabular">{vendorBank?.bankAccountNumber}</span>
            </p>
            <p className="text-xs text-muted">a.n. {vendorBank?.bankAccountName}</p>
          </div>
          <div>
            <span className="text-xs text-muted">No. Referensi Transfer</span>
            <p className="tabular font-mono text-xs font-medium text-foreground">
              {refundTrx.reference ?? "REFUND-AUTO"}
            </p>
          </div>
        </div>

        {refundTrx.note ? (
          <p className="mt-3 text-xs text-muted">
            <strong className="text-foreground">Catatan:</strong> {refundTrx.note}
          </p>
        ) : null}
      </Card>
    );
  }

  // Jika refund masih PENDING
  return (
    <Card className="border-warning/30">
      <CardHeader
        title="Pengembalian Sisa Dana (Refund Escrow)"
        description="Sisa budget pool yang tidak terserap saat penutupan campaign akan dikembalikan penuh ke rekening bank Anda."
        action={
          <Badge tone="warning" icon>
            Menunggu Transfer Admin
          </Badge>
        }
      />

      <div className="space-y-4">
        <div className="grid gap-3 rounded-xl bg-surface-muted p-4 text-sm sm:grid-cols-2">
          <div>
            <span className="text-xs text-muted">Nominal Sisa yang Dikembalikan</span>
            <div className="mt-1 flex items-center gap-2">
              <IconWallet className="h-5 w-5 text-brand" />
              <span className="tabular text-lg font-bold text-foreground">
                {formatIDR(refundTrx.amount)}
              </span>
            </div>
          </div>
          <div>
            <span className="text-xs text-muted">Status Pengembalian</span>
            <p className="mt-1 font-medium text-foreground">
              Dalam antrean transfer admin
            </p>
            <p className="text-xs text-muted">
              Admin akan mengirimkan dana sesuai data rekening terdaftar.
            </p>
          </div>
        </div>

        {adaRekening && !bukaFormUbah ? (
          <div className="rounded-xl border border-line p-4 text-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <IconBank className="h-4 w-4 text-brand" />
                <span className="font-medium text-foreground">
                  Rekening Tujuan Pengembalian:
                </span>
              </div>
              <Button
                variant="ghost"
                size="compact"
                onClick={() => setBukaFormUbah(true)}
              >
                Ubah Rekening
              </Button>
            </div>
            <div className="mt-2 text-foreground">
              <span className="font-semibold">{vendorBank?.bankName}</span>{" "}
              <span className="tabular font-mono font-medium">
                {vendorBank?.bankAccountNumber}
              </span>{" "}
              <span>a.n. {vendorBank?.bankAccountName}</span>
            </div>
            <p className="mt-1 text-xs text-muted">
              Pastikan nama dan nomor rekening aktif dan sesuai buku tabungan.
            </p>
          </div>
        ) : (
          <div className="space-y-3 rounded-xl border border-line p-4">
            {!adaRekening ? (
              <Callout
                tone="warning"
                title="Rekening Bank Belum Lengkap"
              >
                Mohon lengkapi rekening bank di bawah agar admin dapat mentransfer
                sisa dana pengembalian ke rekening Anda.
              </Callout>
            ) : (
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-foreground">
                  Perbarui Rekening Tujuan Refund
                </h4>
                <Button
                  variant="ghost"
                  size="compact"
                  onClick={() => setBukaFormUbah(false)}
                >
                  Batal
                </Button>
              </div>
            )}

            <form action={formAction} className="space-y-3">
              <input type="hidden" name="campaignId" value={campaignId} />
              <FormError message={state.error} />
              {state.success ? (
                <Callout tone="success" title="Berhasil">
                  {state.success}
                </Callout>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Nama Bank">
                  <Input
                    name="bankName"
                    defaultValue={vendorBank?.bankName ?? ""}
                    required
                    placeholder="BCA / Mandiri / BRI"
                  />
                </Field>
                <Field label="Nomor Rekening">
                  <Input
                    name="bankAccountNumber"
                    defaultValue={vendorBank?.bankAccountNumber ?? ""}
                    required
                    placeholder="1234567890"
                  />
                </Field>
                <Field label="Atas Nama (Pemilik)">
                  <Input
                    name="bankAccountName"
                    defaultValue={vendorBank?.bankAccountName ?? ""}
                    required
                    placeholder="Nama pemilik rekening"
                  />
                </Field>
              </div>

              <div className="pt-1">
                <SubmitButton pendingLabel="Menyimpan rekening...">
                  Simpan Rekening Refund
                </SubmitButton>
              </div>
            </form>
          </div>
        )}
      </div>
    </Card>
  );
}
