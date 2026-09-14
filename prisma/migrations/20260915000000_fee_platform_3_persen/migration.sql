-- Komisi platform turun dari 15% jadi 3% (keputusan pemilik produk).
--
-- Hanya DEFAULT kolomnya yang diubah: campaign yang sudah ada TETAP memakai
-- tarif yang berlaku saat dibuat. Mengubah baris lama berarti mengubah angka
-- perjanjian yang sudah disepakati vendor dan creator — termasuk campaign yang
-- payout-nya sudah dihitung dan dicairkan.
ALTER TABLE "Campaign" ALTER COLUMN "platformFeeRate" SET DEFAULT 3;
