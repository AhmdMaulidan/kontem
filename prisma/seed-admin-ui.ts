import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { generateSocialVerifyToken } from "../src/domain/codes";

/**
 * Seed TAMBAHAN khusus untuk mengisi tampilan setiap menu di /admin
 * (minimal 80 baris per menu) supaya UI tidak terlihat kosong.
 *
 * BEDA dengan prisma/seed.ts:
 * - seed.ts    = skenario naratif utama, MENGHAPUS semua data lama lalu
 *                membuat ulang dari nol. Jalankan itu dulu kalau database
 *                masih kosong.
 * - seed-admin-ui.ts (file ini) = HANYA MENAMBAH data dummy volume besar,
 *                tidak menghapus apa pun. Aman dijalankan berkali-kali di
 *                atas data yang sudah ada (memakai admin yang sudah ada,
 *                dan membuat entitas dummy dengan email unik bertimestamp
 *                supaya tidak bentrok saat dijalankan ulang).
 *
 * Jalankan dengan: pnpm db:seed:admin-ui
 */

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DIRECT_URL atau DATABASE_URL belum diset di .env.");
}

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const PASSWORD = "password123";
// Suffix unik supaya email/handle tidak bentrok kalau script ini dijalankan
// berulang kali di atas data yang sama.
const RUN_ID = Date.now().toString(36);

