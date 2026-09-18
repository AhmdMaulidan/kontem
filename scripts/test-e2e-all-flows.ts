import "dotenv/config";
import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { calculatePayouts } from "../src/domain/payout";
import { calculateCampaignSettlementSummary } from "../src/domain/campaign";
import { evaluateCampaignEndingSoon } from "../src/domain/lifecycle";
import { notifyParticipantsCampaignEndingSoon } from "../src/domain/notification";
import { verifyContentOwnership } from "../src/domain/social-url";
import { evaluateViewFraud } from "../src/domain/views";

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL atau DIRECT_URL belum diset di environment.");
}

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  bold: "\x1b[1m",
};

function logStep(step: number, title: string) {
  console.log(`\n${colors.cyan}${colors.bold}=== [ALUR BISNIS ${step}]: ${title} ===${colors.reset}`);
}

function logSuccess(msg: string) {
  console.log(`  ${colors.green}✔ ${msg}${colors.reset}`);
}

async function runAllBusinessFlowsE2E() {
  console.log(`\n${colors.bold}${colors.yellow}========================================================================`);
  console.log(` MEMULAI PENGUJIAN END-TO-END (E2E) SEMUA ALUR BISNIS KONTEM`);
  console.log(`========================================================================${colors.reset}`);

  // --------------------------------------------------------------------------
  // ALUR 1: Validasi Persona & Akun Terdaftar (Admin, Vendor, Multi-Creator)
  // --------------------------------------------------------------------------
  logStep(1, "Inisialisasi Persona & Verifikasi Identitas Akun");

  const admin = await db.user.findFirstOrThrow({
    where: { role: "ADMIN", status: "VERIFIED" },
  });
  logSuccess(`Admin terverifikasi ditemukan: ${admin.name} (${admin.email})`);

  const vendor = await db.user.findFirstOrThrow({
    where: { role: "VENDOR", status: "VERIFIED" },
    include: { vendorProfile: true },
  });
  logSuccess(`Vendor terverifikasi ditemukan: ${vendor.name} - ${vendor.vendorProfile?.businessName}`);

  // Pastikan vendor memiliki data rekening untuk refund
  await db.vendorProfile.update({
    where: { userId: vendor.id },
    data: {
      bankName: "BCA",
      bankAccountNumber: "8820129381",
      bankAccountName: vendor.name,
    },
  });
  logSuccess("Rekening bank vendor untuk escrow refund tervalidasi.");

  const creators = await db.user.findMany({
    where: { role: "CREATOR", status: "VERIFIED" },
    include: { creatorProfile: true, socialAccounts: true },
    take: 3,
  });
  assert.ok(creators.length >= 3, "Harus tersedia minimal 3 kreator terverifikasi untuk pengujian.");
  const [creator1, creator2, creator3] = creators;
  logSuccess(`Kreator 1: ${creator1.name} (@${creator1.socialAccounts[0]?.handle ?? "creator1"})`);
  logSuccess(`Kreator 2: ${creator2.name} (@${creator2.socialAccounts[0]?.handle ?? "creator2"})`);
  logSuccess(`Kreator 3: ${creator3.name} (@${creator3.socialAccounts[0]?.handle ?? "creator3"})`);

  // --------------------------------------------------------------------------
  // ALUR 2: Vendor Membuat Campaign Baru & Escrow Deposit
  // --------------------------------------------------------------------------
  logStep(2, "Vendor Membuat Campaign & Escrow Deposit Terbentuk");

  const campaignTitle = `E2E Full Flow Test Campaign - ${Date.now()}`;
  const budgetPool = 1_500_000; // Rp 1.500.000
  const cpmRate = 25_000; // Rp 25.000 per 1k views
  const startDate = new Date();
  const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 hari
  const trackingEndsAt = new Date(endDate.getTime() + 7 * 24 * 60 * 60 * 1000);

  const campaign = await db.campaign.create({
    data: {
      vendorId: vendor.id,
      title: campaignTitle,
      category: "KULINER",
      description: "Kampanye uji coba E2E komprehensif mencakup semua siklus alur bisnis.",
      briefAngle: "Tampilkan menu andalan dengan review jujur dan suasana lokasi.",
      briefMustShow: ["Menu utama", "Plang nama resto", "Suasana"],
      briefProhibited: ["Menjelekkan kompetitor"],
      minDurationSec: 15,
      allowedPlatforms: ["TIKTOK", "INSTAGRAM", "YOUTUBE"],
      budgetPool,
      cpmRate,
      complimentType: "1 Porsi Nasi Goreng Spesial + Es Teh",
      complimentValue: 45_000,
      complimentTerms: "Wajib datang saat jam operasional 11.00 - 21.00 WIB",
      startDate,
      endDate,
      trackingEndsAt,
      status: "PENDING_REVIEW",
      submittedAt: new Date(),
      escrow: {
        create: {
          type: "DEPOSIT",
          amount: budgetPool,
          status: "PENDING",
          note: "Menunggu transfer deposit budget pool oleh vendor.",
        },
      },
    },
    include: { escrow: true },
  });

  assert.equal(campaign.status, "PENDING_REVIEW");
  assert.equal(campaign.escrow.length, 1);
  assert.equal(campaign.escrow[0].status, "PENDING");
  assert.equal(campaign.escrow[0].amount, budgetPool);
  logSuccess(`Campaign berhasil dibuat (ID: ${campaign.id}) dengan status PENDING_REVIEW.`);
  logSuccess(`Escrow Deposit tercatat PENDING sebesar Rp ${budgetPool.toLocaleString("id-ID")}.`);

  // --------------------------------------------------------------------------
  // ALUR 3: Admin Review Campaign & Verifikasi Escrow Deposit
  // --------------------------------------------------------------------------
  logStep(3, "Admin Verifikasi Escrow Deposit & Menyetujui Campaign (Active)");

  const depositTx = campaign.escrow[0];

  // 3a. Admin konfirmasi pembayaran deposit
  await db.$transaction([
    db.escrowTransaction.update({
      where: { id: depositTx.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        reference: `TF-BCA-${Date.now()}`,
        note: `Dikonfirmasi manual oleh admin (${admin.name}) setelah cek mutasi bank.`,
      },
    }),
    db.notification.create({
      data: {
        userId: vendor.id,
        type: "GENERAL",
        title: "Deposit escrow diterima",
        body: `Deposit budget pool sebesar Rp ${budgetPool.toLocaleString("id-ID")} telah diverifikasi.`,
        link: `/vendor/campaigns/${campaign.id}`,
      },
    }),
  ]);
  logSuccess("Admin mengonfirmasi transaksi Escrow Deposit -> status COMPLETED.");

  // 3b. Admin menyetujui campaign
  await db.$transaction([
    db.campaign.update({
      where: { id: campaign.id },
      data: {
        status: "ACTIVE",
        approvedAt: new Date(),
        approvedById: admin.id,
      },
    }),
    db.notification.create({
      data: {
        userId: vendor.id,
        type: "GENERAL",
        title: "Campaign disetujui",
        body: `"${campaign.title}" sudah live dan terlihat creator.`,
        link: `/vendor/campaigns/${campaign.id}`,
      },
    }),
  ]);

  const activeCampaign = await db.campaign.findUniqueOrThrow({
    where: { id: campaign.id },
  });
  assert.equal(activeCampaign.status, "ACTIVE");
  assert.ok(activeCampaign.approvedAt);
  logSuccess("Admin menyetujui campaign -> status beralih ke ACTIVE & notifikasi terkirim ke vendor.");

  // Belum ada participation yang dibuat -- di alur baru (tanpa kuota),
  // participation lahir bersamaan dengan submission, siapa pun boleh ikut.
  const currentCount = await db.campaignParticipation.count({
    where: { campaignId: campaign.id, status: { not: "CANCELLED" } },
  });
  assert.equal(currentCount, 0);

  // --------------------------------------------------------------------------
  // ALUR 4: Kreator Mengunggah Konten & Guardrail Validasi URL Multi-Platform
  // --------------------------------------------------------------------------
  logStep(4, "Pengiriman Konten (TikTok, Instagram Reels, YouTube Shorts)");

  // Gunakan atau buat akun media sosial untuk kreator 1 & 2
  let c1Account = await db.socialAccount.findFirst({
    where: { userId: creator1.id, platform: "TIKTOK" },
  });
  if (!c1Account) {
    const c1Handle = `c1_${creator1.id.slice(-6)}`;
    c1Account = await db.socialAccount.create({
      data: {
        userId: creator1.id,
        platform: "TIKTOK",
        handle: c1Handle,
        profileUrl: `https://www.tiktok.com/@${c1Handle}`,
      },
    });
  }

  let c2Account = await db.socialAccount.findFirst({
    where: { userId: creator2.id, platform: "INSTAGRAM" },
  });
  if (!c2Account) {
    const c2Handle = `c2_${creator2.id.slice(-6)}`;
    c2Account = await db.socialAccount.create({
      data: {
        userId: creator2.id,
        platform: "INSTAGRAM",
        handle: c2Handle,
        profileUrl: `https://www.instagram.com/${c2Handle}`,
      },
    });
  }

  const c1TikTokHandle = c1Account.handle;
  const c2IGHandle = c2Account.handle;

  // Validasi kepemilikan URL kreator 1 (TikTok)
  const tiktokUrl = `https://www.tiktok.com/@${c1TikTokHandle}/video/7401234567890123456`;
  const ownership1 = verifyContentOwnership({
    url: tiktokUrl,
    platform: "TIKTOK",
    registeredHandle: c1TikTokHandle,
  });
  assert.equal(ownership1.isValid, true);
  logSuccess(`Validasi URL TikTok lolos untuk @${c1TikTokHandle}: ${tiktokUrl}`);

  // Submit konten langsung membuat participation & submission sekaligus --
  // tidak ada lagi tahap klaim slot terpisah.
  const part1 = await db.campaignParticipation.create({
    data: { campaignId: campaign.id, creatorId: creator1.id, status: "SUBMITTED" },
  });
  const sub1 = await db.submission.create({
    data: {
      campaignId: campaign.id,
      creatorId: creator1.id,
      participationId: part1.id,
      contentUrl: tiktokUrl,
      platform: "TIKTOK",
      caption: "Review jujur Nasi Goreng Spesial! Suasananya cozy banget!",
      status: "PENDING_REVIEW",
      lastViews: 0,
    },
  });
  logSuccess(`Kreator 1 (${creator1.name}) submit konten (ID: ${sub1.id}) -> status PENDING_REVIEW.`);

  // Validasi kepemilikan URL kreator 2 (Instagram Reels)
  const igUrl = `https://www.instagram.com/reel/C9testReel123/?igsh=abcdef`;
  const ownership2 = verifyContentOwnership({
    url: igUrl,
    platform: "INSTAGRAM",
    registeredHandle: c2IGHandle,
  });
  assert.equal(ownership2.isValid, true);
  logSuccess(`Validasi URL Instagram Reels lolos untuk @${c2IGHandle}: ${igUrl}`);

  // Submit konten Kreator 2 -- participation & submission sekaligus.
  const part2 = await db.campaignParticipation.create({
    data: { campaignId: campaign.id, creatorId: creator2.id, status: "SUBMITTED" },
  });
  const sub2 = await db.submission.create({
    data: {
      campaignId: campaign.id,
      creatorId: creator2.id,
      participationId: part2.id,
      contentUrl: igUrl,
      platform: "INSTAGRAM",
      caption: "Weekend mampir ke spot kuliner viral ini!",
      status: "PENDING_REVIEW",
      lastViews: 0,
    },
  });
  logSuccess(`Kreator 2 (${creator2.name}) submit konten (ID: ${sub2.id}) -> status PENDING_REVIEW.`);

  // Tanpa kuota, dua creator bebas berpartisipasi di campaign yang sama.
  const filledCount = await db.campaignParticipation.count({
    where: { campaignId: campaign.id, status: { not: "CANCELLED" } },
  });
  assert.equal(filledCount, 2);
  logSuccess(`Dua submission masuk tanpa batas kuota (${filledCount} creator berpartisipasi).`);

  // --------------------------------------------------------------------------
  // ALUR 5: Admin Review Submission (Approval vs Rejection)
  // --------------------------------------------------------------------------
  logStep(5, "Review Submission oleh Admin (Approve & Reject)");

  // 6a. Admin menyetujui submission Kreator 1
  await db.$transaction([
    db.submission.update({
      where: { id: sub1.id },
      data: {
        status: "APPROVED",
        reviewedById: admin.id,
        reviewedAt: new Date(),
        reviewNote: "Konten sangat bagus dan sesuai brief.",
      },
    }),
    db.campaignParticipation.update({
      where: { id: part1.id },
      data: { status: "COMPLETED" },
    }),
    db.creatorProfile.updateMany({
      where: { userId: creator1.id },
      data: { trustScore: { increment: 2 } },
    }),
    db.notification.create({
      data: {
        userId: creator1.id,
        type: "SUBMISSION_APPROVED",
        title: "Konten disetujui",
        body: `Kontenmu untuk "${campaign.title}" disetujui. Views mulai dihitung.`,
        link: "/creator/submissions",
      },
    }),
  ]);
  logSuccess(`Admin menyetujui konten Kreator 1 -> status APPROVED, Trust Score +2.`);

  // 6b. Admin menolak submission Kreator 2 dengan alasan wajib
  const rejectionReason = "Suasana tempat tidak ditampilkan dan durasi kurang dari 15 detik.";
  await db.$transaction([
    db.submission.update({
      where: { id: sub2.id },
      data: {
        status: "REJECTED",
        reviewedById: admin.id,
        reviewedAt: new Date(),
        reviewNote: rejectionReason,
      },
    }),
    db.notification.create({
      data: {
        userId: creator2.id,
        type: "SUBMISSION_REJECTED",
        title: "Konten ditolak",
        body: `Admin menolak kontenmu: ${rejectionReason}`,
        link: "/creator/submissions",
      },
    }),
  ]);
  logSuccess(`Admin menolak konten Kreator 2 dengan alasan: "${rejectionReason}".`);

  // --------------------------------------------------------------------------
  // ALUR 6: Banding Kreator (Dispute) & Resolusi Arbitrase oleh Admin
  // --------------------------------------------------------------------------
  logStep(6, "Banding Kreator (Dispute) & Penyelesaian oleh Admin");

  const appealReason = "Di video detik 0:05 sampai 0:10 sudah ditampilkan suasana indoor dan outdoor secara jelas.";
  assert.ok(appealReason.length >= 20, "Alasan banding harus minimal 20 karakter.");

  const dispute = await db.$transaction(async (tx) => {
    await tx.submission.update({
      where: { id: sub2.id },
      data: { status: "APPEALED" },
    });
    const d = await tx.dispute.create({
      data: {
        submissionId: sub2.id,
        openedById: creator2.id,
        reason: appealReason,
        status: "OPEN",
      },
    });
    await tx.disputeMessage.create({
      data: {
        disputeId: d.id,
        senderId: creator2.id,
        body: appealReason,
      },
    });
    return d;
  });
  logSuccess(`Kreator 2 mengajukan banding -> Dispute #${dispute.id} dibuka dengan status OPEN.`);

  // Admin meninjau dan memenangkan banding (Overturn)
  const resolutionText = "Setelah diteliti, suasana resto terlihat jelas di menit 0:05. Konten dinyatakan memenuhi syarat.";
  await db.$transaction(async (tx) => {
    await tx.dispute.update({
      where: { id: dispute.id },
      data: {
        status: "RESOLVED_OVERTURNED",
        resolution: resolutionText,
        resolvedById: admin.id,
        resolvedAt: new Date(),
      },
    });
    await tx.disputeMessage.create({
      data: {
        disputeId: dispute.id,
        senderId: admin.id,
        body: resolutionText,
      },
    });
    await tx.submission.update({
      where: { id: sub2.id },
      data: {
        status: "ADMIN_APPROVED",
        reviewedById: admin.id,
        reviewedAt: new Date(),
      },
    });
    await tx.campaignParticipation.update({
      where: { id: part2.id },
      data: { status: "COMPLETED" },
    });
    await tx.creatorProfile.updateMany({
      where: { userId: creator2.id },
      data: { trustScore: { increment: 3 } },
    });
  });
  logSuccess("Admin memenangkan banding kreator (RESOLVED_OVERTURNED) -> status ADMIN_APPROVED, partisipasi COMPLETED.");

  // --------------------------------------------------------------------------
  // ALUR 7: Pelacakan Metrik Views & Guardrail Anti-Fraud
  // --------------------------------------------------------------------------
  logStep(7, "Pembaruan Snapshot Metrik Views & Evaluasi Indikasi Fraud");

  // Input snapshot views untuk Kreator 1 (32.000 views, 1.200 likes)
  const views1 = 32_000;
  await db.$transaction([
    db.viewSnapshot.create({
      data: {
        submissionId: sub1.id,
        views: views1,
        likes: 1_200,
        comments: 140,
        source: "API",
      },
    }),
    db.submission.update({
      where: { id: sub1.id },
      data: {
        lastViews: views1,
        lastLikes: 1_200,
        lastComments: 140,
        lastSyncedAt: new Date(),
      },
    }),
  ]);
  logSuccess(`Metrik Kreator 1 diperbarui: ${views1.toLocaleString("id-ID")} views, 1.200 likes.`);

  // Input snapshot views untuk Kreator 2 (18.000 views, 650 likes)
  const views2 = 18_000;
  await db.$transaction([
    db.viewSnapshot.create({
      data: {
        submissionId: sub2.id,
        views: views2,
        likes: 650,
        comments: 45,
        source: "API",
      },
    }),
    db.submission.update({
      where: { id: sub2.id },
      data: {
        lastViews: views2,
        lastLikes: 650,
        lastComments: 45,
        lastSyncedAt: new Date(),
      },
    }),
  ]);
  logSuccess(`Metrik Kreator 2 diperbarui: ${views2.toLocaleString("id-ID")} views, 650 likes.`);

  // Uji guardrail deteksi fraud: anomali lonjakan views tanpa keterlibatan
  const fraudCheck = evaluateViewFraud(
    1_000,
    80_000,
    new Date(Date.now() - 10 * 60 * 1000), // 10 menit lalu
    new Date(),
    0,
    0,
  );
  assert.ok(fraudCheck, "Fraud check harus menghasilkan assessment.");
  assert.equal(fraudCheck.hasFraud, true);
  logSuccess(`Guardrail Fraud teruji: mendeteksi anomali ${fraudCheck.reason}`);

  // --------------------------------------------------------------------------
  // ALUR 8: Lifecycle Kampanye (Ending Soon, Expired, Tracking Ends)
  // --------------------------------------------------------------------------
  logStep(8, "Evaluasi Siklus Hidup Kampanye (Lifecycle & Ending Soon Alert)");

  // 10a. Uji evaluasi ending soon (H-2)
  const twoDaysBeforeEnd = new Date(endDate.getTime() - 36 * 60 * 60 * 1000);
  const endingSoonCheck = evaluateCampaignEndingSoon(
    { status: "ACTIVE", endDate },
    twoDaysBeforeEnd,
  );
  assert.equal(endingSoonCheck.isEndingSoon, true);
  logSuccess(`Evaluasi Siklus Hidup: Terdeteksi campaign ending soon dalam kurun waktu ${Math.round(endingSoonCheck.hoursLeft)} jam.`);

  // 10b. Uji notifikasi ending soon deduplikasi ke database
  const notifyResult = await notifyParticipantsCampaignEndingSoon(db, {
    campaignId: campaign.id,
    campaignTitle: campaign.title,
    hoursLeft: 36,
  });
  logSuccess(`Notifikasi Siklus Hidup: Sistem mengevaluasi pengiriman alert ke kreator (${notifyResult.count} notifikasi baru).`);

  // --------------------------------------------------------------------------
  // ALUR 9: Settlement Kampanye, Pembagian Pool Payout, & Platform Fee
  // --------------------------------------------------------------------------
  logStep(9, "Penyelesaian (Settlement) Kampanye & Perhitungan Payout Pool");

  // Ubah status ke ENDED untuk simulasi settle
  await db.campaign.update({
    where: { id: campaign.id },
    data: { status: "ENDED" },
  });

  const submissionsToSettle = await db.submission.findMany({
    where: {
      campaignId: campaign.id,
      status: { in: ["APPROVED", "ADMIN_APPROVED"] },
    },
  });
  assert.equal(submissionsToSettle.length, 2);

  const payoutEntries = submissionsToSettle.map((s) => ({
    creatorId: s.creatorId,
    submissionId: s.id,
    views: s.lastViews,
  }));

  const payoutCalc = calculatePayouts(payoutEntries, {
    budgetPool: campaign.budgetPool,
    cpmRate: campaign.cpmRate,
    platformFeeRate: 10, // 10% platform fee
    maxViewsPerCreator: null,
  });

  // Total views: 32.000 + 18.000 = 50.000 views.
  // CPM Rp 25.000 / 1.000 views. Total gross: 50 * 25.000 = Rp 1.250.000.
  // Pool Rp 1.500.000. Sisa refund ke vendor: Rp 250.000!
  assert.equal(payoutCalc.totalViews, 50_000);
  assert.equal(payoutCalc.totalDistributed, 1_250_000);
  assert.equal(payoutCalc.refundToVendor, 250_000);
  assert.equal(payoutCalc.totalPlatformFee, 125_000);
  assert.equal(payoutCalc.totalNetToCreators, 1_125_000);

  logSuccess(`Perhitungan Pool: Total Views = ${payoutCalc.totalViews.toLocaleString("id-ID")}`);
  logSuccess(`Gross Payout = Rp ${payoutCalc.totalDistributed.toLocaleString("id-ID")}`);
  logSuccess(`Platform Fee (10%) = Rp ${payoutCalc.totalPlatformFee.toLocaleString("id-ID")}`);
  logSuccess(`Net ke Seluruh Kreator = Rp ${payoutCalc.totalNetToCreators.toLocaleString("id-ID")}`);
  logSuccess(`Refund sisa pool ke Vendor = Rp ${payoutCalc.refundToVendor.toLocaleString("id-ID")}`);

  // Eksekusi Settlement Transaction
  await db.$transaction(async (tx) => {
    for (const sub of submissionsToSettle) {
      await tx.submission.update({
        where: { id: sub.id },
        data: { finalViews: sub.lastViews },
      });
    }

    for (const line of payoutCalc.lines) {
      await tx.payout.create({
        data: {
          campaignId: campaign.id,
          creatorId: line.creatorId,
          submissionId: line.submissionId,
          viewsCounted: line.viewsCounted,
          totalPoolViews: line.totalPoolViews,
          sharePercent: line.sharePercent,
          grossAmount: line.grossAmount,
          platformFee: line.platformFee,
          netAmount: line.netAmount,
          status: "PENDING",
        },
      });
    }

    await tx.escrowTransaction.create({
      data: {
        campaignId: campaign.id,
        type: "PLATFORM_FEE",
        amount: payoutCalc.totalPlatformFee,
        status: "COMPLETED",
        completedAt: new Date(),
      },
    });

    if (payoutCalc.refundToVendor > 0) {
      await tx.escrowTransaction.create({
        data: {
          campaignId: campaign.id,
          type: "REFUND",
          amount: payoutCalc.refundToVendor,
          status: "PENDING",
          note: "Sisa pool yang tidak terserap.",
        },
      });
    }

    await tx.campaign.update({
      where: { id: campaign.id },
      data: { status: "SETTLING", settledAt: new Date() },
    });
  });
  logSuccess("Transaksi Settlement berhasil dicatat di database -> Campaign status SETTLING.");

  // --------------------------------------------------------------------------
  // ALUR 10: Pencairan Dana (Release Payouts) & Pengembalian Sisa Escrow Refund
  // --------------------------------------------------------------------------
  logStep(10, "Pencairan Payout Kreator (Release) & Konfirmasi Refund Vendor");

  // 12a. Admin mencairkan seluruh payout kreator
  const pendingPayouts = await db.payout.findMany({
    where: { campaignId: campaign.id, status: "PENDING" },
  });
  assert.equal(pendingPayouts.length, 2);

  const totalPayoutNet = pendingPayouts.reduce((sum, p) => sum + p.netAmount, 0);
  await db.$transaction(async (tx) => {
    await tx.payout.updateMany({
      where: { campaignId: campaign.id, status: "PENDING" },
      data: { status: "PAID", paidAt: new Date() },
    });
    await tx.escrowTransaction.create({
      data: {
        campaignId: campaign.id,
        type: "PAYOUT",
        amount: totalPayoutNet,
        status: "COMPLETED",
        reference: `PAYOUT-MANUAL-${Date.now()}`,
        completedAt: new Date(),
      },
    });
    await tx.campaign.update({
      where: { id: campaign.id },
      data: { status: "SETTLED" },
    });
  });
  logSuccess(`Admin mencairkan payout kreator -> ${pendingPayouts.length} payout dibayarkan (Total Rp ${totalPayoutNet.toLocaleString("id-ID")}).`);
  logSuccess("Status campaign resmi beralih ke SETTLED.");

  // 12b. Admin mengonfirmasi transfer sisa refund ke rekening vendor
  const refundTrx = await db.escrowTransaction.findFirstOrThrow({
    where: { campaignId: campaign.id, type: "REFUND", status: "PENDING" },
  });
  await db.escrowTransaction.update({
    where: { id: refundTrx.id },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      reference: `REFUND-BCA-${Date.now()}`,
      note: `Sisa pool Rp ${refundTrx.amount.toLocaleString("id-ID")} telah dikembalikan ke rekening vendor.`,
    },
  });
  logSuccess(`Admin menyelesaikan transfer escrow refund ke vendor sebesar Rp ${refundTrx.amount.toLocaleString("id-ID")} -> status COMPLETED.`);

  // 12c. Rekonsiliasi Saldo Escrow (Audit Neraca Escrow)
  const allEscrowTrx = await db.escrowTransaction.findMany({
    where: { campaignId: campaign.id },
  });
  const totalIn = allEscrowTrx
    .filter((t) => t.type === "DEPOSIT" && t.status === "COMPLETED")
    .reduce((sum, t) => sum + t.amount, 0);

  const totalOut = allEscrowTrx
    .filter((t) => ["PAYOUT", "PLATFORM_FEE", "REFUND"].includes(t.type) && t.status === "COMPLETED")
    .reduce((sum, t) => sum + t.amount, 0);

  assert.equal(totalIn, budgetPool);
  assert.equal(totalOut, budgetPool);
  assert.equal(totalIn - totalOut, 0, "Neraca Escrow harus seimbang sempurna (Rp 0 selisih).");
  logSuccess(`Rekonsiliasi Escrow Sempurna: Total Masuk (Rp ${totalIn.toLocaleString("id-ID")}) == Total Keluar (Rp ${totalOut.toLocaleString("id-ID")}). Selisih = Rp 0.`);

  // --------------------------------------------------------------------------
  // ALUR 11: Settlement Summary & Analytics Metrics
  // --------------------------------------------------------------------------
  logStep(11, "Analitik Ringkasan Kampanye (Realized CPM & Performa)");

  const summary = calculateCampaignSettlementSummary({
    campaign: {
      id: campaign.id,
      title: campaign.title,
      budgetPool: campaign.budgetPool,
      cpmRate: campaign.cpmRate,
      platformFeeRate: 10,
      status: "SETTLED",
      settledAt: new Date(),
    },
    submissions: [
      {
        id: sub1.id,
        creatorId: creator1.id,
        creatorName: creator1.name,
        status: "APPROVED",
        platform: "TIKTOK",
        contentUrl: tiktokUrl,
        lastViews: views1,
      },
      {
        id: sub2.id,
        creatorId: creator2.id,
        creatorName: creator2.name,
        status: "APPROVED",
        platform: "INSTAGRAM",
        contentUrl: igUrl,
        lastViews: views2,
      },
    ],
  });

  assert.equal(summary.isSettled, true);
  assert.equal(summary.totalReach, 50_000);
  assert.equal(summary.budgetSpent, 1_250_000);
  assert.equal(summary.refundAmount, 250_000);
  assert.equal(summary.topPerformers.length, 2);
  logSuccess(`Ringkasan Performa: Total Reach = ${summary.totalReach.toLocaleString("id-ID")} views, Dana Terserap = Rp ${summary.budgetSpent.toLocaleString("id-ID")}.`);
  logSuccess(`Top Performer #1: ${summary.topPerformers[0].creatorName} (${summary.topPerformers[0].views.toLocaleString("id-ID")} views)`);

  console.log(`\n${colors.bold}${colors.green}========================================================================`);
  console.log(` SEMUA 11 TAHAPAN ALUR BISNIS E2E BERHASIL 100% TANPA KESALAHAN!`);
  console.log(`========================================================================${colors.reset}\n`);
}

runAllBusinessFlowsE2E()
  .catch((err) => {
    console.error(`\n${colors.red}${colors.bold}E2E TESTING GAGAL:${colors.reset}`, err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
