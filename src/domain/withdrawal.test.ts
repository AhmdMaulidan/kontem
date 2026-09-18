import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateCreatorEarning, calculateWithdrawalFee } from "./withdrawal";

test("earning creator dipotong plafon maxViewsPerCreator", () => {
  const hasil = calculateCreatorEarning(100_000, {
    cpmRate: 15_000,
    maxViewsPerCreator: 50_000,
    platformFeeRate: 3,
  });
  assert.equal(hasil.viewsCounted, 50_000);
  assert.equal(hasil.rawGrossAmount, 750_000); // 50_000/1000 * 15_000
  assert.equal(hasil.grossAmount, 750_000 - Math.round(750_000 * 0.03));
});

test("earning creator tanpa plafon dihitung penuh dari views asli", () => {
  const hasil = calculateCreatorEarning(20_000, {
    cpmRate: 10_000,
    maxViewsPerCreator: null,
    platformFeeRate: 3,
  });
  assert.equal(hasil.viewsCounted, 20_000);
  assert.equal(hasil.rawGrossAmount, 200_000);
});

test("views nol menghasilkan earning nol, bukan negatif", () => {
  const hasil = calculateCreatorEarning(0, {
    cpmRate: 15_000,
    maxViewsPerCreator: 50_000,
    platformFeeRate: 3,
  });
  assert.equal(hasil.grossAmount, 0);
});

test("fee penarikan dipotong sesuai persentase dan dibulatkan", () => {
  const hasil = calculateWithdrawalFee(100_000, 5);
  assert.equal(hasil.feeAmount, 5_000);
  assert.equal(hasil.netAmount, 95_000);
});

test("fee penarikan pada jumlah nol tidak menghasilkan nilai negatif", () => {
  const hasil = calculateWithdrawalFee(0, 5);
  assert.equal(hasil.feeAmount, 0);
  assert.equal(hasil.netAmount, 0);
});

test("fee penarikan memakai default rate kalau tidak dioper eksplisit", () => {
  const hasil = calculateWithdrawalFee(200_000);
  assert.equal(hasil.feeAmount, Math.round(200_000 * 0.05));
});
