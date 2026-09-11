import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, dashboardPath } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatCompact, formatIDR } from "@/lib/format";
import {
  Badge,
  ButtonLink,
  Card,
  IconArrowRight,
  IconCheck,
  IconEye,
  IconGift,
  IconMegaphone,
  IconPin,
  IconScale,
  IconShield,
  IconTrend,
  IconUsers,
  IconWallet,
  ProgressBar,
} from "@/components/ui";
import { WaveBand } from "./illustrations";

const keunggulan = [
  {
    Ikon: IconUsers,
    tone: "text-brand-600",
    judul: "Tanpa batas followers",
    isi: "Nano-creator ikut bersaing setara. Yang dinilai performa konten, bukan ukuran akun.",
  },
  {
    Ikon: IconWallet,
    tone: "text-accent-600",
    judul: "Dana dikunci di escrow",
    isi: "Vendor menyetor di depan. Creator tidak pernah bekerja tanpa jaminan bayaran.",
  },
  {
    Ikon: IconScale,
    tone: "text-brand-600",
    judul: "Pembagian berbasis CPM",
    isi: "Pool dibagi proporsional menurut views riil, dihitung sampai satuan rupiah terkecil.",
  },
  {
    Ikon: IconPin,
    tone: "text-brand-600",
    judul: "Bukti kunjungan fisik",
    isi: "Konten hanya bisa dikirim setelah kode redeem ditukar langsung di lokasi.",
  },
  {
    Ikon: IconShield,
    tone: "text-brand-600",
    judul: "Penolakan bisa dibanding",
    isi: "Vendor wajib menuliskan alasan. Creator bisa mengajukan banding, admin yang memutus.",
  },
  {
    Ikon: IconTrend,
    tone: "text-brand-600",
    judul: "Transparan dua arah",
    isi: "Kedua pihak melihat angka views dan serapan budget yang sama, diperbarui berkala.",
  },
];

const langkah = [
  {
    judul: "Vendor menyusun campaign",
    isi: "Tentukan budget pool, CPM rate, kuota creator, dan brief konten.",
    gambar: "/illustrations/langkah-1-campaign.svg",
  },
  {
    judul: "Dana masuk escrow",
    isi: "Budget disetor lebih dulu dan dikunci sampai campaign selesai dihitung.",
    gambar: "/illustrations/langkah-2-escrow.svg",
  },
  {
    judul: "Creator datang ke lokasi",
    isi: "Klaim slot, tukar kode redeem di kasir, lalu nikmati komplimennya.",
    gambar: "/illustrations/langkah-3-kunjungan.svg",
  },
  {
    judul: "Konten tayang & dinilai",
    isi: "Video dikirim, vendor meninjau, views dilacak selama periode campaign.",
    gambar: "/illustrations/langkah-4-konten.svg",
  },
  {
    judul: "Pool dibagi & cair",
    isi: "Pembagian proporsional menurut views, langsung ke rekening creator.",
    gambar: "/illustrations/langkah-5-payout.svg",
  },
];

const platform = ["TikTok", "Instagram Reels", "YouTube Shorts", "Google Maps"];

