import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { calculatePayouts } from "../src/domain/payout";
import { calculateCreatorEarning, calculateWithdrawalFee } from "../src/domain/withdrawal";

// Gunakan koneksi langsung (DIRECT_URL) jika ada untuk sesi seed yang stabil
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
  console.log("🧹 Menghapus data lama...");
  // Urutan penghapusan: child tables terlebih dahulu sebelum parent tables
  await db.auditLog.deleteMany();
  await db.notification.deleteMany();
  await db.withdrawal.deleteMany();
  await db.payout.deleteMany();
  await db.escrowTransaction.deleteMany();
  await db.viewSnapshot.deleteMany();
  await db.submission.deleteMany();
  await db.campaignParticipation.deleteMany();
  await db.campaign.deleteMany();
  await db.briefTemplate.deleteMany();
  await db.socialAccount.deleteMany();
  await db.creatorProfile.deleteMany();
  await db.vendorProfile.deleteMany();
  await db.user.deleteMany();

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  // ================================================================
  // 1. ADMIN
  // ================================================================
  console.log("👤 Membuat Admin...");
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

  // ================================================================
  // 2. TEMPLATE BRIEF
  // ================================================================
  console.log("📋 Membuat Template Brief...");
  const kulinerTemplate = await db.briefTemplate.create({
    data: {
      category: "KULINER",
      name: "Template Kuliner — Food & Place Review",
      fields: {
        angleSaran: [
          "First impression suasana tempat dan keramahan staf",
          "Close-up tekstur makanan saat disajikan hangat",
          "Review jujur rasa menu andalan serta porsinya",
        ],
        wajibTampil: ["Nama tempat & lokasi", "Menu signature", "Suasana ruangan"],
        larangan: ["Membandingkan langsung dengan kompetitor", "Konten berbau SARA"],
        durasiMinimalDetik: 20,
      },
    },
  });

  const wisataTemplate = await db.briefTemplate.create({
    data: {
      category: "WISATA_ALAM",
      name: "Template Wisata — Destination & Experience",
      fields: {
        angleSaran: [
          "Establishing drone shot / pemandangan lanskap utama",
          "Rute akses jalan dan tips perlengkapan trekking",
          "Fasilitas lengkap: tiket, toilet, spot foto, warung",
        ],
        wajibTampil: ["Nama destinasi", "Spot foto utama", "Harga tiket masuk"],
        larangan: ["Aksi berbahaya / melanggar batas keselamatan", "Membuang sampah sembarangan"],
        durasiMinimalDetik: 30,
      },
    },
  });

  // ================================================================
  // 3. VENDORS (Bisnis Nyata Indonesia)
  // ================================================================
  console.log("🏢 Membuat Vendor Realistis...");

  // Vendor 1: Bakso Malang Enggal Rawamangun (Jakarta)
  const vendorEnggal = await db.user.create({
    data: {
      role: "VENDOR",
      email: "vendor@baksoenggal.id",
      name: "H. Enggal Subagyo",
      phone: "081234567801",
      passwordHash,
      status: "VERIFIED",
      vendorProfile: {
        create: {
          businessName: "Bakso Malang Enggal Rawamangun",
          category: "KULINER",
          description:
            "Bakso Malang otentik khas Jawa Timur di Rawamangun. Menyajikan aneka bakso halus, bakso urat, siomay kukus, dan pangsit goreng renyah.",
          address: "Jl. Balai Pustaka Timur No. 39, Rawamangun, Pulo Gadung",
          city: "Jakarta",
          province: "DKI Jakarta",
          latitude: -6.1953,
          longitude: 106.8854,
          mapsUrl: "https://maps.google.com/?q=Bakso+Malang+Enggal+Rawamangun",
          photos: ["/demo/bakso-enggal-1.jpg"],
          picName: "H. Enggal Subagyo",
          picPhone: "081234567801",
          verifiedAt: daysFromNow(-30),
          verifiedById: admin.id,
          verificationNote: "Lokasi fisik dan profil Google Maps terverifikasi.",
        },
      },
    },
  });

  // Vendor 2: Kopi Toko Djawa Menteng (Jakarta)
  const vendorDjawa = await db.user.create({
    data: {
      role: "VENDOR",
      email: "vendor@tokodjawa.id",
      name: "Rian Kurniawan",
      phone: "081234567802",
      passwordHash,
      status: "VERIFIED",
      vendorProfile: {
        create: {
          businessName: "Kopi Toko Djawa Menteng",
          category: "KULINER",
          description:
            "Kedai kopi berkonsep vintage nostalgia Indonesia. Terkenal dengan Es Kopi Awan, seduhan manual brew, dan aneka pastry artisanal.",
          address: "Jl. Johar No. 1A, Kebon Sirih, Menteng",
          city: "Jakarta",
          province: "DKI Jakarta",
          latitude: -6.1873,
          longitude: 106.8322,
          mapsUrl: "https://maps.google.com/?q=Kopi+Toko+Djawa+Menteng",
          photos: ["/demo/toko-djawa-1.jpg"],
          picName: "Rian Kurniawan",
          picPhone: "081234567802",
          verifiedAt: daysFromNow(-25),
          verifiedById: admin.id,
          verificationNote: "Terverifikasi via telepon dan foto outlet aktif.",
        },
      },
    },
  });

  // Vendor 3: Petak Enam di Gedung Chandra (Jakarta Glodok)
  const vendorPetakEnam = await db.user.create({
    data: {
      role: "VENDOR",
      email: "vendor@petakenam.id",
      name: "Linda Wijaya",
      phone: "081234567803",
      passwordHash,
      status: "VERIFIED",
      vendorProfile: {
        create: {
          businessName: "Petak Enam di Gedung Chandra",
          category: "KULINER",
          description:
            "Pusat kuliner heritage dan wisata budaya di Glodok Pecinan Jakarta Barat. Menghadirkan ragam kuliner legendaris dan tenant kontemporer.",
          address: "Jl. Pancoran No. 43, Glodok, Taman Sari",
          city: "Jakarta",
          province: "DKI Jakarta",
          latitude: -6.1422,
          longitude: 106.8142,
          mapsUrl: "https://maps.google.com/?q=Petak+Enam+Glodok",
          photos: ["/demo/petak-enam-1.jpg"],
          picName: "Linda Wijaya",
          picPhone: "081234567803",
          verifiedAt: daysFromNow(-20),
          verifiedById: admin.id,
          verificationNote: "Sentra kuliner terdaftar resmi di kawasan pecinan Jakarta.",
        },
      },
    },
  });

  // Vendor 4: Wisata Coban Rondo Malang
  const vendorCobanRondo = await db.user.create({
    data: {
      role: "VENDOR",
      email: "vendor@cobanrondo.id",
      name: "Bambang Sutejo",
      phone: "081234567804",
      passwordHash,
      status: "VERIFIED",
      vendorProfile: {
        create: {
          businessName: "Wisata Alam Coban Rondo & Taman Labirin",
          category: "WISATA_ALAM",
          description:
            "Air terjun alami megah setinggi 84 meter di lereng Gunung Panderman dengan udara sejuk pegunungan dan atraksi taman labirin legendaris.",
          address: "Jl. Coban Rondo, Pandesari, Pujon",
          city: "Malang",
          province: "Jawa Timur",
          latitude: -7.8837,
          longitude: 112.4776,
          mapsUrl: "https://maps.google.com/?q=Coban+Rondo+Malang",
          photos: ["/demo/coban-rondo-1.jpg"],
          picName: "Bambang Sutejo",
          picPhone: "081234567804",
          verifiedAt: daysFromNow(-15),
          verifiedById: admin.id,
          verificationNote: "Pengelola destinasi wisata Perhutani Malang.",
        },
      },
    },
  });

  // Vendor 5: Sego Sambel Marem Malang (Status: PENDING — agar ada contoh antrean verifikasi admin)
  const vendorSegoSambel = await db.user.create({
    data: {
      role: "VENDOR",
      email: "vendor@segosambelmarem.id",
      name: "Ibu Siti Mariyam",
      phone: "081234567805",
      passwordHash,
      status: "PENDING",
      vendorProfile: {
        create: {
          businessName: "Warung Sego Sambel Marem Malang",
          category: "KULINER",
          description:
            "Kuliner pedas malam favorit mahasiswa dan warga Malang. Sambal uleg fresh dengan pilihan iwak pe, ayam krispi, dan jeroan gurih.",
          address: "Jl. Soekarno Hatta No. 18, Lowokwaru",
          city: "Malang",
          province: "Jawa Timur",
          latitude: -7.9421,
          longitude: 112.6178,
          mapsUrl: "https://maps.google.com/?q=Sego+Sambel+Marem+Malang",
          photos: ["/demo/sego-sambel-1.jpg"],
          picName: "Ibu Siti Mariyam",
          picPhone: "081234567805",
        },
      },
    },
  });

  // ================================================================
  // 4. CREATORS (Handle & Platform Cocok dengan Video Nyata)
  // ================================================================
  console.log("🎨 Membuat Akun Creator Realistis...");

  // Creator 1: Siti Bungbung (TikTok @sibungbung - Food Vlogger 5.4M followers)
  const creatorSibungbung = await db.user.create({
    data: {
      role: "CREATOR",
      email: "sibungbung@creator.id",
      name: "Siti Rahmawati (Sibungbung)",
      phone: "081288990001",
      passwordHash,
      status: "VERIFIED",
      creatorProfile: {
        create: {
          city: "Jakarta",
          province: "DKI Jakarta",
          trustScore: 96,
          bio: "Food reviewer & kulineran viral nusantara. Review jujur, bikin ngiler!",
          bankName: "BCA",
          bankAccountNumber: "8219482910",
          bankAccountName: "SITI RAHMAWATI",
        },
      },
      socialAccounts: {
        create: {
          platform: "TIKTOK",
          handle: "sibungbung",
          profileUrl: "https://www.tiktok.com/@sibungbung",
          followerCount: 5_400_000,
          verifiedAt: daysFromNow(-30),
        },
      },
    },
  });

  // Creator 2: Aunty Feni (YouTube @auntyfeni - Reviewer Kuliner Bakso & Mie)
  const creatorAuntyFeni = await db.user.create({
    data: {
      role: "CREATOR",
      email: "auntyfeni@creator.id",
      name: "Feni Wijaya (Aunty Feni)",
      phone: "081288990002",
      passwordHash,
      status: "VERIFIED",
      creatorProfile: {
        create: {
          city: "Jakarta",
          province: "DKI Jakarta",
          trustScore: 84,
          bio: "Pecinta bakso kuah gurih, mie ayam gerobak, dan kuliner otentik Jakarta.",
          bankName: "BCA",
          bankAccountNumber: "7120984561",
          bankAccountName: "FENI WIJAYA",
        },
      },
      socialAccounts: {
        create: {
          platform: "YOUTUBE",
          handle: "auntyfeni",
          profileUrl: "https://www.youtube.com/@auntyfeni",
          followerCount: 15_800,
          verifiedAt: daysFromNow(-25),
        },
      },
    },
  });

  // Creator 3: Byan Hardi (YouTube @byanhardTV - Kafe & Coffee Reviewer)
  const creatorByan = await db.user.create({
    data: {
      role: "CREATOR",
      email: "byanhard@creator.id",
      name: "Byan Hardi (byanhard TV)",
      phone: "081288990003",
      passwordHash,
      status: "VERIFIED",
      creatorProfile: {
        create: {
          city: "Jakarta",
          province: "DKI Jakarta",
          trustScore: 88,
          bio: "Review tempat ngopi nyaman, makanan aman, dan suasana WFK Jakarta.",
          bankName: "Mandiri",
          bankAccountNumber: "1400019283741",
          bankAccountName: "BYAN HARDI",
        },
      },
      socialAccounts: {
        create: {
          platform: "YOUTUBE",
          handle: "byanhardTV",
          profileUrl: "https://www.youtube.com/@byanhardTV",
          followerCount: 45_200,
          verifiedAt: daysFromNow(-28),
        },
      },
    },
  });

  // Creator 4: Petak Enam Explorer (Instagram @petakenam - Wisata Kuliner Glodok)
  const creatorPetakEnam = await db.user.create({
    data: {
      role: "CREATOR",
      email: "petakenam@creator.id",
      name: "Dita Ayu (Petak Enam Diary)",
      phone: "081288990004",
      passwordHash,
      status: "VERIFIED",
      creatorProfile: {
        create: {
          city: "Jakarta",
          province: "DKI Jakarta",
          trustScore: 85,
          bio: "Eksplorasi spot kuliner halal & legendaris Petak Enam Glodok Jakarta.",
          bankName: "BNI",
          bankAccountNumber: "0987654321",
          bankAccountName: "DITA AYU",
        },
      },
      socialAccounts: {
        create: {
          platform: "INSTAGRAM",
          handle: "petakenam",
          profileUrl: "https://www.instagram.com/petakenam",
          followerCount: 34_500,
          verifiedAt: daysFromNow(-20),
        },
      },
    },
  });

  // Creator 5: Raka Rekurae (YouTube @Rekurae - Kuliner Legendaris Jakarta)
  const creatorRekurae = await db.user.create({
    data: {
      role: "CREATOR",
      email: "rekurae@creator.id",
      name: "Raka Pradana (Rekurae)",
      phone: "081288990005",
      passwordHash,
      status: "VERIFIED",
      creatorProfile: {
        create: {
          city: "Jakarta",
          province: "DKI Jakarta",
          trustScore: 82,
          bio: "Berburu kuliner legendaris murah dan enak di pelosok pasar Jakarta.",
          bankName: "BCA",
          bankAccountNumber: "5410982341",
          bankAccountName: "RAKA PRADANA",
        },
      },
      socialAccounts: {
        create: {
          platform: "YOUTUBE",
          handle: "Rekurae",
          profileUrl: "https://www.youtube.com/@Rekurae",
          followerCount: 28_400,
          verifiedAt: daysFromNow(-18),
        },
      },
    },
  });

  // Creator 6: Yuanda Pratama (YouTube @YuandaTVChannel - Kuliner Malang)
  const creatorYuanda = await db.user.create({
    data: {
      role: "CREATOR",
      email: "yuanda@creator.id",
      name: "Yuanda Pratama (Yuanda TV)",
      phone: "081288990006",
      passwordHash,
      status: "VERIFIED",
      creatorProfile: {
        create: {
          city: "Malang",
          province: "Jawa Timur",
          trustScore: 78,
          bio: "Food vlogger Malang. Berburu kuliner pedas malam dan hidden gems mahasiswa.",
          bankName: "BRI",
          bankAccountNumber: "334501029384501",
          bankAccountName: "YUANDA PRATAMA",
        },
      },
      socialAccounts: {
        create: {
          platform: "YOUTUBE",
          handle: "YuandaTVChannel",
          profileUrl: "https://www.youtube.com/@YuandaTVChannel",
          followerCount: 12_600,
          verifiedAt: daysFromNow(-15),
        },
      },
    },
  });

  // ================================================================
  // 5. CAMPAIGN 1: AKTIF (Bakso Malang Enggal Rawamangun)
  // ================================================================
  console.log("🚀 Membuat Campaign Aktif: Bakso Malang Enggal...");
  const campaignBakso = await db.campaign.create({
    data: {
      vendorId: vendorEnggal.id,
      title: "Review Kenikmatan Bakso Malang Enggal Rawamangun",
      category: "KULINER",
      description:
        "Kami mencari food creator untuk meliput suasana makan siang dan aneka pilihan bakso kuah serta siomay goreng renyah khas Malang.",
      templateId: kulinerTemplate.id,
      briefAngle:
        "Tunjukkan variasi menu prasmanan bakso saat diambil, tuangan kuah kaldu sapi gurih, dan gigitan renyah pangsit goreng.",
      briefMustShow: [
        "Plang nama 'Bakso Malang Enggal Rawamangun'",
        "Pilihan bakso urat dan siomay goreng",
        "Kuah kaldu sapi hangat mengepul",
      ],
      briefProhibited: [
        "Membandingkan dengan warung bakso lain",
        "Konten diambil di luar jam buka resmi",
      ],
      minDurationSec: 20,
      allowedPlatforms: ["YOUTUBE", "TIKTOK", "INSTAGRAM"],
      budgetPool: 3_000_000,
      cpmRate: 15_000,
      platformFeeRate: 3,
      minWithdrawalAmount: 15_000, // Syarat minimum views/earning sebelum tarik dana dini
      complimentType: "Gratis 1 mangkok bakso campur spesial + Es Jeruk",
      complimentValue: 50_000,
      complimentTerms: "Berlaku untuk 1 orang saat syuting konten, tunjukkan profil kreator.",
      startDate: daysFromNow(-10),
      endDate: daysFromNow(20),
      trackingEndsAt: daysFromNow(27),
      status: "ACTIVE",
      submittedAt: daysFromNow(-12),
      approvedAt: daysFromNow(-10),
      approvedById: admin.id,
      escrow: {
        create: {
          type: "DEPOSIT",
          amount: 3_000_000,
          status: "COMPLETED",
          reference: "ESCROW-ENGGAL-001",
          note: "Deposit pool campaign Bakso Malang Enggal.",
          completedAt: daysFromNow(-10),
        },
      },
    },
  });

  // Submissions untuk Campaign Bakso:
  // --- Video 1: Aunty Feni (YouTube Shorts - REAL: https://www.youtube.com/shorts/lf4U3T3TqPQ)
  const partFeni = await db.campaignParticipation.create({
    data: {
      campaignId: campaignBakso.id,
      creatorId: creatorAuntyFeni.id,
      status: "COMPLETED",
      joinedAt: daysFromNow(-9),
    },
  });

  const subFeni = await db.submission.create({
    data: {
      campaignId: campaignBakso.id,
      creatorId: creatorAuntyFeni.id,
      participationId: partFeni.id,
      contentUrl: "https://www.youtube.com/shorts/lf4U3T3TqPQ",
      platform: "YOUTUBE",
      caption: "BAKSO MALANG ENGGAL RAWAMANGUN #kuliner #makanenak #wisatakuliner #jakarta #fyp",
      status: "APPROVED",
      lastViews: 1_547,
      lastLikes: 42,
      lastComments: 8,
      lastSyncedAt: daysFromNow(-1),
      submittedAt: daysFromNow(-7),
      reviewedById: vendorEnggal.id,
      reviewedAt: daysFromNow(-6),
      reviewNote: "Video review sangat menarik, kuah dan bakso tampak sangat menggugah selera!",
    },
  });

  // Snapshot views berkala
  for (let day = 5; day >= 0; day -= 1) {
    const factor = 1 - day * 0.16;
    await db.viewSnapshot.create({
      data: {
        submissionId: subFeni.id,
        views: Math.max(100, Math.round(1_547 * factor)),
        likes: Math.round(42 * factor),
        comments: Math.round(8 * factor),
        source: "API",
        capturedAt: daysFromNow(-day),
      },
    });
  }

  // Early withdrawal demo: Aunty Feni meminta penarikan dana dini untuk videonya
  const earningFeni = calculateCreatorEarning(1_547, {
    cpmRate: campaignBakso.cpmRate,
    platformFeeRate: campaignBakso.platformFeeRate,
  });
  const feeFeni = calculateWithdrawalFee(earningFeni.grossAmount);

  await db.withdrawal.create({
    data: {
      creatorId: creatorAuntyFeni.id,
      campaignId: campaignBakso.id,
      submissionId: subFeni.id,
      viewsCounted: earningFeni.viewsCounted,
      grossAmount: earningFeni.grossAmount,
      feeAmount: feeFeni.feeAmount,
      netAmount: feeFeni.netAmount,
      status: "PENDING_ADMIN_APPROVAL",
      bankName: "BCA",
      bankAccountNumber: "7120984561",
      bankAccountName: "FENI WIJAYA",
      requestedAt: daysFromNow(-1),
    },
  });

  // --- Video 2: Siti Bungbung (TikTok - REAL: https://www.tiktok.com/@sibungbung/video/7686608385516539157)
  const partSibungbung = await db.campaignParticipation.create({
    data: {
      campaignId: campaignBakso.id,
      creatorId: creatorSibungbung.id,
      status: "COMPLETED",
      joinedAt: daysFromNow(-8),
    },
  });

  const subSibungbung = await db.submission.create({
    data: {
      campaignId: campaignBakso.id,
      creatorId: creatorSibungbung.id,
      participationId: partSibungbung.id,
      contentUrl: "https://www.tiktok.com/@sibungbung/video/7686608385516539157",
      platform: "TIKTOK",
      caption: "Menu simple yg comforting.. rasanya pedes, manis gurih #mukbang #kulinerviral #sibungbung",
      status: "APPROVED",
      lastViews: 18_961,
      lastLikes: 1_124,
      lastComments: 20,
      lastSyncedAt: daysFromNow(-1),
      submittedAt: daysFromNow(-6),
      reviewedById: vendorEnggal.id,
      reviewedAt: daysFromNow(-5),
      reviewNote: "Angle estetik dan reach sangat tinggi. Mantap!",
    },
  });

  for (let day = 5; day >= 0; day -= 1) {
    const factor = 1 - day * 0.15;
    await db.viewSnapshot.create({
      data: {
        submissionId: subSibungbung.id,
        views: Math.max(500, Math.round(18_961 * factor)),
        likes: Math.round(1_124 * factor),
        comments: Math.round(20 * factor),
        source: "API",
        capturedAt: daysFromNow(-day),
      },
    });
  }

  // --- Video 3: Yuanda Malang (YouTube Shorts - REAL: https://www.youtube.com/shorts/ngvQkHL-um4)
  // Status PENDING_REVIEW agar vendor memiliki submission yang bisa di-review
  const partYuanda = await db.campaignParticipation.create({
    data: {
      campaignId: campaignBakso.id,
      creatorId: creatorYuanda.id,
      status: "SUBMITTED",
      joinedAt: daysFromNow(-3),
    },
  });

  await db.submission.create({
    data: {
      campaignId: campaignBakso.id,
      creatorId: creatorYuanda.id,
      participationId: partYuanda.id,
      contentUrl: "https://www.youtube.com/shorts/ngvQkHL-um4",
      platform: "YOUTUBE",
      caption: "Kuliner Malang Viral #shorts #kuliner #kulinermalang #segosambel #fyp",
      status: "PENDING_REVIEW",
      lastViews: 1_202,
      lastLikes: 35,
      lastComments: 4,
      lastSyncedAt: daysFromNow(-1),
      submittedAt: daysFromNow(-2),
    },
  });

  // ================================================================
  // 6. CAMPAIGN 2: AKTIF (Kopi Toko Djawa Menteng)
  // ================================================================
  console.log("☕ Membuat Campaign Aktif: Kopi Toko Djawa...");
  const campaignDjawa = await db.campaign.create({
    data: {
      vendorId: vendorDjawa.id,
      title: "Nostalgia Secangkir Es Kopi Awan di Kopi Toko Djawa",
      category: "KULINER",
      description:
        "Mencari 5 video creator Jakarta untuk mereview ambience kedai bergaya vintage dan sensasi busa creamy Es Kopi Awan.",
      templateId: kulinerTemplate.id,
      briefAngle:
        "Eksplorasi sudut ruangan vintage, suasana santai sore hari, dan rasa signature Es Kopi Awan.",
      briefMustShow: [
        "Nama 'Kopi Toko Djawa Menteng'",
        "Menu Es Kopi Awan",
        "Koleksi buku/piringan hitam vintage",
      ],
      briefProhibited: ["Merekam pengunjung lain tanpa izin"],
      minDurationSec: 15,
      allowedPlatforms: ["YOUTUBE", "INSTAGRAM", "TIKTOK"],
      budgetPool: 2_500_000,
      cpmRate: 18_000,
      platformFeeRate: 3,
      minWithdrawalAmount: 20_000,
      complimentType: "Gratis 1 Es Kopi Awan + 1 Slice Cendol Cake",
      complimentValue: 65_000,
      complimentTerms: "Tunjukkan kode booking creator ke barista saat kedatangan.",
      startDate: daysFromNow(-6),
      endDate: daysFromNow(24),
      trackingEndsAt: daysFromNow(31),
      status: "ACTIVE",
      submittedAt: daysFromNow(-8),
      approvedAt: daysFromNow(-6),
      approvedById: admin.id,
      escrow: {
        create: {
          type: "DEPOSIT",
          amount: 2_500_000,
          status: "COMPLETED",
          reference: "ESCROW-DJAWA-001",
          note: "Deposit pool Kopi Toko Djawa.",
          completedAt: daysFromNow(-6),
        },
      },
    },
  });

  // Byan Hardi submit YouTube Shorts (REAL: https://www.youtube.com/shorts/CqmGN1cb_8U)
  const partByan = await db.campaignParticipation.create({
    data: {
      campaignId: campaignDjawa.id,
      creatorId: creatorByan.id,
      status: "COMPLETED",
      joinedAt: daysFromNow(-5),
    },
  });

  const subByan = await db.submission.create({
    data: {
      campaignId: campaignDjawa.id,
      creatorId: creatorByan.id,
      participationId: partByan.id,
      contentUrl: "https://www.youtube.com/shorts/CqmGN1cb_8U",
      platform: "YOUTUBE",
      caption: "Cafe nyaman, makanan Aman! Ngopi sore di Menteng #shorts #coffeeshop #jakarta",
      status: "APPROVED",
      lastViews: 1_253,
      lastLikes: 48,
      lastComments: 6,
      lastSyncedAt: daysFromNow(-1),
      submittedAt: daysFromNow(-4),
      reviewedById: vendorDjawa.id,
      reviewedAt: daysFromNow(-3),
      reviewNote: "Tone video sangat cocok dengan branding vintage kami!",
    },
  });

  for (let day = 3; day >= 0; day -= 1) {
    const factor = 1 - day * 0.2;
    await db.viewSnapshot.create({
      data: {
        submissionId: subByan.id,
        views: Math.max(150, Math.round(1_253 * factor)),
        likes: Math.round(48 * factor),
        comments: Math.round(6 * factor),
        source: "API",
        capturedAt: daysFromNow(-day),
      },
    });
  }

  // ================================================================
  // 7. CAMPAIGN 3: AKTIF (Petak Enam Glodok)
  // ================================================================
  console.log("🏮 Membuat Campaign Aktif: Petak Enam Glodok...");
  const campaignPetakEnam = await db.campaign.create({
    data: {
      vendorId: vendorPetakEnam.id,
      title: "Jelajah Kuliner & Heritage Petak Enam Glodok",
      category: "KULINER",
      description:
        "Promo wisata kuliner pecinan Glodok Jakarta. Tunjukkan keberagaman kuliner halal dan suasana bangunan tempo doeloe yang estetik.",
      templateId: kulinerTemplate.id,
      briefAngle:
        "Walking tour dari gerbang utama masuk ke area lantai 1 & 2, lalu cicip 2 kuliner khas.",
      briefMustShow: [
        "Gapura Petak Enam di Gedung Chandra",
        "Area duduk komunal lantai 2",
        "Minimal 1 tenant kuliner halal",
      ],
      briefProhibited: ["Informasi keliru mengenai kehalalan tenant makanan"],
      minDurationSec: 30,
      allowedPlatforms: ["INSTAGRAM", "YOUTUBE", "TIKTOK"],
      budgetPool: 4_000_000,
      cpmRate: 20_000,
      platformFeeRate: 3,
      minWithdrawalAmount: 25_000,
      complimentType: "Voucher makan senilai Rp 100.000 untuk tenant pilihan",
      complimentValue: 100_000,
      complimentTerms: "Dapat ditukarkan di kantor informasi Petak Enam.",
      startDate: daysFromNow(-8),
      endDate: daysFromNow(22),
      trackingEndsAt: daysFromNow(29),
      status: "ACTIVE",
      submittedAt: daysFromNow(-10),
      approvedAt: daysFromNow(-8),
      approvedById: admin.id,
      escrow: {
        create: {
          type: "DEPOSIT",
          amount: 4_000_000,
          status: "COMPLETED",
          reference: "ESCROW-PETAK-001",
          note: "Deposit pool campaign Petak Enam Glodok.",
          completedAt: daysFromNow(-8),
        },
      },
    },
  });

  // Creator Petak Enam Instagram Reel (REAL: https://www.instagram.com/petakenam/reel/C0xvXxEBneT/)
  const partPetak = await db.campaignParticipation.create({
    data: {
      campaignId: campaignPetakEnam.id,
      creatorId: creatorPetakEnam.id,
      status: "COMPLETED",
      joinedAt: daysFromNow(-7),
    },
  });

  const subPetak = await db.submission.create({
    data: {
      campaignId: campaignPetakEnam.id,
      creatorId: creatorPetakEnam.id,
      participationId: partPetak.id,
      contentUrl: "https://www.instagram.com/petakenam/reel/C0xvXxEBneT/",
      platform: "INSTAGRAM",
      caption: "Wisata kuliner legendaris di Petak Enam Glodok Jakarta Barat! Banyak spot seru & makanan enak #petakenam #kulinerjakarta #reels",
      status: "APPROVED",
      lastViews: 15_200,
      lastLikes: 840,
      lastComments: 32,
      lastSyncedAt: daysFromNow(-1),
      submittedAt: daysFromNow(-5),
      reviewedById: vendorPetakEnam.id,
      reviewedAt: daysFromNow(-4),
      reviewNote: "Konten informatif dan visualisasi tenant sangat lengkap.",
    },
  });

  for (let day = 4; day >= 0; day -= 1) {
    const factor = 1 - day * 0.18;
    await db.viewSnapshot.create({
      data: {
        submissionId: subPetak.id,
        views: Math.max(300, Math.round(15_200 * factor)),
        likes: Math.round(840 * factor),
        comments: Math.round(32 * factor),
        source: "API",
        capturedAt: daysFromNow(-day),
      },
    });
  }

  // Raka Rekurae YouTube Shorts (REAL: https://www.youtube.com/shorts/q9oBcCf980Y)
  const partRekurae = await db.campaignParticipation.create({
    data: {
      campaignId: campaignPetakEnam.id,
      creatorId: creatorRekurae.id,
      status: "COMPLETED",
      joinedAt: daysFromNow(-6),
    },
  });

  const subRekurae = await db.submission.create({
    data: {
      campaignId: campaignPetakEnam.id,
      creatorId: creatorRekurae.id,
      participationId: partRekurae.id,
      contentUrl: "https://www.youtube.com/shorts/q9oBcCf980Y",
      platform: "YOUTUBE",
      caption: "MURAH & ENAK! 3 Kuliner Legendaris Pasar Teluk Gong Jakarta #kuliner #streetfood #jakarta",
      status: "APPROVED",
      lastViews: 3_775,
      lastLikes: 110,
      lastComments: 14,
      lastSyncedAt: daysFromNow(-1),
      submittedAt: daysFromNow(-4),
      reviewedById: vendorPetakEnam.id,
      reviewedAt: daysFromNow(-3),
      reviewNote: "Eksplorasi kuliner yang sangat detail dan autentik.",
    },
  });

  for (let day = 3; day >= 0; day -= 1) {
    const factor = 1 - day * 0.2;
    await db.viewSnapshot.create({
      data: {
        submissionId: subRekurae.id,
        views: Math.max(200, Math.round(3_775 * factor)),
        likes: Math.round(110 * factor),
        comments: Math.round(14 * factor),
        source: "API",
        capturedAt: daysFromNow(-day),
      },
    });
  }

  // ================================================================
  // 8. CAMPAIGN 4: PENDING REVIEW (Wisata Coban Rondo Malang)
  // ================================================================
  console.log("🌲 Membuat Campaign Menunggu Approval Admin: Coban Rondo...");
  await db.campaign.create({
    data: {
      vendorId: vendorCobanRondo.id,
      title: "Sensasi Kesegaran Wisata Air Terjun & Labirin Coban Rondo",
      category: "WISATA_ALAM",
      description:
        "Membutuhkan 4 travel creator Malang / Jawa Timur untuk membuat video dokumentasi rute trekking santai, panorama air terjun, dan keseruan wahana labirin.",
      templateId: wisataTemplate.id,
      briefAngle:
        "Pemandangan gemuruh air terjun 84 meter, udara sejuk pinus, dan keseruan memecahkan rute labirin.",
      briefMustShow: [
        "Spot utama Coban Rondo",
        "Wahana Taman Labirin",
        "Info tiket masuk Rp 35.000",
      ],
      briefProhibited: [
        "Melewati pagar pembatas air terjun",
        "Meninggalkan sampah plastik",
      ],
      minDurationSec: 30,
      allowedPlatforms: ["TIKTOK", "INSTAGRAM", "YOUTUBE"],
      budgetPool: 2_000_000,
      cpmRate: 14_000,
      platformFeeRate: 3,
      minWithdrawalAmount: 20_000,
      complimentType: "Tiket masuk + akses wahana labirin gratis (2 pax)",
      complimentValue: 70_000,
      complimentTerms: "Berlaku di hari kerja (Senin - Jumat), konfirmasi H-1.",
      startDate: daysFromNow(3),
      endDate: daysFromNow(33),
      trackingEndsAt: daysFromNow(40),
      status: "PENDING_REVIEW",
      submittedAt: daysFromNow(-1),
      escrow: {
        create: {
          type: "DEPOSIT",
          amount: 2_000_000,
          status: "PENDING",
          note: "Menunggu approval admin dan verifikasi transfer pool.",
        },
      },
    },
  });

  // ================================================================
  // 9. CAMPAIGN 5: SELESAI & SETTLED (Grand Opening Toko Djawa)
  // ================================================================
  console.log("💰 Membuat Campaign Selesai (Settled) dengan Data Payout...");
  const campaignSelesai = await db.campaign.create({
    data: {
      vendorId: vendorDjawa.id,
      title: "Grand Opening Kopi Toko Djawa Menteng — Batch Perdana",
      category: "KULINER",
      description: "Campaign peluncuran cabang Menteng, periode selesai dan seluruh payout telah cair.",
      briefAngle: "Liputan suasana opening, diskon 50%, dan antrean pengunjung antusias.",
      briefMustShow: ["Logo Toko Djawa", "Promo Opening"],
      briefProhibited: [],
      minDurationSec: 15,
      allowedPlatforms: ["TIKTOK", "YOUTUBE"],
      budgetPool: 1_500_000,
      cpmRate: 15_000,
      platformFeeRate: 3,
      startDate: daysFromNow(-45),
      endDate: daysFromNow(-15),
      trackingEndsAt: daysFromNow(-8),
      status: "SETTLED",
      submittedAt: daysFromNow(-50),
      approvedAt: daysFromNow(-48),
      approvedById: admin.id,
      settledAt: daysFromNow(-7),
      escrow: {
        create: {
          type: "DEPOSIT",
          amount: 1_500_000,
          status: "COMPLETED",
          reference: "ESCROW-DJAWA-BATCH0",
          completedAt: daysFromNow(-48),
        },
      },
    },
  });

  const riwayatPeserta = [
    {
      creator: creatorSibungbung,
      views: 52_400,
      url: "https://www.tiktok.com/@sibungbung/video/7686223056871705876",
      platform: "TIKTOK" as const,
      caption: "Bikin Rujak Es Semangka , potong semangkanya pakai hack #kulinerviral #sibungbung",
    },
    {
      creator: creatorByan,
      views: 31_200,
      url: "https://www.youtube.com/shorts/CqmGN1cb_8U",
      platform: "YOUTUBE" as const,
      caption: "Nongkrong asik di Toko Djawa Menteng #shorts #jakarta",
    },
    {
      creator: creatorAuntyFeni,
      views: 16_400,
      url: "https://www.youtube.com/shorts/lf4U3T3TqPQ",
      platform: "YOUTUBE" as const,
      caption: "Ngopi dan pastry lezat di Menteng #shorts",
    },
  ];

  const entriesLama = [];
  for (const item of riwayatPeserta) {
    const part = await db.campaignParticipation.create({
      data: {
        campaignId: campaignSelesai.id,
        creatorId: item.creator.id,
        status: "COMPLETED",
        joinedAt: daysFromNow(-44),
      },
    });

    const sub = await db.submission.create({
      data: {
        campaignId: campaignSelesai.id,
        creatorId: item.creator.id,
        participationId: part.id,
        contentUrl: item.url,
        platform: item.platform,
        caption: item.caption,
        status: "APPROVED",
        lastViews: item.views,
        finalViews: item.views,
        lastLikes: Math.round(item.views * 0.08),
        lastComments: Math.round(item.views * 0.01),
        lastSyncedAt: daysFromNow(-8),
        submittedAt: daysFromNow(-30),
        reviewedById: vendorDjawa.id,
        reviewedAt: daysFromNow(-29),
        reviewNote: "Sangat baik, memenuhi seluruh ketentuan brief.",
      },
    });

    entriesLama.push({
      creatorId: item.creator.id,
      submissionId: sub.id,
      views: item.views,
    });
  }

  // Hitung payout otomatis menggunakan fungsi domain
  const kalkulasiPayout = calculatePayouts(entriesLama, {
    budgetPool: campaignSelesai.budgetPool,
    cpmRate: campaignSelesai.cpmRate,
    platformFeeRate: campaignSelesai.platformFeeRate,
  });

  for (const line of kalkulasiPayout.lines) {
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
        paidAt: daysFromNow(-7),
        note: "Settlement otomatis campaign selesai.",
      },
    });
  }

  await db.escrowTransaction.createMany({
    data: [
      {
        campaignId: campaignSelesai.id,
        type: "PAYOUT",
        amount: kalkulasiPayout.totalNetToCreators,
        status: "COMPLETED",
        reference: "ESCROW-PAYOUT-SETTLED",
        completedAt: daysFromNow(-7),
      },
      {
        campaignId: campaignSelesai.id,
        type: "PLATFORM_FEE",
        amount: kalkulasiPayout.totalPlatformFee,
        status: "COMPLETED",
        reference: "ESCROW-FEE-SETTLED",
        completedAt: daysFromNow(-7),
      },
      ...(kalkulasiPayout.refundToVendor > 0
        ? [
          {
            campaignId: campaignSelesai.id,
            type: "REFUND" as const,
            amount: kalkulasiPayout.refundToVendor,
            status: "COMPLETED" as const,
            reference: "ESCROW-REFUND-SETTLED",
            note: "Pengembalian sisa budget pool kepada vendor.",
            completedAt: daysFromNow(-7),
          },
        ]
        : []),
    ],
  });

  // ================================================================
  // 10. NOTIFIKASI & AUDIT LOG
  // ================================================================
  console.log("🔔 Membuat Notifikasi & Audit Log...");
  await db.notification.createMany({
    data: [
      {
        userId: creatorAuntyFeni.id,
        type: "SUBMISSION_APPROVED",
        title: "Submission Disetujui! 🎉",
        body: "Vendor Bakso Malang Enggal telah menyetujui video YouTube Shorts kamu.",
        link: "/creator/submissions",
        createdAt: daysFromNow(-6),
      },
      {
        userId: creatorSibungbung.id,
        type: "PAYOUT_RELEASED",
        title: "Payout Cair! 💸",
        body: "Payout sebesar Rp 762.300 dari campaign Grand Opening Kopi Toko Djawa telah ditransfer ke rekening BCA kamu.",
        link: "/creator/earnings",
        createdAt: daysFromNow(-7),
      },
      {
        userId: creatorByan.id,
        type: "CAMPAIGN_NEW_NEARBY",
        title: "Campaign Baru di Jakarta 📍",
        body: "Kopi Toko Djawa Menteng membuka slot konten baru untuk kreator kopi & kafe.",
        link: "/creator/campaigns",
        createdAt: daysFromNow(-6),
      },
      {
        userId: vendorSegoSambel.id,
        type: "GENERAL",
        title: "Pendaftaran Akun Sedang Diverifikasi",
        body: "Tim verifikasi Kontem sedang memeriksa dokumen dan titik Google Maps usaha kamu.",
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
        entityId: vendorEnggal.id,
        metadata: { catatan: "Lokasi fisik dan profil Google Maps cocok." },
        createdAt: daysFromNow(-30),
      },
      {
        actorId: admin.id,
        action: "campaign.approve",
        entity: "Campaign",
        entityId: campaignBakso.id,
        createdAt: daysFromNow(-10),
      },
      {
        actorId: vendorEnggal.id,
        action: "submission.approve",
        entity: "Submission",
        entityId: subFeni.id,
        metadata: { note: "Kualitas audio dan video sangat jernih." },
        createdAt: daysFromNow(-6),
      },
    ],
  });

  console.log("\n✅ SEED BERHASIL DISELESAIKAN!\n");
  console.log("==========================================================================");
  console.log("Akun Demo Kontem (Semua Password: %s)", PASSWORD);
  console.log("==========================================================================");
  console.table([
    { Role: "ADMIN", Email: admin.email, Nama: admin.name, Platform: "-", Handle: "-" },
    { Role: "VENDOR (Verified)", Email: vendorEnggal.email, Nama: "Bakso Malang Enggal", Platform: "-", Handle: "-" },
    { Role: "VENDOR (Verified)", Email: vendorDjawa.email, Nama: "Kopi Toko Djawa", Platform: "-", Handle: "-" },
    { Role: "VENDOR (Verified)", Email: vendorPetakEnam.email, Nama: "Petak Enam Glodok", Platform: "-", Handle: "-" },
    { Role: "VENDOR (Verified)", Email: vendorCobanRondo.email, Nama: "Wisata Coban Rondo", Platform: "-", Handle: "-" },
    { Role: "VENDOR (Pending)", Email: vendorSegoSambel.email, Nama: "Sego Sambel Marem", Platform: "-", Handle: "-" },
    { Role: "CREATOR", Email: creatorSibungbung.email, Nama: "Siti Bungbung", Platform: "TIKTOK", Handle: "@sibungbung" },
    { Role: "CREATOR", Email: creatorAuntyFeni.email, Nama: "Aunty Feni Foodie", Platform: "YOUTUBE", Handle: "@auntyfeni" },
    { Role: "CREATOR", Email: creatorByan.email, Nama: "Byan Hardi", Platform: "YOUTUBE", Handle: "@byanhardTV" },
    { Role: "CREATOR", Email: creatorPetakEnam.email, Nama: "Petak Enam Diary", Platform: "INSTAGRAM", Handle: "@petakenam" },
    { Role: "CREATOR", Email: creatorRekurae.email, Nama: "Raka Rekurae", Platform: "YOUTUBE", Handle: "@Rekurae" },
    { Role: "CREATOR", Email: creatorYuanda.email, Nama: "Yuanda Pratama", Platform: "YOUTUBE", Handle: "@YuandaTVChannel" },
  ]);
  console.log("\nVideo Asli Terverifikasi yang Digunakan:");
  console.log("1. [TikTok]    https://www.tiktok.com/@sibungbung/video/7686608385516539157");
  console.log("2. [TikTok]    https://www.tiktok.com/@sibungbung/video/7686223056871705876");
  console.log("3. [YouTube]   https://www.youtube.com/shorts/lf4U3T3TqPQ (Aunty Feni)");
  console.log("4. [YouTube]   https://www.youtube.com/shorts/CqmGN1cb_8U (Byan Hardi)");
  console.log("5. [YouTube]   https://www.youtube.com/shorts/q9oBcCf980Y (Rekurae)");
  console.log("6. [YouTube]   https://www.youtube.com/shorts/ngvQkHL-um4 (Yuanda Pratama)");
  console.log("7. [Instagram] https://www.instagram.com/petakenam/reel/C0xvXxEBneT/ (Petak Enam)");
  console.log("==========================================================================\n");
}

main()
  .catch((error) => {
    console.error("❌ Terjadi kesalahan saat seeding:", error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
