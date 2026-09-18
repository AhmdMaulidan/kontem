/**
 * Perhitungan penarikan dana dini per video (sebelum campaign settle).
 *
 * Berbeda dari `payout.ts`: penarikan di sini first-come-first-served, jadi
 * jumlah yang berhak diterima satu creator TIDAK bergantung pada submission
 * creator lain — hanya pada views video itu sendiri, dipotong plafon
 * `maxViewsPerCreator` campaign. Ini yang membuatnya aman dihitung kapan saja
 * selama campaign masih berjalan, tanpa risiko dikoreksi turun belakangan.
 *
 * Fungsi ini murni (tanpa akses database) — pengecekan sisa budget pool
 * (yang butuh data agregat semua penarikan lain) dilakukan di server action,
 * bukan di sini.
 */

/** Placeholder — gampang diubah di satu tempat sampai ada kebijakan resmi. */
export const WITHDRAWAL_FEE_RATE_PERCENT = 5;

export type CreatorEarning = {
  /** Views yang dihitung, sudah dipotong maxViewsPerCreator kalau ada. */
  viewsCounted: number;
  /** Sebelum dipotong platformFeeRate campaign. */
  rawGrossAmount: number;
  /** Setelah dipotong platformFeeRate campaign — ini yang jadi dasar penarikan. */
  grossAmount: number;
};

/** Hitung earning satu video, independen dari creator/submission lain. */
export function calculateCreatorEarning(
  views: number,
  campaign: {
    cpmRate: number;
    maxViewsPerCreator?: number | null;
    platformFeeRate: number;
  },
): CreatorEarning {
  const viewsCounted =
    typeof campaign.maxViewsPerCreator === "number" && campaign.maxViewsPerCreator > 0
      ? Math.min(views, campaign.maxViewsPerCreator)
      : views;

  const rawGrossAmount = Math.round((viewsCounted / 1000) * campaign.cpmRate);
  const platformFee = Math.round((rawGrossAmount * campaign.platformFeeRate) / 100);

  return {
    viewsCounted,
    rawGrossAmount,
    grossAmount: rawGrossAmount - platformFee,
  };
}

export type WithdrawalFee = {
  feeAmount: number;
  netAmount: number;
};

/** Potong fee penarikan (persentase) dari jumlah yang sudah dikurangi platform fee. */
export function calculateWithdrawalFee(
  amount: number,
  feeRatePercent: number = WITHDRAWAL_FEE_RATE_PERCENT,
): WithdrawalFee {
  if (amount <= 0) return { feeAmount: 0, netAmount: 0 };
  const feeAmount = Math.round((amount * feeRatePercent) / 100);
  return { feeAmount, netAmount: amount - feeAmount };
}
