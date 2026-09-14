import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { generateRedeemCode } from "../src/domain/codes";
import { calculatePayouts } from "../src/domain/payout";

// Seed menulis ribuan baris dalam satu sesi panjang, jadi memakai koneksi
// langsung (DIRECT_URL) dan bukan transaction pooler.
const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DIRECT_URL atau DATABASE_URL belum diset di .env.");
}

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const PASSWORD = "password123";

function daysFromNow(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

async function main() {
  console.log("Menghapus data lama...");
  // Urutan penting: anak dulu, induk belakangan.
  await db.auditLog.deleteMany();
  await db.notification.deleteMany();
  await db.payout.deleteMany();
  await db.escrowTransaction.deleteMany();
  await db.disputeMessage.deleteMany();
  await db.dispute.deleteMany();
  await db.fraudFlag.deleteMany();
  await db.viewSnapshot.deleteMany();
  await db.submission.deleteMany();
  await db.redeemCode.deleteMany();
  await db.campaignParticipation.deleteMany();
  await db.campaign.deleteMany();
  await db.briefTemplate.deleteMany();
  await db.socialAccount.deleteMany();
  await db.creatorProfile.deleteMany();
  await db.vendorProfile.deleteMany();
  await db.user.deleteMany();

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  console.log("Membuat admin...");
  const admin = await db.user.create({
    data: {
      role: "ADMIN",
      email: "admin@kontem.id",
      name: "Admin Kontem",
      phone: "081200000001",
      passwordHash,
      status: "VERIFIED",
    },
  });

  console.log("Membuat template brief...");
  const kulinerTemplate = await db.briefTemplate.create({
    data: {
      category: "KULINER",
      name: "Template Kuliner — Food Review",
      fields: {
        angleSaran: [
          "First impression saat masuk tempat",
          "Close-up menu andalan + reaksi jujur saat mencicipi",
          "Sebut nama tempat dan lokasi minimal sekali",
        ],
        wajibTampil: ["Nama tempat", "Menu andalan", "Suasana ruangan"],
        larangan: ["Membandingkan langsung dengan kompetitor"],
        durasiMinimalDetik: 20,
      },
    },
  });

  const wisataTemplate = await db.briefTemplate.create({
    data: {
      category: "WISATA_ALAM",
      name: "Template Wisata Alam — Destination Teaser",
      fields: {
        angleSaran: [
          "Establishing shot pemandangan utama",
          "Rute dan estimasi waktu tempuh dari pusat kota",
          "Tips praktis: jam terbaik, harga tiket, fasilitas",
        ],
        wajibTampil: ["Nama destinasi", "Spot foto utama", "Harga tiket masuk"],
        larangan: ["Menampilkan sampah/area yang sedang direnovasi"],
        durasiMinimalDetik: 30,
      },
    },
  });

  console.log("Membuat vendor...");
  const vendorKopi = await db.user.create({
    data: {
      role: "VENDOR",
      email: "vendor@kopisenja.id",
      name: "Rani Pratiwi",
      phone: "081234567801",
      passwordHash,
      status: "VERIFIED",
      vendorProfile: {
        create: {
          businessName: "Kopi Senja Malang",
          category: "KULINER",
          description:
            "Coffee shop dengan rooftop menghadap Gunung Panderman. Spesialis manual brew dan menu nusantara.",
          address: "Jl. Soekarno Hatta No. 21, Lowokwaru",
          city: "Malang",
          province: "Jawa Timur",
          latitude: -7.9497,
          longitude: 112.6156,
          photos: ["/demo/kopi-senja-1.jpg", "/demo/kopi-senja-2.jpg"],
          mapsUrl: "https://maps.google.com/?q=-7.9497,112.6156",
          picName: "Rani Pratiwi",
          picPhone: "081234567801",
          verifiedAt: daysFromNow(-30),
          verifiedById: admin.id,
          verificationNote: "Dikonfirmasi via telepon, lokasi cocok di Maps.",
        },
      },
    },
  });

  const vendorAirTerjun = await db.user.create({
    data: {
      role: "VENDOR",
      email: "vendor@tumpaksewu.id",
      name: "Bagus Setiawan",
      phone: "081234567802",
      passwordHash,
      status: "VERIFIED",
      vendorProfile: {
        create: {
          businessName: "Wisata Coban Tirta",
          category: "WISATA_ALAM",
          description:
            "Air terjun setinggi 40 meter dengan jalur trekking 20 menit dan area camping.",
          address: "Desa Sidomulyo, Kec. Pronojiwo",
          city: "Lumajang",
          province: "Jawa Timur",
          latitude: -8.2306,
          longitude: 112.9147,
          photos: ["/demo/coban-1.jpg"],
          picName: "Bagus Setiawan",
          picPhone: "081234567802",
          verifiedAt: daysFromNow(-18),
          verifiedById: admin.id,
        },
      },
    },
  });

  // Vendor ini sengaja dibiarkan menunggu supaya panel approval admin ada isinya.
  const vendorKafe = await db.user.create({
    data: {
      role: "VENDOR",
      email: "vendor@kafearsip.id",
      name: "Dimas Prakoso",
      phone: "081234567804",
      passwordHash,
      status: "VERIFIED",
      vendorProfile: {
        create: {
          businessName: "Kafe Arsip Surabaya",
          category: "KULINER",
          description:
            "Kafe dengan ruang kerja bersama dan koleksi buku, cocok untuk konten produktif.",
          address: "Jl. Dharmawangsa No. 48, Gubeng",
          city: "Surabaya",
          province: "Jawa Timur",
          latitude: -7.2687,
          longitude: 112.7581,
          photos: ["/demo/kafe-arsip-1.jpg"],
          mapsUrl: "https://maps.google.com/?q=-7.2687,112.7581",
          picName: "Dimas Prakoso",
          picPhone: "081234567804",
          verifiedAt: daysFromNow(-22),
          verifiedById: admin.id,
        },
      },
    },
  });

  const vendorPantai = await db.user.create({
    data: {
      role: "VENDOR",
      email: "vendor@pantailestari.id",
      name: "Ayu Kartika",
      phone: "081234567805",
      passwordHash,
      status: "VERIFIED",
      vendorProfile: {
        create: {
          businessName: "Pantai Lestari Gunungkidul",
          category: "WISATA_ALAM",
          description:
            "Pantai berpasir putih dengan area camping dan spot sunset.",
          address: "Desa Kemadang, Kec. Tanjungsari",
          city: "Gunungkidul",
          province: "DI Yogyakarta",
          latitude: -8.1364,
          longitude: 110.5931,
          photos: ["/demo/pantai-lestari-1.jpg"],
          mapsUrl: "https://maps.google.com/?q=-8.1364,110.5931",
          picName: "Ayu Kartika",
          picPhone: "081234567805",
          verifiedAt: daysFromNow(-14),
          verifiedById: admin.id,
        },
      },
    },
  });

  const vendorDanau = await db.user.create({
    data: {
      role: "VENDOR",
      email: "vendor@danautirta.id",
      name: "Rangga Wibowo",
      phone: "081234567806",
      passwordHash,
      status: "VERIFIED",
      vendorProfile: {
        create: {
          businessName: "Danau Tirta Recreation Park",
          category: "WISATA_BUATAN",
          description:
            "Danau buatan dengan sewa perahu, jalur sepeda, dan food court tepi air.",
          address: "Jl. Raya Pujon KM 8, Ngantang",
          city: "Malang",
          province: "Jawa Timur",
          latitude: -7.8412,
          longitude: 112.4187,
          photos: ["/demo/danau-tirta-1.jpg"],
          mapsUrl: "https://maps.google.com/?q=-7.8412,112.4187",
          picName: "Rangga Wibowo",
          picPhone: "081234567806",
          verifiedAt: daysFromNow(-9),
          verifiedById: admin.id,
        },
      },
    },
  });

  const vendorPanggung = await db.user.create({
    data: {
      role: "VENDOR",
      email: "vendor@panggungkota.id",
      name: "Laras Anindya",
      phone: "081234567807",
      passwordHash,
      status: "VERIFIED",
      vendorProfile: {
        create: {
          businessName: "Panggung Kota Semarang",
          category: "LAINNYA",
          description:
            "Ruang pertunjukan musik mingguan dengan panggung terbuka dan area jajanan.",
          address: "Jl. Pemuda No. 148, Semarang Tengah",
          city: "Semarang",
          province: "Jawa Tengah",
          latitude: -6.9825,
          longitude: 110.4098,
          photos: ["/demo/panggung-kota-1.jpg"],
          mapsUrl: "https://maps.google.com/?q=-6.9825,110.4098",
          picName: "Laras Anindya",
          picPhone: "081234567807",
          verifiedAt: daysFromNow(-6),
          verifiedById: admin.id,
        },
      },
    },
  });

  const vendorBaru = await db.user.create({
    data: {
      role: "VENDOR",
      email: "vendor@sambalmbokdar.id",
      name: "Sri Wahyuni",
      phone: "081234567803",
      passwordHash,
      status: "PENDING",
      vendorProfile: {
        create: {
          businessName: "Warung Sambal Mbok Dar",
          category: "KULINER",
          description: "Warung sambal legendaris, buka sejak 1998.",
          address: "Jl. Kaliurang KM 5 No. 12",
          city: "Sleman",
          province: "DI Yogyakarta",
          latitude: -7.7561,
          longitude: 110.3789,
          photos: ["/demo/mbokdar-1.jpg"],
          picName: "Sri Wahyuni",
          picPhone: "081234567803",
        },
      },
    },
  });

  console.log("Membuat creator...");
  const creatorSeeds = [
    {
      email: "dita@creator.id",
      name: "Dita Anggraini",
      city: "Malang",
      handle: "ditamakan",
      followers: 18400,
      trust: 82,
    },
    {
      email: "reza@creator.id",
      name: "Reza Fadillah",
      city: "Malang",
      handle: "rezajalanjalan",
      followers: 7200,
      trust: 71,
    },
    {
      email: "nabila@creator.id",
      name: "Nabila Zahra",
      city: "Surabaya",
      handle: "nabilabites",
      followers: 45300,
      trust: 90,
    },
    {
      email: "yoga@creator.id",
      name: "Yoga Prasetya",
      city: "Lumajang",
      handle: "yogaoutdoor",
      followers: 3100,
      trust: 64,
    },
    {
      email: "sinta@creator.id",
      name: "Sinta Maharani",
      city: "Malang",
      handle: "sintaexplore",
      followers: 12800,
      trust: 55,
    },
  ];

  const creators = [];
  for (const seed of creatorSeeds) {
    const creator = await db.user.create({
      data: {
        role: "CREATOR",
        email: seed.email,
        name: seed.name,
        phone: `0812${Math.floor(10000000 + Math.random() * 89999999)}`,
        passwordHash,
        status: "VERIFIED",
        creatorProfile: {
          create: {
            city: seed.city,
            province: seed.city === "Surabaya" ? "Jawa Timur" : "Jawa Timur",
            trustScore: seed.trust,
            bio: `Konten kreator ${seed.city}.`,
            bankName: "BCA",
            bankAccountNumber: `8${Math.floor(100000000 + Math.random() * 899999999)}`,
            bankAccountName: seed.name.toUpperCase(),
          },
        },
        socialAccounts: {
          create: {
            platform: "TIKTOK",
            handle: seed.handle,
            profileUrl: `https://tiktok.com/@${seed.handle}`,
            followerCount: seed.followers,
            verifiedAt: daysFromNow(-20),
          },
        },
      },
    });
    creators.push(creator);
  }

  const [dita, reza, nabila, yoga, sinta] = creators;

  // ---------------------------------------------------------------- campaign aktif

  console.log("Membuat campaign aktif...");
  const campaignAktif = await db.campaign.create({
    data: {
      vendorId: vendorKopi.id,
      title: "Rooftop Coffee Session — Kopi Senja Malang",
      category: "KULINER",
      description:
        "Cari 8 creator Malang untuk bikin konten suasana rooftop sore hari dan menu signature kami.",
      templateId: kulinerTemplate.id,
      briefAngle:
        "Tunjukkan suasana rooftop saat golden hour, lalu review jujur menu Kopi Senja Signature.",
      briefMustShow: [
        "Nama tempat 'Kopi Senja Malang'",
        "Menu Kopi Senja Signature",
        "View rooftop menghadap gunung",
      ],
      briefProhibited: [
        "Membandingkan dengan coffee shop lain",
        "Konten diambil saat kafe tutup",
      ],
      minDurationSec: 20,
      allowedPlatforms: ["TIKTOK", "INSTAGRAM"],
      budgetPool: 2_500_000,
      cpmRate: 15_000,
      platformFeeRate: 3,
      maxCreators: 8,
      complimentType: "Gratis 1 menu kopi + 1 snack",
      complimentValue: 65_000,
      complimentTerms:
        "Berlaku untuk 1 orang, jam 15.00-18.00, tunjukkan kode redeem ke kasir.",
      startDate: daysFromNow(-10),
      endDate: daysFromNow(11),
      trackingEndsAt: daysFromNow(18),
      status: "ACTIVE",
      submittedAt: daysFromNow(-13),
      approvedAt: daysFromNow(-12),
      approvedById: admin.id,
      escrow: {
        create: {
          type: "DEPOSIT",
          amount: 2_500_000,
          status: "COMPLETED",
          reference: "DEMO-TRX-001",
          note: "Deposit budget pool sebelum campaign live.",
          completedAt: daysFromNow(-12),
        },
      },
    },
  });

  // Peserta campaign aktif dengan tahapan yang berbeda-beda, supaya setiap
  // state di dashboard punya contoh nyata.
  const pesertaAktif = [
    { creator: dita, views: 84_300, status: "APPROVED" as const },
    { creator: reza, views: 21_700, status: "APPROVED" as const },
    { creator: nabila, views: 156_200, status: "APPROVED" as const },
    { creator: sinta, views: 4_900, status: "PENDING_REVIEW" as const },
  ];

  for (const peserta of pesertaAktif) {
    const participation = await db.campaignParticipation.create({
      data: {
        campaignId: campaignAktif.id,
        creatorId: peserta.creator.id,
        status: peserta.status === "APPROVED" ? "COMPLETED" : "SUBMITTED",
        joinedAt: daysFromNow(-9),
      },
    });

    await db.redeemCode.create({
      data: {
        campaignId: campaignAktif.id,
        participationId: participation.id,
        code: generateRedeemCode(),
        status: "USED",
        redeemedAt: daysFromNow(-7),
        redeemedBy: vendorKopi.id,
        expiresAt: daysFromNow(11),
      },
    });

    const submission = await db.submission.create({
      data: {
        campaignId: campaignAktif.id,
        creatorId: peserta.creator.id,
        participationId: participation.id,
        contentUrl: `https://tiktok.com/@user/video/${Math.floor(7000000000000000000 + Math.random() * 99999999999999999)}`,
        platform: "TIKTOK",
        caption: "Sore di rooftop Kopi Senja Malang ☕",
        status: peserta.status,
        lastViews: peserta.views,
        lastLikes: Math.round(peserta.views * 0.08),
        lastComments: Math.round(peserta.views * 0.01),
        lastSyncedAt: daysFromNow(-1),
        submittedAt: daysFromNow(-6),
        reviewedById: peserta.status === "APPROVED" ? vendorKopi.id : null,
        reviewedAt: peserta.status === "APPROVED" ? daysFromNow(-5) : null,
        reviewNote:
          peserta.status === "APPROVED" ? "Sesuai brief, angle bagus." : null,
      },
    });

    // Riwayat views bertahap supaya grafik tren punya data.
    for (let day = 5; day >= 0; day -= 1) {
      const factor = 1 - day * 0.15;
      await db.viewSnapshot.create({
        data: {
          submissionId: submission.id,
          views: Math.max(0, Math.round(peserta.views * factor)),
          likes: Math.round(peserta.views * factor * 0.08),
          comments: Math.round(peserta.views * factor * 0.01),
          source: "MANUAL",
          capturedAt: daysFromNow(-day),
        },
      });
    }
  }

  // Satu submission ditolak vendor lalu dibanding creator — memberi isi
  // ke panel sengketa admin.
  const partisipasiSengketa = await db.campaignParticipation.create({
    data: {
      campaignId: campaignAktif.id,
      creatorId: yoga.id,
      status: "SUBMITTED",
      joinedAt: daysFromNow(-8),
    },
  });

  await db.redeemCode.create({
    data: {
      campaignId: campaignAktif.id,
      participationId: partisipasiSengketa.id,
      code: generateRedeemCode(),
      status: "USED",
      redeemedAt: daysFromNow(-6),
      redeemedBy: vendorKopi.id,
      expiresAt: daysFromNow(11),
    },
  });

  const submissionSengketa = await db.submission.create({
    data: {
      campaignId: campaignAktif.id,
      creatorId: yoga.id,
      participationId: partisipasiSengketa.id,
      contentUrl: "https://tiktok.com/@yogaoutdoor/video/7312345678901234567",
      platform: "TIKTOK",
      caption: "Ngopi sore di Malang",
      status: "APPEALED",
      lastViews: 31_400,
      lastLikes: 2_100,
      lastComments: 190,
      lastSyncedAt: daysFromNow(-1),
      submittedAt: daysFromNow(-5),
      reviewedById: vendorKopi.id,
      reviewedAt: daysFromNow(-4),
      reviewNote: "Menu signature tidak ditampilkan sama sekali.",
    },
  });

  const dispute = await db.dispute.create({
    data: {
      submissionId: submissionSengketa.id,
      openedById: yoga.id,
      reason:
        "Menu signature muncul di detik 00:14-00:19 dengan caption menu. Mohon ditinjau ulang.",
      status: "UNDER_REVIEW",
    },
  });

  await db.disputeMessage.createMany({
    data: [
      {
        disputeId: dispute.id,
        senderId: yoga.id,
        body: "Halo, saya sudah menampilkan menu signature di detik 14. Bisa dicek lagi?",
        createdAt: daysFromNow(-3),
      },
      {
        disputeId: dispute.id,
        senderId: vendorKopi.id,
        body: "Terlihat sekilas tapi nama menunya tidak disebut sesuai brief.",
        createdAt: daysFromNow(-2),
      },
      {
        disputeId: dispute.id,
        senderId: admin.id,
        body: "Sedang kami tinjau, keputusan maksimal 2x24 jam.",
        createdAt: daysFromNow(-1),
      },
    ],
  });

  await db.fraudFlag.create({
    data: {
      submissionId: submissionSengketa.id,
      flaggedUserId: yoga.id,
      reportedById: vendorKopi.id,
      type: "OFF_BRIEF",
      severity: 1,
      detail: "Vendor menilai konten tidak memenuhi poin wajib brief.",
      status: "REVIEWING",
    },
  });

  // ---------------------------------------------------------------- campaign wisata

  console.log("Membuat campaign wisata...");
  await db.campaign.create({
    data: {
      vendorId: vendorAirTerjun.id,
      title: "Trekking Coban Tirta — Konten Musim Kemarau",
      category: "WISATA_ALAM",
      description:
        "Butuh konten yang menunjukkan rute trekking aman dan spot foto utama.",
      templateId: wisataTemplate.id,
      briefAngle:
        "Perjalanan dari parkiran sampai air terjun, lengkap dengan tips perlengkapan.",
      briefMustShow: ["Nama 'Coban Tirta'", "Spot foto utama", "Harga tiket Rp 15.000"],
      briefProhibited: ["Berenang di bawah air terjun (larangan keselamatan)"],
      minDurationSec: 30,
      allowedPlatforms: ["TIKTOK", "INSTAGRAM", "YOUTUBE"],
      budgetPool: 1_800_000,
      cpmRate: 12_000,
      platformFeeRate: 3,
      maxCreators: 6,
      complimentType: "Tiket masuk gratis + parkir",
      complimentValue: 20_000,
      complimentTerms: "Berlaku 1 orang, hari kerja saja.",
      startDate: daysFromNow(-2),
      endDate: daysFromNow(26),
      trackingEndsAt: daysFromNow(33),
      status: "ACTIVE",
      submittedAt: daysFromNow(-6),
      approvedAt: daysFromNow(-4),
      approvedById: admin.id,
      escrow: {
        create: {
          type: "DEPOSIT",
          amount: 1_800_000,
          status: "COMPLETED",
          reference: "DEMO-TRX-002",
          completedAt: daysFromNow(-4),
        },
      },
    },
  });

  // ---------------------------------------------------------------- campaign aktif lainnya

  // Empat campaign aktif tambahan supaya katalog halaman depan terisi enam
  // kartu — cukup untuk melihat grid dua barisnya, dan tetap data nyata,
  // bukan angka contoh yang ditulis di JSX (design.md bagian 10.1).
  console.log("Membuat campaign aktif lainnya...");

  const campaignAktifLain = [
    {
      vendorId: vendorKafe.id,
      title: "Work From Kafe — Sesi Pagi",
      category: "KULINER" as const,
      description:
        "Cari creator Surabaya untuk menunjukkan suasana kerja pagi dan menu sarapan.",
      briefAngle:
        "Tunjukkan sudut kerja favorit, colokan, dan menu sarapan andalan.",
      briefMustShow: ["Nama 'Kafe Arsip Surabaya'", "Area kerja lantai dua"],
      briefProhibited: ["Merekam tamu lain tanpa izin"],
      budgetPool: 2_200_000,
      cpmRate: 14_000,
      maxCreators: 7,
      complimentType: "Gratis kopi + roti bakar",
      complimentValue: 55_000,
      startDate: daysFromNow(-5),
      endDate: daysFromNow(16),
      reference: "DEMO-TRX-004",
    },
    {
      vendorId: vendorPantai.id,
      title: "Sunset Camping — Pantai Lestari",
      category: "WISATA_ALAM" as const,
      description:
        "Butuh konten yang menunjukkan area camping dan proses reservasinya.",
      briefAngle: "Dari parkiran sampai tenda berdiri, lalu sunset dari bibir pantai.",
      briefMustShow: ["Nama 'Pantai Lestari'", "Tarif camping Rp 35.000"],
      briefProhibited: ["Menyalakan api unggun di luar area yang ditentukan"],
      budgetPool: 3_400_000,
      cpmRate: 16_000,
      maxCreators: 12,
      complimentType: "Tiket masuk + slot camping semalam",
      complimentValue: 75_000,
      startDate: daysFromNow(-8),
      endDate: daysFromNow(22),
      reference: "DEMO-TRX-005",
    },
    {
      vendorId: vendorKopi.id,
      title: "Menu Baru Nusantara — Kopi Senja",
      category: "KULINER" as const,
      description: "Peluncuran tiga menu kopi rempah, butuh konten rasa jujur.",
      briefAngle: "Cicip tiga menu rempah baru dan bandingkan karakter rasanya.",
      briefMustShow: ["Tiga menu rempah baru", "Harga per gelas"],
      briefProhibited: ["Klaim khasiat kesehatan"],
      budgetPool: 1_500_000,
      cpmRate: 13_000,
      maxCreators: 5,
      complimentType: "Gratis 3 menu rempah baru",
      complimentValue: 90_000,
      startDate: daysFromNow(-3),
      endDate: daysFromNow(9),
      reference: "DEMO-TRX-006",
    },
    {
      vendorId: vendorDanau.id,
      title: "Sewa Perahu Sore — Danau Tirta",
      category: "WISATA_BUATAN" as const,
      description:
        "Konten yang menunjukkan rute perahu dan suasana food court tepi danau.",
      briefAngle: "Naik perahu saat sore, lalu jajan di food court tepi air.",
      briefMustShow: ["Nama 'Danau Tirta'", "Tarif sewa perahu Rp 25.000"],
      briefProhibited: ["Melepas pelampung saat di atas perahu"],
      budgetPool: 2_600_000,
      cpmRate: 15_000,
      maxCreators: 10,
      complimentType: "Sewa perahu + voucher food court",
      complimentValue: 70_000,
      startDate: daysFromNow(-4),
      endDate: daysFromNow(20),
      reference: "DEMO-TRX-008",
    },
    {
      vendorId: vendorPanggung.id,
      title: "Panggung Sabtu Malam — Semarang",
      category: "LAINNYA" as const,
      description:
        "Butuh konten suasana pertunjukan musik mingguan dan cara beli tiketnya.",
      briefAngle: "Suasana panggung dari antre masuk sampai lagu penutup.",
      briefMustShow: ["Nama 'Panggung Kota Semarang'", "Jadwal Sabtu 19.00"],
      briefProhibited: ["Merekam penonton lain dari dekat tanpa izin"],
      budgetPool: 1_900_000,
      cpmRate: 14_000,
      maxCreators: 8,
      complimentType: "Tiket masuk + minuman",
      complimentValue: 50_000,
      startDate: daysFromNow(-6),
      endDate: daysFromNow(13),
      reference: "DEMO-TRX-009",
    },
    {
      vendorId: vendorAirTerjun.id,
      title: "Coban Tirta Sunrise — Batch Kedua",
      category: "WISATA_ALAM" as const,
      description: "Konten trek pagi buta sampai matahari terbit di air terjun.",
      briefAngle: "Perjalanan sebelum subuh, perlengkapan wajib, dan momen sunrise.",
      briefMustShow: ["Nama 'Coban Tirta'", "Jam buka gerbang 04.30"],
      briefProhibited: ["Trekking sendirian tanpa pemandu (larangan keselamatan)"],
      budgetPool: 2_800_000,
      cpmRate: 17_000,
      maxCreators: 9,
      complimentType: "Tiket sunrise + pemandu lokal",
      complimentValue: 60_000,
      startDate: daysFromNow(-1),
      endDate: daysFromNow(30),
      reference: "DEMO-TRX-007",
    },
  ];

  for (const item of campaignAktifLain) {
    const { reference, ...data } = item;
    await db.campaign.create({
      data: {
        ...data,
        minDurationSec: 20,
        allowedPlatforms: ["TIKTOK"],
        platformFeeRate: 3,
        trackingEndsAt: daysFromNow(40),
        status: "ACTIVE",
        submittedAt: daysFromNow(-12),
        approvedAt: daysFromNow(-10),
        approvedById: admin.id,
        escrow: {
          create: {
            type: "DEPOSIT",
            amount: data.budgetPool,
            status: "COMPLETED",
            reference,
            completedAt: daysFromNow(-10),
          },
        },
      },
    });
  }

  // ---------------------------------------------------------------- campaign menunggu approval

  console.log("Membuat campaign menunggu approval admin...");
  await db.campaign.create({
    data: {
      vendorId: vendorKopi.id,
      title: "Promo Ramadan — Paket Buka Puasa",
      category: "KULINER",
      description: "Campaign musiman untuk paket buka puasa berdua.",
      briefAngle: "Suasana buka puasa di rooftop dengan paket berdua.",
      briefMustShow: ["Paket Buka Berdua Rp 89.000", "Suasana menjelang maghrib"],
      briefProhibited: ["Konten yang menyinggung SARA"],
      minDurationSec: 20,
      allowedPlatforms: ["TIKTOK", "INSTAGRAM"],
      budgetPool: 3_000_000,
      cpmRate: 18_000,
      platformFeeRate: 3,
      maxCreators: 10,
      complimentType: "Paket buka puasa berdua",
      complimentValue: 89_000,
      startDate: daysFromNow(5),
      endDate: daysFromNow(35),
      status: "PENDING_REVIEW",
      submittedAt: daysFromNow(-1),
      // Deposit sengaja dibiarkan PENDING: admin harus menandainya lunas
      // sebelum campaign boleh disetujui.
      escrow: {
        create: {
          type: "DEPOSIT",
          amount: 3_000_000,
          status: "PENDING",
          note: "Menunggu pembayaran deposit budget pool.",
        },
      },
    },
  });

  // ---------------------------------------------------------------- campaign selesai + payout

  console.log("Membuat campaign selesai beserta payout...");
  const campaignSelesai = await db.campaign.create({
    data: {
      vendorId: vendorKopi.id,
      title: "Grand Opening Kopi Senja — Batch Perdana",
      category: "KULINER",
      description: "Campaign pembukaan cabang baru, sudah selesai dan cair.",
      briefAngle: "Liputan suasana grand opening dan promo diskon 50%.",
      briefMustShow: ["Nama tempat", "Promo grand opening"],
      briefProhibited: [],
      minDurationSec: 15,
      allowedPlatforms: ["TIKTOK"],
      budgetPool: 1_500_000,
      cpmRate: 14_000,
      platformFeeRate: 3,
      maxCreators: 5,
      complimentType: "Gratis 2 menu kopi",
      complimentValue: 70_000,
      startDate: daysFromNow(-60),
      endDate: daysFromNow(-35),
      trackingEndsAt: daysFromNow(-28),
      status: "SETTLED",
      submittedAt: daysFromNow(-65),
      approvedAt: daysFromNow(-63),
      approvedById: admin.id,
      settledAt: daysFromNow(-27),
      escrow: {
        create: {
          type: "DEPOSIT",
          amount: 1_500_000,
          status: "COMPLETED",
          reference: "DEMO-TRX-000",
          completedAt: daysFromNow(-63),
        },
      },
    },
  });

  const hasilLama = [
    { creator: dita, views: 62_800 },
    { creator: reza, views: 38_400 },
    { creator: nabila, views: 104_500 },
  ];

  const entriesLama = [];
  for (const hasil of hasilLama) {
    const participation = await db.campaignParticipation.create({
      data: {
        campaignId: campaignSelesai.id,
        creatorId: hasil.creator.id,
        status: "COMPLETED",
        joinedAt: daysFromNow(-58),
      },
    });

    await db.redeemCode.create({
      data: {
        campaignId: campaignSelesai.id,
        participationId: participation.id,
        code: generateRedeemCode(),
        status: "USED",
        redeemedAt: daysFromNow(-55),
        redeemedBy: vendorKopi.id,
        expiresAt: daysFromNow(-35),
      },
    });

    const submission = await db.submission.create({
      data: {
        campaignId: campaignSelesai.id,
        creatorId: hasil.creator.id,
        participationId: participation.id,
        contentUrl: `https://tiktok.com/@user/video/${Math.floor(7000000000000000000 + Math.random() * 99999999999999999)}`,
        platform: "TIKTOK",
        status: "APPROVED",
        lastViews: hasil.views,
        finalViews: hasil.views,
        lastLikes: Math.round(hasil.views * 0.09),
        lastComments: Math.round(hasil.views * 0.012),
        lastSyncedAt: daysFromNow(-28),
        submittedAt: daysFromNow(-52),
        reviewedById: vendorKopi.id,
        reviewedAt: daysFromNow(-51),
        reviewNote: "Bagus.",
      },
    });

    entriesLama.push({
      creatorId: hasil.creator.id,
      submissionId: submission.id,
      views: hasil.views,
    });
  }

  // Payout dihitung dengan fungsi yang sama seperti yang dipakai aplikasi,
  // supaya angka di data demo konsisten dengan logika produksi.
  const hasilPayout = calculatePayouts(entriesLama, {
    budgetPool: campaignSelesai.budgetPool,
    cpmRate: campaignSelesai.cpmRate,
    platformFeeRate: campaignSelesai.platformFeeRate,
  });

  for (const line of hasilPayout.lines) {
    await db.payout.create({
      data: {
        campaignId: campaignSelesai.id,
        creatorId: line.creatorId,
        submissionId: line.submissionId,
        viewsCounted: line.viewsCounted,
        totalPoolViews: line.totalPoolViews,
        sharePercent: line.sharePercent,
        grossAmount: line.grossAmount,
        platformFee: line.platformFee,
        netAmount: line.netAmount,
        status: "PAID",
        paidAt: daysFromNow(-27),
      },
    });
  }

  await db.escrowTransaction.createMany({
    data: [
      {
        campaignId: campaignSelesai.id,
        type: "PAYOUT",
        amount: hasilPayout.totalNetToCreators,
        status: "COMPLETED",
        reference: "DEMO-PAYOUT-000",
        completedAt: daysFromNow(-27),
      },
      {
        campaignId: campaignSelesai.id,
        type: "PLATFORM_FEE",
        amount: hasilPayout.totalPlatformFee,
        status: "COMPLETED",
        reference: "DEMO-FEE-000",
        completedAt: daysFromNow(-27),
      },
      ...(hasilPayout.refundToVendor > 0
        ? [
            {
              campaignId: campaignSelesai.id,
              type: "REFUND" as const,
              amount: hasilPayout.refundToVendor,
              status: "COMPLETED" as const,
              reference: "DEMO-REFUND-000",
              note: "Sisa pool dikembalikan karena tagihan CPM di bawah budget.",
              completedAt: daysFromNow(-27),
            },
          ]
        : []),
    ],
  });

  console.log("Membuat notifikasi...");
  await db.notification.createMany({
    data: [
      {
        userId: dita.id,
        type: "PAYOUT_RELEASED",
        title: "Payout cair",
        body: "Payout campaign Grand Opening Kopi Senja sudah ditransfer.",
        link: "/creator/earnings",
        createdAt: daysFromNow(-27),
      },
      {
        userId: dita.id,
        type: "CAMPAIGN_NEW_NEARBY",
        title: "Campaign baru di Malang",
        body: "Rooftop Coffee Session — Kopi Senja Malang membuka 8 slot.",
        link: "/creator/campaigns",
        createdAt: daysFromNow(-10),
      },
      {
        userId: yoga.id,
        type: "SUBMISSION_REJECTED",
        title: "Submission ditolak",
        body: "Vendor menolak konten kamu. Kamu bisa mengajukan banding.",
        link: "/creator/submissions",
        createdAt: daysFromNow(-4),
      },
      {
        userId: admin.id,
        type: "DISPUTE_UPDATE",
        title: "Sengketa baru menunggu",
        body: "Creator Yoga Prasetya mengajukan banding atas penolakan vendor.",
        link: "/admin/disputes",
        createdAt: daysFromNow(-3),
      },
      {
        userId: vendorBaru.id,
        type: "GENERAL",
        title: "Verifikasi sedang diproses",
        body: "Tim kami akan menghubungi nomor PIC dalam 1x24 jam.",
        createdAt: daysFromNow(-1),
      },
    ],
  });

  await db.auditLog.createMany({
    data: [
      {
        actorId: admin.id,
        action: "vendor.verify",
        entity: "VendorProfile",
        entityId: vendorKopi.id,
        metadata: { catatan: "Dikonfirmasi via telepon." },
        createdAt: daysFromNow(-30),
      },
      {
        actorId: admin.id,
        action: "campaign.approve",
        entity: "Campaign",
        entityId: campaignAktif.id,
        createdAt: daysFromNow(-12),
      },
      {
        actorId: vendorKopi.id,
        action: "submission.reject",
        entity: "Submission",
        entityId: submissionSengketa.id,
        metadata: { alasan: "Menu signature tidak ditampilkan." },
        createdAt: daysFromNow(-4),
      },
    ],
  });

  console.log("\nSeed selesai. Akun demo (password: %s)", PASSWORD);
  console.table([
    { role: "ADMIN", email: admin.email },
    { role: "VENDOR (verified)", email: vendorKopi.email },
    { role: "VENDOR (verified)", email: vendorAirTerjun.email },
    { role: "VENDOR (verified)", email: vendorKafe.email },
    { role: "VENDOR (verified)", email: vendorPantai.email },
    { role: "VENDOR (verified)", email: vendorDanau.email },
    { role: "VENDOR (verified)", email: vendorPanggung.email },
    { role: "VENDOR (pending)", email: vendorBaru.email },
    ...creators.map((c) => ({ role: "CREATOR", email: c.email })),
  ]);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
