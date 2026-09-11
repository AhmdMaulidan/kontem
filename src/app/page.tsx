import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, dashboardPath } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatCompact, formatIDR } from "@/lib/format";
import {
  Badge,
  ButtonLink,
  Card,
  PillLabel,
  ProgressBar,
} from "@/components/ui";

const keunggulan = [
  {
    ikon: "🚀",
    tone: "bg-brand-soft text-brand",
    judul: "Tanpa Batas Followers",
    isi: "Nano-creator bebas berkarya. Yang dinilai performa konten, bukan ukuran akun.",
  },
  {
    ikon: "👥",
    tone: "bg-sky-soft text-sky-deep",
    judul: "Dana Aman di Escrow",
    isi: "Vendor menyetor di depan, creator dijamin dibayar setelah konten lolos verifikasi.",
  },
  {
    ikon: "💰",
    tone: "bg-accent-soft text-accent-600",
    judul: "Pembayaran Adil Berbasis CPM",
    isi: "Payout dihitung murni dari views riil yang terkumpul, dibagi proporsional.",
  },
  {
    ikon: "📍",
    tone: "bg-brand-100 text-brand-700",
    judul: "Bukti Kunjungan Fisik",
    isi: "Creator wajib datang ke lokasi dan menukar kode redeem sebelum boleh submit.",
  },
  {
    ikon: "🛡️",
    tone: "bg-info-soft text-info",
    judul: "Penengah Sengketa Objektif",
    isi: "Penolakan wajib beralasan, bisa dibanding, dan diputus admin dengan jejak audit.",
  },
  {
    ikon: "📈",
    tone: "bg-success-soft text-success",
    judul: "Pantau Real-Time",
    isi: "Dashboard live views, sisa budget, dan peringkat creator terbaik.",
  },
];