export default async function LandingPage() {
  const session = await getSession();
  if (session) redirect(dashboardPath(session.role));

  const [campaignAktif, totalCreator, totalVendor, poolAgg, viewsAgg, sorotan] =
    await Promise.all([
      db.campaign.count({ where: { status: "ACTIVE" } }),
      db.user.count({ where: { role: "CREATOR" } }),
      db.user.count({ where: { role: "VENDOR", status: "VERIFIED" } }),
      db.campaign.aggregate({
        _sum: { budgetPool: true },
        where: { status: { in: ["ACTIVE", "ENDED", "SETTLING", "SETTLED"] } },
      }),
      db.submission.aggregate({
        _sum: { lastViews: true },
        where: { status: { in: ["APPROVED", "ADMIN_APPROVED"] } },
      }),
      // Campaign aktif dengan pool terbesar dipakai sebagai contoh nyata.
      db.campaign.findFirst({
        where: { status: "ACTIVE" },
        include: {
          vendor: { include: { vendorProfile: true } },
          _count: { select: { participations: true } },
        },
        orderBy: { budgetPool: "desc" },
      }),
    ]);

  // Angka pada kartu kubah selalu berasal dari database — design.md bagian 10.1
  // melarang angka publik yang dikarang.
  const angka = [
    { Ikon: IconUsers, value: String(totalCreator), label: "Creator" },
    { Ikon: IconMegaphone, value: String(campaignAktif), label: "Campaign" },
    { Ikon: IconPin, value: String(totalVendor), label: "Vendor" },
    {
      Ikon: IconEye,
      value: formatCompact(viewsAgg._sum.lastViews ?? 0),
      label: "Views",
    },
  ];

  return (
    <div className="bg-surface">
      {/* ------------------------------------------------------------ nav */}
      <header className="absolute inset-x-0 top-0 z-20">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-5">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-brand-600">
              <IconPin className="h-4.5 w-4.5" strokeWidth={2.5} />
            </span>
            <span className="font-display text-xl font-bold text-white">
              Kontem
            </span>
          </Link>

          <nav className="hidden items-center gap-7 lg:flex">
            {[
              { href: "#keunggulan", label: "Keunggulan" },
              { href: "#cara-kerja", label: "Cara kerja" },
              { href: "#campaign", label: "Campaign" },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-sm font-medium text-white/90 transition-colors hover:text-white"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <ButtonLink href="/login" variant="outlineLight" size="sm">
              Masuk
            </ButtonLink>
            <ButtonLink href="/register" size="sm">
              Daftar
            </ButtonLink>
          </div>
        </div>
      </header>

      <main>
        {/* -------------------------------------------------------- hero */}
        <section className="relative bg-brand-300 pt-24">
          <div className="mx-auto flex max-w-6xl flex-col-reverse items-center gap-8 px-4 pb-4 lg:flex-row lg:gap-10 lg:pb-0">
            <div className="flex-[3] text-center lg:text-left">
              <h1 className="font-display text-[1.85rem] leading-tight font-bold text-white lg:text-[3.25rem]">
                Promosikan tempatmu lewat kreator lokal, bayar sesuai views
              </h1>
              {/* Navy, bukan putih: teks 15px putih di atas biru langit hanya
                  mencapai rasio kontras ~1,9:1 dan praktis tidak terbaca. */}
              <p className="mt-3 text-[15px] text-foreground/80 lg:text-xl">
                Budget dikunci di escrow, kunjungan dibuktikan di lokasi, dan
                pembagian mengikuti views yang benar-benar tercipta.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3 lg:mt-8 lg:justify-start">
                <ButtonLink href="/register?role=creator" size="lg">
                  Gabung jadi creator
                </ButtonLink>
                <ButtonLink href="#cara-kerja" variant="secondary" size="lg">
                  Lihat cara kerja
                </ButtonLink>
              </div>
            </div>

            {/* Ilustrasi menumpang langsung di atas panel biru — panel putih
                memotong bidang langit jadi dua (design.md bagian 5.1). */}
            <div className="flex-[3]">
              <Image
                src="/illustrations/hero-konten-kreator.svg"
                alt="Konten kreator tentang sebuah kedai sedang ditonton dan disukai lewat ponsel"
                width={852}
                height={664}
                priority
                className="mx-auto h-auto w-9/12 lg:w-full"
              />
            </div>
          </div>

          {/* Pita awan penutup hero. translate-y-px menutup celah subpiksel
              antara tepi bawah gambar dan seksi putih di bawahnya. */}
          <Image
            src="/illustrations/clouds.webp"
            alt=""
            width={1281}
            height={231}
            priority
            className="block w-full translate-y-px"
          />
        </section>

        {/* ------------------------------------------------------- angka */}
        <section className="mx-auto max-w-6xl px-4 pt-6 pb-16 text-center">
          <h2 className="font-display text-xl font-bold sm:text-2xl">
            Gabung di Kontem sekarang!
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-muted sm:text-base">
            Satu tempat untuk mempertemukan pemilik usaha dan kreator lokal —
            hemat, aman, dan angkanya terbuka untuk kedua pihak.
          </p>

          <div className="mt-16 flex flex-wrap justify-center gap-5 xl:gap-10">
            {angka.map(({ Ikon, value, label }) => (
              <div
                key={label}
                className="relative flex h-[150px] w-[170px] flex-col items-center"
              >
                <span className="absolute -top-9 z-10 flex h-[72px] w-[72px] items-center justify-center rounded-full bg-accent text-white shadow-float">
                  <Ikon className="h-8 w-8" strokeWidth={2} />
                </span>
                <div className="dome flex h-full w-full flex-col justify-end bg-brand pb-5">
                  <p className="tabular font-display text-2xl font-bold text-white lg:text-[28px]">
                    {value}
                  </p>
                  <p className="mt-0.5 text-sm font-medium text-white/90">
                    {label}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ---------------------------------------------------- platform */}
        <section className="relative overflow-hidden">
          <WaveBand className="absolute inset-x-0 bottom-0 h-[300px] w-full sm:h-[380px] lg:h-[440px]" />

          <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-8 px-4 pt-14 pb-16 lg:grid-cols-2 lg:gap-12 lg:pb-24">
            <div className="text-center lg:text-left">
              <h2 className="font-display text-2xl font-bold lg:text-[2.15rem]">
                Tayang di mana saja
              </h2>
              <p className="mt-2 text-sm text-muted sm:text-base">
                Konten creator boleh tayang di platform video pendek mana pun.
                Views dari tautan publiknya yang dihitung, bukan jumlah pengikut
                akunnya.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3 lg:justify-start">
                {platform.map((nama) => (
                  <span
                    key={nama}
                    className="rounded-full bg-surface px-5 py-2.5 text-sm font-semibold text-body shadow-card"
                  >
                    {nama}
                  </span>
                ))}
              </div>
            </div>

            <Image
              src="/illustrations/platform-creator.svg"
              alt="Kreator konten dikelilingi ikon media sosial"
              width={974}
              height={827}
              className="mx-auto h-auto w-8/12 lg:w-10/12"
            />
          </div>
        </section>

        {/* ------------------------------------------------- keunggulan */}
        <section id="keunggulan" className="mx-auto max-w-6xl px-4 py-16">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-2xl font-bold lg:text-[2.15rem]">
              Kenapa lewat Kontem?
            </h2>
            <p className="mt-2 text-sm text-muted sm:text-base">
              Endorse biasa menyisakan dua risiko: vendor membayar tanpa
              kepastian hasil, creator bekerja tanpa kepastian bayaran. Setiap
              mekanisme di bawah menutup salah satunya.
            </p>
          </div>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {keunggulan.map(({ Ikon, tone, judul, isi }) => (
              <Card key={judul} soft hover className="p-6">
                <div
                  className={`flex h-14 w-14 items-center justify-center rounded-full bg-surface ${tone}`}
                >
                  <Ikon className="h-7 w-7" strokeWidth={1.9} />
                </div>
                <h3 className="mt-4 font-display text-lg font-bold">{judul}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">
                  {isi}
                </p>
              </Card>
            ))}
          </div>
        </section>

        {/* ------------------------------------------------- cara kerja */}
        <section id="cara-kerja" className="bg-surface-muted py-16">
          <div className="mx-auto max-w-6xl px-4">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="font-display text-2xl font-bold lg:text-[2.15rem]">
                Cara kerjanya
              </h2>
              <p className="mt-2 text-sm text-muted sm:text-base">
                Lima langkah, dari setoran budget sampai dana cair ke rekening
                creator.
              </p>
            </div>

            {/* Tiga baris subgrid: ilustrasi, kubah, penjelasan. Tanpa ini
                kubah yang judulnya dua baris jadi lebih tinggi dari
                tetangganya dan deretnya terlihat bergelombang. */}
            <ol className="mt-12 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-5 lg:grid-rows-[auto_auto_auto] lg:gap-y-0">
              {langkah.map((item, i) => (
                <li
                  key={item.judul}
                  className="flex flex-col lg:row-span-3 lg:grid lg:grid-rows-subgrid lg:gap-0"
                >
                  {/* Ilustrasi menumpang di atas kubah, seperti referensi.
                      Lingkaran di belakangnya menyamakan bidang tiap gambar —
                      rasio aspek ilustrasi unDraw berbeda-beda. */}
                  <div className="relative z-10 -mb-8 flex h-32 w-32 shrink-0 items-center justify-center self-center rounded-full bg-[#D6EAF8]">
                    <Image
                      src={item.gambar}
                      alt=""
                      width={320}
                      height={240}
                      className="h-20 w-24 object-contain"
                    />
                  </div>
                  <div className="dome flex items-start gap-2 bg-brand-600 px-5 pt-14 pb-5">
                    <span className="tabular mt-px grid h-5 w-5 flex-none place-items-center rounded-full bg-white text-xs font-semibold text-brand-600">
                      {i + 1}
                    </span>
                    <p className="text-sm font-semibold text-white">
                      {item.judul}
                    </p>
                  </div>
                  <p className="mt-4 px-1 text-sm leading-relaxed text-muted">
                    {item.isi}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ---------------------------------------------------- campaign */}
        <section id="campaign" className="mx-auto max-w-6xl px-4 py-16">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-center">
            <div>
              <h2 className="font-display text-2xl font-bold lg:text-[2.15rem]">
                Campaign yang sedang berjalan
              </h2>
              <p className="mt-2 text-sm text-muted sm:text-base">
                Setiap campaign menampilkan budget pool, CPM rate, sisa slot,
                dan komplimen yang didapat creator sejak awal — tidak ada angka
                yang baru muncul setelah kamu ikut.
              </p>
              <div className="mt-6 rounded-2xl bg-brand-50 p-5">
                <p className="text-sm text-body">
                  Total nilai campaign yang dikelola dan dikunci di escrow
                </p>
                <p className="tabular mt-1 font-display text-3xl font-bold text-brand-600">
                  {formatIDR(poolAgg._sum.budgetPool ?? 0)}
                </p>
              </div>
            </div>

            {sorotan ? (
              <Card float className="p-6">
                <div className="flex items-center justify-between gap-3">
                  <Badge tone="success" icon>
                    Sedang berjalan
                  </Badge>
                  <span className="text-xs text-muted">
                    Contoh campaign aktif
                  </span>
                </div>

                <h3 className="mt-4 font-display text-lg font-bold">
                  {sorotan.title}
                </h3>
                <p className="mt-1 text-sm text-muted">
                  {sorotan.vendor.vendorProfile?.businessName} ·{" "}
                  {sorotan.vendor.vendorProfile?.city}
                </p>

                <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line">
                  <div className="bg-surface p-3.5">
                    <dt className="text-xs text-muted">Budget pool</dt>
                    <dd className="tabular mt-1 font-semibold text-foreground">
                      {formatIDR(sorotan.budgetPool)}
                    </dd>
                  </div>
                  <div className="bg-surface p-3.5">
                    <dt className="text-xs text-muted">CPM rate</dt>
                    <dd className="tabular mt-1 font-semibold text-foreground">
                      {formatIDR(sorotan.cpmRate)}
                      <span className="text-xs font-normal text-muted">
                        {" "}
                        / 1.000 views
                      </span>
                    </dd>
                  </div>
                </dl>

                <div className="mt-5">
                  <div className="mb-2 flex justify-between text-xs text-muted">
                    <span>Slot creator</span>
                    <span className="tabular">
                      {sorotan._count.participations} / {sorotan.maxCreators}
                    </span>
                  </div>
                  <ProgressBar
                    value={sorotan._count.participations}
                    max={sorotan.maxCreators}
                  />
                </div>

                <div className="mt-5 flex items-start gap-2.5 border-t border-line pt-4">
                  <IconGift className="mt-0.5 h-4 w-4 shrink-0 text-accent-600" />
                  <p className="text-sm text-body">{sorotan.complimentType}</p>
                </div>
              </Card>
            ) : (
              <Card className="p-10 text-center text-sm text-muted">
                Belum ada campaign berjalan.
              </Card>
            )}
          </div>
        </section>

        {/* ----------------------------------------------------- mulai */}
        <section className="bg-surface-muted py-16">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="text-center font-display text-2xl font-bold lg:text-[2.15rem]">
              Mulai hari ini
            </h2>

            <div className="mt-10 grid gap-6 lg:grid-cols-2">
              <Card panel hover className="flex h-full flex-col p-7 lg:p-8">
                <div>
                  <Badge tone="sky">Untuk kreator konten</Badge>
                </div>
                <h3 className="mt-4 font-display text-xl font-bold">
                  Liput tempat favoritmu, dibayar sesuai performa
                </h3>
                <ul className="mt-5 space-y-3 text-sm text-body">
                  {[
                    "Gratis mendaftar, tanpa minimum followers",
                    "Campaign disaring otomatis menurut kotamu",
                    "Komplimen menu atau tiket masuk di lokasi",
                    "Payout ditransfer ke rekening terdaftar",
                  ].map((poin) => (
                    <li key={poin} className="flex items-start gap-2.5">
                      <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                      {poin}
                    </li>
                  ))}
                </ul>
                <div className="mt-auto pt-7">
                  <ButtonLink href="/register?role=creator" className="w-full">
                    Daftar sebagai creator
                    <IconArrowRight className="h-4 w-4" />
                  </ButtonLink>
                </div>
              </Card>

              <Card panel hover className="flex h-full flex-col p-7 lg:p-8">
                <div>
                  <Badge tone="sky">Untuk pemilik usaha</Badge>
                </div>
                <h3 className="mt-4 font-display text-xl font-bold">
                  Anggaran promosi yang habisnya bisa dipertanggungjawabkan
                </h3>
                <ul className="mt-5 space-y-3 text-sm text-body">
                  {[
                    "Tentukan sendiri budget pool dan CPM rate",
                    "Tidak pernah membayar melebihi pool yang disetor",
                    "Sisa dana yang tidak terserap dikembalikan",
                    "Laporan reach lengkap saat campaign ditutup",
                  ].map((poin) => (
                    <li key={poin} className="flex items-start gap-2.5">
                      <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                      {poin}
                    </li>
                  ))}
                </ul>
                <div className="mt-auto pt-7">
                  <ButtonLink
                    href="/register?role=vendor"
                    variant="outlineBrand"
                    className="w-full"
                  >
                    Buat campaign vendor
                    <IconArrowRight className="h-4 w-4" />
                  </ButtonLink>
                </div>
              </Card>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------ demo */}
        <section className="mx-auto max-w-6xl px-4 py-12">
          <Card>
            <h2 className="font-display text-base font-bold">Akun demo</h2>
            <p className="mt-1 text-sm text-muted">
              Password semua akun:{" "}
              <code className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-xs">
                password123
              </code>
            </p>
            <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
              {[
                { peran: "Admin", email: "admin@kontem.id" },
                { peran: "Vendor", email: "vendor@kopisenja.id" },
                { peran: "Creator", email: "dita@creator.id" },
              ].map((akun) => (
                <li
                  key={akun.email}
                  className="rounded-xl border border-line px-3.5 py-2.5"
                >
                  <p className="text-xs text-muted">{akun.peran}</p>
                  <code className="font-mono text-xs text-body">
                    {akun.email}
                  </code>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      </main>

      <footer className="bg-brand-600">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-10">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-brand-600">
              <IconPin className="h-4 w-4" strokeWidth={2.5} />
            </span>
            <span className="font-display text-lg font-bold text-white">
              Kontem
            </span>
          </div>
          <p className="max-w-md text-sm text-white/90">
            Platform campaign lokasi berbasis CPM dan escrow untuk UMKM dan
            kreator lokal.
          </p>
        </div>
      </footer>
    </div>
  );
}