function daysFromNow(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

const KOTA_PROVINSI = [
  { city: "Malang", province: "Jawa Timur" },
  { city: "Surabaya", province: "Jawa Timur" },
  { city: "Yogyakarta", province: "DI Yogyakarta" },
  { city: "Bandung", province: "Jawa Barat" },
  { city: "Semarang", province: "Jawa Tengah" },
  { city: "Solo", province: "Jawa Tengah" },
  { city: "Denpasar", province: "Bali" },
  { city: "Makassar", province: "Sulawesi Selatan" },
  { city: "Medan", province: "Sumatera Utara" },
  { city: "Palembang", province: "Sumatera Selatan" },
] as const;
const KATEGORI_BISNIS = [
  "KULINER",
  "WISATA_ALAM",
  "WISATA_BUATAN",
  "AKOMODASI",
  "LAINNYA",
] as const;
const PLATFORM_SOSIAL = ["TIKTOK", "INSTAGRAM", "YOUTUBE"] as const;
const JENIS_FRAUD = [
  "REUSED_CONTENT",
  "INFLATED_VIEWS",
  "DUPLICATE_ACCOUNT",
  "OFF_BRIEF",
  "FAKE_VISIT",
  "OTHER",
] as const;
const JENIS_NOTIF = [
  "CAMPAIGN_NEW_NEARBY",
  "CAMPAIGN_ENDING_SOON",
  "SUBMISSION_APPROVED",
  "SUBMISSION_REJECTED",
  "PAYOUT_RELEASED",
  "VENDOR_VERIFIED",
  "DISPUTE_UPDATE",
  "GENERAL",
] as const;

async function main() {
  console.log("Mencari akun admin yang sudah ada...");
  const admin = await db.user.findFirst({ where: { role: "ADMIN" } });
  if (!admin) {
    throw new Error(
      "Belum ada akun ADMIN di database. Jalankan `pnpm db:seed` dulu sebelum menjalankan seed UI ini.",
    );
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  // ------------------------------------------------------------
  // Pool vendor & creator terverifikasi khusus dummy UI ini, dipakai
  // sebagai "pemilik" campaign aktif/settled agar tidak menyentuh data
  // vendor/creator narasi utama di seed.ts.
  // ------------------------------------------------------------
  console.log("Membuat 6 vendor terverifikasi (dasar untuk campaign dummy)...");
  const vendorPool: { id: string; businessName: string }[] = [];
  for (let i = 0; i < 6; i++) {
    const lokasi = KOTA_PROVINSI[i % KOTA_PROVINSI.length];
    const kategori = KATEGORI_BISNIS[i % KATEGORI_BISNIS.length];
    const businessName = `Mitra UI Demo ${i + 1} ${lokasi.city}`;
    const vendor = await db.user.create({
      data: {
        role: "VENDOR",
        email: `ui-vendor-${RUN_ID}-${i + 1}@kontem.id`,
        name: `PIC Mitra UI Demo ${i + 1}`,
        phone: `0812${RUN_ID.padEnd(4, "0").slice(0, 4)}${String(i + 1).padStart(3, "0")}`,
        passwordHash,
        status: "VERIFIED",
        vendorProfile: {
          create: {
            businessName,
            category: kategori,
            description: "Vendor dummy untuk mengisi tampilan admin.",
            address: `Jl. Demo UI No. ${i + 1}`,
            city: lokasi.city,
            province: lokasi.province,
            latitude: -6.9 - i * 0.05,
            longitude: 107 + i * 0.4,
            photos: [`/demo/ui-vendor-${i + 1}.jpg`],
            picName: `PIC Mitra UI Demo ${i + 1}`,
            picPhone: `0812${RUN_ID.padEnd(4, "0").slice(0, 4)}${String(i + 1).padStart(3, "0")}`,
            verifiedAt: daysFromNow(-30),
            verifiedById: admin.id,
          },
        },
      },
    });
    vendorPool.push({ id: vendor.id, businessName });
  }

  console.log("Membuat 10 creator terverifikasi (dasar untuk submission dummy)...");
  const baseCreatorPool: { id: string }[] = [];
  for (let i = 0; i < 10; i++) {
    const lokasi = KOTA_PROVINSI[i % KOTA_PROVINSI.length];
    const platform = PLATFORM_SOSIAL[i % PLATFORM_SOSIAL.length];
    const creator = await db.user.create({
      data: {
        role: "CREATOR",
        email: `ui-creator-base-${RUN_ID}-${i + 1}@kontem.id`,
        name: `Creator UI Demo ${i + 1}`,
        phone: `0813${RUN_ID.padEnd(4, "0").slice(0, 4)}${String(i + 1).padStart(3, "0")}`,
        passwordHash,
        status: "VERIFIED",
        creatorProfile: {
          create: {
            city: lokasi.city,
            province: lokasi.province,
            trustScore: 60 + (i % 30),
            bio: "Creator dummy untuk mengisi tampilan admin.",
          },
        },
        socialAccounts: {
          create: {
            platform,
            handle: `uicreator${RUN_ID}${i + 1}`,
            profileUrl: `https://www.${platform.toLowerCase()}.com/uicreator${RUN_ID}${i + 1}`,
            followerCount: 8_000 + i * 900,
            verifyToken: generateSocialVerifyToken(),
            verifiedAt: daysFromNow(-20),
          },
        },
      },
    });
    baseCreatorPool.push({ id: creator.id });
  }

  // ------------------------------------------------------------
  // 1) Menu "Verifikasi Vendor" — 80 vendor status PENDING
  // ------------------------------------------------------------
  console.log("Membuat 80 vendor antrean verifikasi...");
  const bulkVendors: { id: string; businessName: string }[] = [];
  for (let i = 0; i < 80; i++) {
    const lokasi = KOTA_PROVINSI[i % KOTA_PROVINSI.length];
    const kategori = KATEGORI_BISNIS[i % KATEGORI_BISNIS.length];
    const businessName = `Usaha Rintisan ${i + 1} ${lokasi.city}`;
    const vendor = await db.user.create({
      data: {
        role: "VENDOR",
        email: `ui-vendor-antrean-${RUN_ID}-${i + 1}@kontem.id`,
        name: `PIC Usaha Baru ${i + 1}`,
        phone: `0814${RUN_ID.padEnd(4, "0").slice(0, 4)}${String(i + 1).padStart(3, "0")}`,
        passwordHash,
        status: "PENDING",
        vendorProfile: {
          create: {
            businessName,
            category: kategori,
            description: `Bisnis kategori ${kategori} yang baru mendaftar dan menunggu verifikasi admin.`,
            address: `Jl. Contoh Raya No. ${i + 1}`,
            city: lokasi.city,
            province: lokasi.province,
            latitude: -6.9 - (i % 10) * 0.05,
            longitude: 107 + (i % 10) * 0.4,
            photos: [
              `/demo/antrean-vendor-${i + 1}-1.jpg`,
              `/demo/antrean-vendor-${i + 1}-2.jpg`,
            ],
            picName: `PIC Usaha Baru ${i + 1}`,
            picPhone: `0814${RUN_ID.padEnd(4, "0").slice(0, 4)}${String(i + 1).padStart(3, "0")}`,
          },
        },
      },
    });
    bulkVendors.push({ id: vendor.id, businessName });
  }

  // ------------------------------------------------------------
  // 2) Menu "Verifikasi Creator" — 80 creator baru (belum diverifikasi)
  // ------------------------------------------------------------
  console.log("Membuat 80 creator antrean verifikasi...");
  const bulkCreators: { id: string }[] = [];
  for (let i = 0; i < 80; i++) {
    const lokasi = KOTA_PROVINSI[(i + 3) % KOTA_PROVINSI.length];
    const platform = PLATFORM_SOSIAL[i % PLATFORM_SOSIAL.length];
    const creator = await db.user.create({
      data: {
        role: "CREATOR",
        email: `ui-creator-antrean-${RUN_ID}-${i + 1}@kontem.id`,
        name: `Creator Baru ${i + 1}`,
        phone: `0857${RUN_ID.padEnd(4, "0").slice(0, 4)}${String(i + 1).padStart(3, "0")}`,
        passwordHash,
        status: i % 3 === 0 ? "PENDING" : "UNVERIFIED",
        creatorProfile: {
          create: {
            city: lokasi.city,
            province: lokasi.province,
            trustScore: 40 + (i % 30),
            bio: `Content creator asal ${lokasi.city} yang baru bergabung di Kontem.`,
          },
        },
        socialAccounts: {
          create: {
            platform,
            handle: `creatorbaru${RUN_ID}${i + 1}`,
            profileUrl: `https://www.${platform.toLowerCase()}.com/creatorbaru${RUN_ID}${i + 1}`,
            followerCount: 5_000 + i * 733,
            verifyToken: generateSocialVerifyToken(),
          },
        },
      },
    });
    bulkCreators.push({ id: creator.id });
  }

  const creatorPool = [...baseCreatorPool, ...bulkCreators];

  // ------------------------------------------------------------
  // 3) Menu "Approval Campaign" — 80 campaign PENDING_REVIEW
  // ------------------------------------------------------------
  console.log("Membuat 80 campaign menunggu approval...");
  for (let i = 0; i < 80; i++) {
    const vendor = bulkVendors[i];
    const kategori = KATEGORI_BISNIS[i % KATEGORI_BISNIS.length];
    await db.campaign.create({
      data: {
        vendorId: vendor.id,
        title: `Campaign Promosi ${i + 1} — ${vendor.businessName}`,
        category: kategori,
        description: `Campaign yang baru diajukan ${vendor.businessName} dan menunggu ditinjau admin.`,
        briefAngle: "Tunjukkan pengalaman otentik mengunjungi lokasi ini.",
        briefMustShow: ["Nama tempat", "Suasana lokasi"],
        briefProhibited: ["Konten diambil saat tempat tutup"],
        minDurationSec: 15,
        allowedPlatforms: ["TIKTOK", "INSTAGRAM"],
        budgetPool: 1_000_000 + (i % 10) * 250_000,
        cpmRate: 10_000 + (i % 5) * 1_000,
        platformFeeRate: 15,
        complimentType: "Gratis 1 produk/menu",
        complimentValue: 40_000 + (i % 5) * 10_000,
        startDate: daysFromNow(3 + (i % 7)),
        endDate: daysFromNow(20 + (i % 10)),
        status: "PENDING_REVIEW",
        submittedAt: daysFromNow(-(1 + (i % 5))),
      },
    });
  }

  // ------------------------------------------------------------
  // 4) Menu "Review Submission" & "Update Views" — 80 submission
  //    PENDING_REVIEW di campaign ACTIVE
  // ------------------------------------------------------------
  console.log("Membuat 80 submission menunggu review...");
  for (let i = 0; i < 80; i++) {
    const vendor = vendorPool[i % vendorPool.length];
    const creator = creatorPool[i % creatorPool.length];
    const kategori = KATEGORI_BISNIS[i % KATEGORI_BISNIS.length];
    const campaign = await db.campaign.create({
      data: {
        vendorId: vendor.id,
        title: `Campaign Aktif Antrean Review ${i + 1}`,
        category: kategori,
        description: "Campaign aktif dengan konten yang menunggu direview admin.",
        briefAngle: "Perlihatkan pengalaman nyata mengunjungi lokasi.",
        briefMustShow: ["Nama tempat", "Produk andalan"],
        briefProhibited: ["Membandingkan dengan kompetitor"],
        minDurationSec: 15,
        allowedPlatforms: ["TIKTOK", "INSTAGRAM"],
        budgetPool: 1_500_000,
        cpmRate: 12_000,
        platformFeeRate: 15,
        complimentType: "Gratis 1 produk",
        complimentValue: 50_000,
        startDate: daysFromNow(-5),
        endDate: daysFromNow(20),
        trackingEndsAt: daysFromNow(27),
        status: "ACTIVE",
        submittedAt: daysFromNow(-8),
        approvedAt: daysFromNow(-7),
        approvedById: admin.id,
        escrow: {
          create: {
            type: "DEPOSIT",
            amount: 1_500_000,
            status: "COMPLETED",
            reference: `DEMO-TRX-REVIEW-${RUN_ID}-${i + 1}`,
            completedAt: daysFromNow(-7),
          },
        },
      },
    });

    const participation = await db.campaignParticipation.create({
      data: {
        campaignId: campaign.id,
        creatorId: creator.id,
        status: "SUBMITTED",
        joinedAt: daysFromNow(-4),
      },
    });

    await db.submission.create({
      data: {
        campaignId: campaign.id,
        creatorId: creator.id,
        participationId: participation.id,
        contentUrl: `https://www.tiktok.com/@creatorbaru/video/antrean${RUN_ID}${i + 1}`,
        platform: "TIKTOK",
        caption: `Konten review antrean nomor ${i + 1}.`,
        status: "PENDING_REVIEW",
        lastViews: 1_000 + i * 450,
        lastLikes: 100 + i * 12,
        lastComments: 5 + (i % 20),
        lastSyncedAt: daysFromNow(-(1 + (i % 3))),
        submittedAt: daysFromNow(-(1 + (i % 4))),
      },
    });
  }

  // ------------------------------------------------------------
  // 5) Menu "Sengketa" — 80 dispute OPEN
  // ------------------------------------------------------------
  console.log("Membuat 80 sengketa terbuka...");
  for (let i = 0; i < 80; i++) {
    const vendor = vendorPool[(i + 2) % vendorPool.length];
    const creator = creatorPool[(i + 7) % creatorPool.length];
    const campaign = await db.campaign.create({
      data: {
        vendorId: vendor.id,
        title: `Campaign Bersengketa ${i + 1}`,
        category: "KULINER",
        description:
          "Campaign dengan submission yang ditolak vendor dan dibanding creator.",
        briefAngle: "Tunjukkan menu andalan dan suasana tempat.",
        briefMustShow: ["Nama tempat", "Menu andalan"],
        briefProhibited: ["Review tanpa datang ke lokasi"],
        minDurationSec: 15,
        allowedPlatforms: ["TIKTOK"],
        budgetPool: 1_200_000,
        cpmRate: 11_000,
        platformFeeRate: 15,
        complimentType: "Gratis 1 menu",
        complimentValue: 45_000,
        startDate: daysFromNow(-15),
        endDate: daysFromNow(5),
        trackingEndsAt: daysFromNow(12),
        status: "ACTIVE",
        submittedAt: daysFromNow(-18),
        approvedAt: daysFromNow(-17),
        approvedById: admin.id,
      },
    });

    const participation = await db.campaignParticipation.create({
      data: {
        campaignId: campaign.id,
        creatorId: creator.id,
        status: "SUBMITTED",
        joinedAt: daysFromNow(-10),
      },
    });

    const submission = await db.submission.create({
      data: {
        campaignId: campaign.id,
        creatorId: creator.id,
        participationId: participation.id,
        contentUrl: `https://www.tiktok.com/@creatorbaru/video/sengketa${RUN_ID}${i + 1}`,
        platform: "TIKTOK",
        caption: `Konten yang disengketakan nomor ${i + 1}.`,
        status: "APPEALED",
        lastViews: 8_000 + i * 300,
        lastLikes: 500 + i * 20,
        lastComments: 30 + (i % 15),
        lastSyncedAt: daysFromNow(-2),
        submittedAt: daysFromNow(-8),
        reviewedById: vendor.id,
        reviewedAt: daysFromNow(-6),
        reviewNote: "Konten dinilai tidak menampilkan menu andalan dengan jelas.",
      },
    });

    await db.dispute.create({
      data: {
        submissionId: submission.id,
        openedById: creator.id,
        reason:
          "Menu andalan sudah ditampilkan di detik ke-10, penolakan dirasa tidak beralasan.",
        status: "OPEN",
        createdAt: daysFromNow(-5),
      },
    });
  }

  // ------------------------------------------------------------
  // 6) Menu "Fraud" — 80 fraud flag OPEN/REVIEWING
  // ------------------------------------------------------------
  console.log("Membuat 80 fraud flag terbuka...");
  for (let i = 0; i < 80; i++) {
    const creator = creatorPool[(i + 11) % creatorPool.length];
    const jenis = JENIS_FRAUD[i % JENIS_FRAUD.length];
    await db.fraudFlag.create({
      data: {
        flaggedUserId: creator.id,
        reportedById: i % 4 === 0 ? admin.id : null,
        type: jenis,
        severity: 1 + (i % 3),
        detail: `Indikasi ${jenis.toLowerCase().replace(/_/g, " ")} pada aktivitas creator #${i + 1}.`,
        status: i % 5 === 0 ? "REVIEWING" : "OPEN",
      },
    });
  }

  // ------------------------------------------------------------
  // 7) Menu "Payout" & "Escrow" — 20 campaign SETTLED, masing-masing
  //    4 payout & 4 mutasi escrow (80 + 80)
  // ------------------------------------------------------------
  console.log("Membuat 20 campaign settled dengan 80 payout & 80 mutasi escrow...");
  for (let c = 0; c < 20; c++) {
    const vendor = vendorPool[c % vendorPool.length];
    const campaign = await db.campaign.create({
      data: {
        vendorId: vendor.id,
        title: `Campaign Selesai Batch ${c + 1}`,
        category: "WISATA_ALAM",
        description:
          "Campaign yang sudah settle, dipakai untuk mengisi riwayat payout & escrow.",
        briefAngle: "Tunjukkan pengalaman lengkap di lokasi.",
        briefMustShow: ["Nama tempat"],
        briefProhibited: ["Konten daur ulang dari campaign lain"],
        minDurationSec: 15,
        allowedPlatforms: ["TIKTOK", "INSTAGRAM"],
        budgetPool: 2_000_000,
        cpmRate: 10_000,
        platformFeeRate: 15,
        complimentType: "Gratis tiket masuk",
        complimentValue: 30_000,
        startDate: daysFromNow(-40),
        endDate: daysFromNow(-10),
        trackingEndsAt: daysFromNow(-3),
        status: "SETTLED",
        submittedAt: daysFromNow(-42),
        approvedAt: daysFromNow(-41),
        approvedById: admin.id,
        settledAt: daysFromNow(-2),
        escrow: {
          create: [
            {
              type: "DEPOSIT",
              amount: 2_000_000,
              status: "COMPLETED",
              reference: `DEMO-TRX-SETTLE-${RUN_ID}-${c + 1}-DEP`,
              completedAt: daysFromNow(-41),
            },
            {
              type: "PLATFORM_FEE",
              amount: 300_000,
              status: "COMPLETED",
              reference: `DEMO-TRX-SETTLE-${RUN_ID}-${c + 1}-FEE`,
              completedAt: daysFromNow(-1),
            },
            {
              type: "PAYOUT",
              amount: 1_600_000,
              status: "COMPLETED",
              reference: `DEMO-TRX-SETTLE-${RUN_ID}-${c + 1}-PAY`,
              completedAt: daysFromNow(-1),
            },
            {
              type: "REFUND",
              amount: 100_000,
              status: "COMPLETED",
              reference: `DEMO-TRX-SETTLE-${RUN_ID}-${c + 1}-REF`,
              completedAt: daysFromNow(-1),
            },
          ],
        },
      },
    });

    for (let k = 0; k < 4; k++) {
      const idx = c * 4 + k;
      const creator = creatorPool[idx % creatorPool.length];
      const views = 20_000 + idx * 500;

      const participation = await db.campaignParticipation.create({
        data: {
          campaignId: campaign.id,
          creatorId: creator.id,
          status: "COMPLETED",
          joinedAt: daysFromNow(-35),
        },
      });

      const submission = await db.submission.create({
        data: {
          campaignId: campaign.id,
          creatorId: creator.id,
          participationId: participation.id,
          contentUrl: `https://www.tiktok.com/@creatorbaru/video/settle${RUN_ID}${idx + 1}`,
          platform: "TIKTOK",
          status: "APPROVED",
          lastViews: views,
          finalViews: views,
          lastLikes: Math.round(views * 0.05),
          lastComments: Math.round(views * 0.01),
          lastSyncedAt: daysFromNow(-4),
          submittedAt: daysFromNow(-30),
          reviewedById: vendor.id,
          reviewedAt: daysFromNow(-28),
        },
      });

      const gross = Math.round(views * 10);
      const fee = Math.round(gross * 0.15);
      const net = gross - fee;

      await db.payout.create({
        data: {
          campaignId: campaign.id,
          creatorId: creator.id,
          submissionId: submission.id,
          viewsCounted: views,
          totalPoolViews: views * 4,
          sharePercent: 25,
          grossAmount: gross,
          platformFee: fee,
          netAmount: net,
          status: k === 0 ? "PENDING" : "PAID",
          paidAt: k === 0 ? null : daysFromNow(-1),
        },
      });
    }
  }

  // ------------------------------------------------------------
  // 8) Menu "Template Brief" — 80 template aktif
  // ------------------------------------------------------------
  console.log("Membuat 80 template brief aktif...");
  for (let i = 0; i < 80; i++) {
    const kategori = KATEGORI_BISNIS[i % KATEGORI_BISNIS.length];
    await db.briefTemplate.create({
      data: {
        category: kategori,
        name: `Template ${kategori} Variasi ${i + 1} (${RUN_ID})`,
        isActive: true,
        fields: {
          angles: [
            "Tunjukkan suasana lokasi secara natural",
            "Highlight produk/menu andalan",
          ],
          mustShow: ["Nama tempat", "Produk andalan"],
          prohibited: ["Konten dibuat saat lokasi tutup"],
          durasiMinimalDetik: 15,
        },
      },
    });
  }

  // ------------------------------------------------------------
  // 9) Menu "Notifikasi" — 80 notifikasi untuk admin yang login
  // ------------------------------------------------------------
  console.log("Membuat 80 notifikasi untuk admin...");
  await db.notification.createMany({
    data: Array.from({ length: 80 }, (_, i) => {
      const jenis = JENIS_NOTIF[i % JENIS_NOTIF.length];
      return {
        userId: admin.id,
        type: jenis,
        title: `Notifikasi admin #${i + 1}`,
        body: `Pemberitahuan otomatis nomor ${i + 1} terkait aktivitas platform yang perlu diketahui admin.`,
        link: i % 2 === 0 ? "/admin" : null,
        readAt: i % 3 === 0 ? daysFromNow(-1) : null,
        createdAt: daysFromNow(-(i % 20)),
      };
    }),
  });

  console.log("\nSeed UI admin selesai. Password akun dummy: %s", PASSWORD);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