const platform = [
  "TikTok",
  "Instagram Reels",
  "YouTube Shorts",
  "Google Maps",
];

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
      // Campaign aktif dengan pool terbesar dipakai sebagai contoh nyata di hero.
      db.campaign.findFirst({
        where: { status: "ACTIVE" },
        include: {
          vendor: { include: { vendorProfile: true } },
          _count: { select: { participations: true } },
        },
        orderBy: { budgetPool: "desc" },
      }),
    ]);

  const totalViews = viewsAgg._sum.lastViews ?? 0;

  return (
    <div className="overflow-hidden">
      {/* ------------------------------------------------------------ nav */}
      <header className="sticky top-0 z-20 border-b border-line bg-surface/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3.5">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-base text-white shadow-brand">
              📍
            </span>
            <span className="text-xl font-extrabold tracking-tight text-foreground">
              Kontem
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {[
              { href: "#keunggulan", label: "Kenapa Kontem" },
              { href: "#cara-kerja", label: "Cara Kerja" },
              { href: "#mitra", label: "Cerita Mitra" },
              { href: "#mulai", label: "Mulai" },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-full px-4 py-2 text-sm font-medium text-muted transition-colors hover:bg-brand-soft hover:text-brand-700"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <ButtonLink href="/login" variant="secondary" className="px-5 py-2">
              Masuk
            </ButtonLink>
            <ButtonLink href="/register" className="px-5 py-2">
              Daftar
            </ButtonLink>
          </div>
        </div>
      </header>

      <main>
        {/* -------------------------------------------------------- hero */}
        <section className="relative">
          <div className="blob -top-20 -left-24 h-80 w-80 bg-brand-200" />
          <div className="blob top-24 right-0 h-72 w-72 bg-accent-100" />

          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 lg:grid-cols-2 lg:py-24">
            <div>
              <PillLabel tone="sky">
                ✨ Platform Promosi Lokasi Fisik Berbasis Views
              </PillLabel>

              <h1 className="mt-5 text-4xl font-extrabold leading-[1.1] tracking-tight text-foreground sm:text-5xl">
                Promosikan tempat Anda lewat kreator lokal.{" "}
                <span className="text-brand">Bayar sesuai views</span>, bukan
                followers. ☕📍
              </h1>

              <p className="mt-5 max-w-xl text-base text-muted sm:text-lg">
                Kontem menghubungkan kafe, resto, dan tempat wisata dengan
                kreator lokal. Budget aman di escrow, kunjungan terbukti, dan
                pembagian dana adil proporsional menurut views yang benar-benar
                tercipta.
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <ButtonLink href="/register?role=creator">
                  Daftar sebagai Creator — Gratis
                </ButtonLink>
                <ButtonLink href="#cara-kerja" variant="secondary">
                  ▶ Pelajari Cara Kerjanya
                </ButtonLink>
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <div className="flex -space-x-2">
                  {["🧕", "👨", "👩", "🧑"].map((avatar, index) => (
                    <span
                      key={index}
                      className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-surface bg-brand-100 text-sm"
                    >
                      {avatar}
                    </span>
                  ))}
                </div>
                <div>
                  <p className="text-sm text-accent-600">★★★★★</p>
                  <p className="text-sm text-muted">
                    <strong className="text-foreground">
                      {totalCreator + totalVendor}
                    </strong>{" "}
                    kreator lokal &amp; pemilik usaha telah bergabung
                  </p>
                </div>
              </div>
            </div>

            {/* Panel visual: kartu campaign nyata dari database, dikelilingi
                floating metric chip sesuai design.md bagian 2.3. */}
            <div className="relative">
              <div className="rounded-3xl bg-gradient-to-br from-brand-400 via-brand-500 to-brand-700 p-6 shadow-float sm:p-8">
                <div className="rounded-2xl bg-surface p-5 shadow-card">
                  {sorotan ? (
                    <>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <Badge tone="accent">Campaign Unggulan</Badge>
                          <h3 className="mt-2 font-bold text-foreground">
                            {sorotan.title}
                          </h3>
                          <p className="mt-0.5 text-sm text-muted">
                            {sorotan.vendor.vendorProfile?.businessName} ·{" "}
                            {sorotan.vendor.vendorProfile?.city}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div className="rounded-xl bg-brand-soft p-3">
                          <p className="text-xs text-muted">Budget pool</p>
                          <p className="tabular text-sm font-bold text-brand-700">
                            {formatIDR(sorotan.budgetPool)}
                          </p>
                        </div>
                        <div className="rounded-xl bg-accent-soft p-3">
                          <p className="text-xs text-muted">CPM rate</p>
                          <p className="tabular text-sm font-bold text-accent-600">
                            {formatIDR(sorotan.cpmRate)}
                            <span className="font-medium text-muted">/1k</span>
                          </p>
                        </div>
                      </div>

                      <div className="mt-4">
                        <div className="mb-1.5 flex justify-between text-xs text-muted">
                          <span>
                            Slot terisi {sorotan._count.participations} dari{" "}
                            {sorotan.maxCreators}
                          </span>
                        </div>
                        <ProgressBar
                          value={sorotan._count.participations}
                          max={sorotan.maxCreators}
                        />
                      </div>

                      <p className="mt-4 rounded-xl bg-surface-muted px-3 py-2 text-sm text-body">
                        🍽️ {sorotan.complimentType}
                      </p>
                    </>
                  ) : (
                    <p className="py-8 text-center text-sm text-muted">
                      Belum ada campaign berjalan.
                    </p>
                  )}
                </div>
              </div>

              {/* Floating chips */}
              <div className="absolute -top-4 -left-4 hidden items-center gap-2.5 rounded-2xl border border-line-brand bg-surface/95 p-3 shadow-float backdrop-blur-md sm:flex">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-danger-soft">
                  ❤️
                </span>
                <p className="text-xs font-semibold text-foreground">
                  Bantu UMKM Naik Kelas
                </p>
              </div>

              <div className="absolute -right-3 top-1/3 hidden items-center gap-2.5 rounded-2xl border border-line-brand bg-surface/95 p-3 shadow-float backdrop-blur-md sm:flex">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-success-soft">
                  📈
                </span>
                <div>
                  <p className="text-xs text-muted">Total views tercipta</p>
                  <p className="tabular text-sm font-bold text-foreground">
                    {formatCompact(totalViews)}
                  </p>
                </div>
              </div>

              <div className="absolute -bottom-5 left-6 hidden max-w-[15rem] rounded-2xl border border-line-brand bg-surface/95 p-3.5 shadow-float backdrop-blur-md sm:block">
                <p className="text-xs text-accent-600">★★★★★</p>
                <p className="mt-1 text-xs font-medium text-body">
                  &ldquo;Konten viral, akhir pekan selalu ramai.&rdquo;
                </p>
                <p className="mt-1 text-xs text-muted">
                  Kopi Senja Malang · vendor terverifikasi
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------- platform */}
        <section className="border-y border-line bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-8">
            <p className="text-center text-sm text-muted">
              Didukung publikasi multi-platform konten video pendek
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              {platform.map((nama) => (
                <span
                  key={nama}
                  className="rounded-full border border-line bg-surface-muted px-5 py-2 text-sm font-semibold text-body"
                >
                  {nama}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------ angka */}
        <section className="mx-auto max-w-6xl px-4 py-14">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: "Campaign berjalan",
                value: campaignAktif,
                tone: "text-brand",
              },
              {
                label: "Creator terdaftar",
                value: totalCreator,
                tone: "text-foreground",
              },
              {
                label: "Vendor terverifikasi",
                value: totalVendor,
                tone: "text-foreground",
              },
              {
                label: "Nilai campaign dikelola",
                value: formatIDR(poolAgg._sum.budgetPool ?? 0),
                tone: "text-success",
              },
            ].map((item) => (
              <Card key={item.label} hover className="text-center">
                <p className={`tabular text-3xl font-extrabold ${item.tone}`}>
                  {item.value}
                </p>
                <p className="mt-1.5 text-sm text-muted">{item.label}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* ------------------------------------------------- keunggulan */}
        <section id="keunggulan" className="mx-auto max-w-6xl px-4 py-14">
          <div className="text-center">
            <PillLabel tone="accent">💡 Kenapa Kontem Lebih Unggul</PillLabel>
            <h2 className="mx-auto mt-4 max-w-2xl text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              Semua yang dibutuhkan untuk promosi lokasi fisik yang viral &amp;
              transparan
            </h2>
          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {keunggulan.map((item) => (
              <Card key={item.judul} hover>
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-2xl text-xl ${item.tone}`}
                >
                  {item.ikon}
                </div>
                <h3 className="mt-4 text-lg font-bold text-foreground">
                  {item.judul}
                </h3>
                <p className="mt-1.5 text-sm text-muted">{item.isi}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* ------------------------------------------------- cara kerja */}
        <section id="cara-kerja" className="mx-auto max-w-6xl px-4 py-14">
          <div className="text-center">
            <PillLabel tone="sky">🔄 Alur Lengkap</PillLabel>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              Empat langkah, dua sisi terlindungi
            </h2>
          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                langkah: "1",
                judul: "Vendor buat campaign",
                isi: "Tentukan budget pool, CPM rate, kuota creator, dan brief. Dana disetor di muka ke escrow.",
              },
              {
                langkah: "2",
                judul: "Admin verifikasi",
                isi: "Bisnis dicek lewat Google Maps, foto lokasi, dan konfirmasi telepon sebelum campaign live.",
              },
              {
                langkah: "3",
                judul: "Creator datang & berkarya",
                isi: "Klaim slot, tukar kode redeem di lokasi untuk klaim komplimen, lalu produksi konten.",
              },
              {
                langkah: "4",
                judul: "Payout proporsional",
                isi: "Views dilacak selama periode campaign, lalu pool dibagi sesuai kontribusi tiap creator.",
              },
            ].map((item) => (
              <Card key={item.langkah} hover>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand text-sm font-bold text-white shadow-brand">
                  {item.langkah}
                </div>
                <h3 className="mt-4 font-bold text-foreground">{item.judul}</h3>
                <p className="mt-1.5 text-sm text-muted">{item.isi}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* ----------------------------------------------------- mitra */}
        <section id="mitra" className="mx-auto max-w-6xl px-4 py-14">
          <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-brand-500 to-brand-700 p-8 shadow-float sm:p-12">
            <div className="grid items-center gap-8 lg:grid-cols-[auto_1fr]">
              <div className="flex h-28 w-28 items-center justify-center rounded-3xl bg-white/15 text-5xl backdrop-blur-sm">
                ☕
              </div>

              <div>
                <p className="text-sm font-semibold text-brand-100">
                  Cerita Mitra Kontem
                </p>
                <blockquote className="mt-3 text-xl font-semibold leading-relaxed text-white sm:text-2xl">
                  &ldquo;Dulu bayar influencer jutaan tapi tempat tetap sepi. Di
                  Kontem, kreator datang langsung, bikin konten, dan kafe kami
                  ramai tiap akhir pekan.&rdquo;
                </blockquote>
                <p className="mt-4 text-sm text-brand-100">
                  — Rani Pratiwi, pemilik Kopi Senja Malang
                </p>

                <ul className="mt-6 grid gap-2 text-sm text-white sm:grid-cols-2">
                  {[
                    "Budget terkonversi jadi views nyata",
                    "Komplimen terbukti dinikmati kreator",
                    "Tidak ada risiko pembayaran bodong",
                    "Laporan reach lengkap saat campaign tutup",
                  ].map((poin) => (
                    <li key={poin} className="flex items-start gap-2">
                      <span className="text-brand-200">✓</span>
                      {poin}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ----------------------------------------------------- mulai */}
        <section id="mulai" className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="text-center text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            Mulai campaign atau hasilkan cuan hari ini
          </h2>

          <div className="mt-10 grid gap-5 lg:grid-cols-2">
            <Card float className="p-7">
              <Badge tone="accent">Untuk Kreator Konten</Badge>
              <h3 className="mt-3 text-2xl font-extrabold text-foreground">
                Makan enak, bikin video, dapat cuan
              </h3>
              <ul className="mt-5 space-y-2.5 text-sm text-body">
                {[
                  "Gratis pendaftaran, tanpa minimum followers",
                  "Akses campaign kuliner & wisata di kotamu",
                  "Komplimen menu dan tiket masuk gratis",
                  "Pembayaran langsung ke rekening bank",
                ].map((poin) => (
                  <li key={poin} className="flex items-start gap-2.5">
                    <span className="text-success">✓</span>
                    {poin}
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                <ButtonLink href="/register?role=creator" className="w-full">
                  Daftar sebagai Creator →
                </ButtonLink>
              </div>
            </Card>

            <Card float className="p-7">
              <Badge tone="sky">Untuk Pemilik Resto &amp; Wisata</Badge>
              <h3 className="mt-3 text-2xl font-extrabold text-foreground">
                Promosi ramai tanpa boncos
              </h3>
              <ul className="mt-5 space-y-2.5 text-sm text-body">
                {[
                  "Tentukan sendiri budget pool sesuai kemampuan",
                  "Sistem escrow aman, bayar hanya untuk views nyata",
                  "Akses kreator lokal yang siap meliput",
                  "Dashboard analitik real-time sampai campaign tutup",
                ].map((poin) => (
                  <li key={poin} className="flex items-start gap-2.5">
                    <span className="text-success">✓</span>
                    {poin}
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                <ButtonLink
                  href="/register?role=vendor"
                  variant="accent"
                  className="w-full"
                >
                  Buat Campaign Vendor →
                </ButtonLink>
              </div>
            </Card>
          </div>
        </section>

        {/* ------------------------------------------------------ demo */}
        <section className="mx-auto max-w-6xl px-4 pb-16">
          <Card className="bg-surface-muted">
            <h2 className="font-bold text-foreground">Akun demo</h2>
            <p className="mt-1 text-sm text-muted">
              Password semua akun:{" "}
              <code className="rounded-md bg-surface px-1.5 py-0.5 font-mono text-xs">
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
                  className="rounded-xl border border-line bg-surface px-3 py-2"
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

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand text-sm text-white">
              📍
            </span>
            <span className="font-bold text-foreground">Kontem</span>
          </div>
          <p className="text-sm text-muted">
            Platform location campaign berbasis CPM &amp; escrow untuk UMKM dan
            kreator lokal.
          </p>
        </div>
      </footer>
    </div>
  );
}
