-- Kuota maksimal creator per campaign dihapus: creator boleh berpartisipasi
-- tanpa batas slot, keputusan pemilik produk.
ALTER TABLE "Campaign" DROP COLUMN "maxCreators";
