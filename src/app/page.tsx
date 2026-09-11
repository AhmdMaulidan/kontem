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
  IconBank,
  IconCheck,
  IconGift,
  IconPin,
  IconScale,
  IconShield,
  IconTrend,
  IconUsers,
  IconWallet,
  PillLabel,
  ProgressBar,
} from "@/components/ui";

const keunggulan = [
  {
    Ikon: IconUsers,
    tone: "bg-brand-50 text-brand-700",
    judul: "Tanpa batas followers",
    isi: "Nano-creator ikut bersaing setara. Yang dinilai performa konten, bukan ukuran akun.",
  },
  {
    Ikon: IconWallet,
    tone: "bg-sky-soft text-sky-deep",
    judul: "Dana dikunci di escrow",
    isi: "Vendor menyetor di depan. Creator tidak pernah bekerja tanpa jaminan bayaran.",
  },
  {
    Ikon: IconScale,
    tone: "bg-accent-soft text-accent-600",
    judul: "Pembagian berbasis CPM",
    isi: "Pool dibagi proporsional menurut views riil, dihitung sampai satuan rupiah terkecil.",
  },
  {
    Ikon: IconPin,
    tone: "bg-brand-50 text-brand-700",
    judul: "Bukti kunjungan fisik",
    isi: "Konten hanya bisa dikirim setelah kode redeem ditukar langsung di lokasi.",
  },
  {
    Ikon: IconShield,
    tone: "bg-info-soft text-info",
    judul: "Penolakan bisa dibanding",
    isi: "Vendor wajib menuliskan alasan. Creator bisa mengajukan banding, admin yang memutus.",
  },
  {
    Ikon: IconTrend,
    tone: "bg-success-soft text-success",
    judul: "Transparan dua arah",
    isi: "Kedua pihak melihat angka views dan serapan budget yang sama, diperbarui berkala.",
  },
];

const langkah = [
  {
    nomor: "01",
    judul: "Vendor menyusun campaign",
    isi: "Menentukan budget pool, CPM rate, kuota creator, dan brief konten. Dana disetor lebih dulu ke escrow.",
  },
  {
    nomor: "02",
    judul: "Admin memverifikasi",
    isi: "Keabsahan bisnis dicek lewat titik peta, foto lokasi, dan konfirmasi telepon sebelum campaign tayang.",
  },
  {
    nomor: "03",
    judul: "Creator datang dan meliput",
    isi: "Klaim slot, tukar kode redeem di lokasi untuk menerima komplimen, lalu produksi konten sesuai brief.",
  },
  {
    nomor: "04",
    judul: "Pool dibagi menurut views",
    isi: "Views dilacak selama periode campaign, lalu dibagikan proporsional dan ditransfer ke rekening creator.",
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

  const angka = [
    { label: "Campaign berjalan", value: String(campaignAktif) },
    { label: "Creator terdaftar", value: String(totalCreator) },
    { label: "Vendor terverifikasi", value: String(totalVendor) },
    {
      label: "Views terverifikasi",
      value: formatCompact(viewsAgg._sum.lastViews ?? 0),
    },
  ];

  return (
    <div>
      {/* ------------------------------------------------------------ nav */}
      <header className="sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3.5">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-white">
              <IconPin className="h-4 w-4" strokeWidth={2.5} />
            </span>
            <span className="text-lg font-bold tracking-tight text-foreground">
              Kontem
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {[
              { href: "#keunggulan", label: "Kenapa Kontem" },
              { href: "#cara-kerja", label: "Cara kerja" },
              { href: "#mitra", label: "Cerita mitra" },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-full px-3.5 py-2 text-sm font-medium text-muted transition-colors hover:text-foreground"
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
        <section className="border-b border-line bg-surface">
          <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 py-16 lg:grid-cols-[1.05fr_1fr] lg:py-24">
            <div>
              <PillLabel tone="sky" icon={IconPin}>
                Platform location campaign berbasis views
              </PillLabel>

              <h1 className="mt-6 text-4xl font-bold leading-[1.12] tracking-tight text-foreground sm:text-5xl">
                Promosikan tempat Anda lewat kreator lokal.{" "}
                <span className="text-brand-600">Bayar sesuai views</span>,
                bukan followers.
              </h1>

              <p className="mt-5 max-w-xl text-base leading-relaxed text-muted">
                Kontem menghubungkan kafe, resto, dan destinasi wisata dengan
                kreator di kota yang sama. Budget dikunci di escrow, kunjungan
                dibuktikan di lokasi, dan pembagian dana mengikuti views yang
                benar-benar tercipta.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <ButtonLink href="/register?role=creator">
                  Daftar sebagai creator
                  <IconArrowRight className="h-4 w-4" />
                </ButtonLink>
                <ButtonLink href="#cara-kerja" variant="secondary">
                  Pelajari cara kerjanya
                </ButtonLink>
              </div>

              <dl className="mt-10 grid max-w-lg grid-cols-2 gap-x-8 gap-y-5 border-t border-line pt-8 sm:grid-cols-4">
                {angka.map((item) => (
                  <div key={item.label}>
                    <dt className="text-xs text-muted">{item.label}</dt>
                    <dd className="tabular mt-1 text-xl font-bold text-foreground">
                      {item.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* Contoh campaign nyata dari database, bukan ilustrasi. */}
            <div className="lg:pl-4">
              {sorotan ? (
                <Card float className="p-6">
                  <div className="flex items-center justify-between gap-3">
                    <Badge tone="success">Sedang berjalan</Badge>
                    <span className="text-xs text-muted">
                      Contoh campaign aktif
                    </span>
                  </div>

                  <h2 className="mt-4 text-lg font-semibold text-foreground">
                    {sorotan.title}
                  </h2>
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
          </div>
        </section>

        {/* ---------------------------------------------------- platform */}
        <section className="border-b border-line">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-10 gap-y-3 px-4 py-7">
            <p className="text-sm text-muted">Konten tayang di</p>
            {platform.map((nama) => (
              <span key={nama} className="text-sm font-semibold text-body">
                {nama}
              </span>
            ))}
          </div>
        </section>

        {/* ------------------------------------------------- keunggulan */}
        <section id="keunggulan" className="mx-auto max-w-6xl px-4 py-20">
          <div className="max-w-2xl">
            <PillLabel tone="neutral">Kenapa Kontem</PillLabel>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-foreground">
              Dibangun untuk menutup celah kepercayaan di kedua sisi
            </h2>
            <p className="mt-3 text-muted">
              Endorse biasa menyisakan dua risiko: vendor membayar tanpa
              kepastian hasil, creator bekerja tanpa kepastian bayaran. Setiap
              mekanisme di bawah menutup salah satunya.
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {keunggulan.map(({ Ikon, tone, judul, isi }) => (
              <div key={judul}>
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}
                >
                  <Ikon className="h-5 w-5" strokeWidth={2} />
                </div>
                <h3 className="mt-4 font-semibold text-foreground">{judul}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">
                  {isi}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ------------------------------------------------- cara kerja */}
        <section
          id="cara-kerja"
          className="border-y border-line bg-surface py-20"
        >
          <div className="mx-auto max-w-6xl px-4">
            <div className="max-w-2xl">
              <PillLabel tone="neutral">Cara kerja</PillLabel>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-foreground">
                Empat langkah, dari setoran budget sampai dana cair
              </h2>
            </div>

            <ol className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {langkah.map((item) => (
                <li key={item.nomor} className="border-t-2 border-brand pt-5">
                  <span className="tabular text-sm font-bold text-brand">
                    {item.nomor}
                  </span>
                  <h3 className="mt-2 font-semibold text-foreground">
                    {item.judul}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">
                    {item.isi}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ----------------------------------------------------- mitra */}
        <section id="mitra" className="mx-auto max-w-6xl px-4 py-20">
          <div className="grid gap-10 lg:grid-cols-[1.3fr_1fr] lg:items-center">
            <figure>
              <blockquote className="text-2xl font-medium leading-snug tracking-tight text-foreground sm:text-3xl">
                &ldquo;Dulu bayar influencer jutaan tapi tempat tetap sepi. Di
                Kontem kreator datang langsung, bikin konten, dan akhir pekan
                kami ramai.&rdquo;
              </blockquote>
              <figcaption className="mt-6 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
                  RP
                </span>
                <span className="text-sm">
                  <span className="block font-semibold text-foreground">
                    Rani Pratiwi
                  </span>
                  <span className="text-muted">
                    Pemilik Kopi Senja Malang · vendor terverifikasi
                  </span>
                </span>
              </figcaption>
            </figure>

            <Card className="p-6">
              <div className="flex items-center gap-2.5">
                <IconBank className="h-4 w-4 text-muted" />
                <p className="text-sm font-semibold text-foreground">
                  Nilai campaign yang dikelola
                </p>
              </div>
              <p className="tabular mt-3 text-3xl font-bold text-foreground">
                {formatIDR(poolAgg._sum.budgetPool ?? 0)}
              </p>
              <p className="mt-1.5 text-sm text-muted">
                Seluruhnya tersimpan di escrow dan hanya cair untuk konten yang
                lolos verifikasi.
              </p>
            </Card>
          </div>
        </section>

        {/* ----------------------------------------------------- mulai */}
        <section className="border-t border-line bg-surface py-20">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="text-3xl font-bold tracking-tight text-foreground">
              Mulai hari ini
            </h2>

            <div className="mt-10 grid gap-6 lg:grid-cols-2">
              <Card hover className="p-7">
                <Badge tone="accent">Untuk kreator konten</Badge>
                <h3 className="mt-4 text-xl font-bold text-foreground">
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
                <div className="mt-7">
                  <ButtonLink href="/register?role=creator" className="w-full">
                    Daftar sebagai creator
                    <IconArrowRight className="h-4 w-4" />
                  </ButtonLink>
                </div>
              </Card>

              <Card hover className="p-7">
                <Badge tone="sky">Untuk pemilik usaha</Badge>
                <h3 className="mt-4 text-xl font-bold text-foreground">
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
                <div className="mt-7">
                  <ButtonLink
                    href="/register?role=vendor"
                    variant="secondary"
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
            <h2 className="font-semibold text-foreground">Akun demo</h2>
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

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-white">
              <IconPin className="h-3.5 w-3.5" strokeWidth={2.5} />
            </span>
            <span className="font-bold text-foreground">Kontem</span>
          </div>
          <p className="text-sm text-muted">
            Platform location campaign berbasis CPM dan escrow untuk UMKM dan
            kreator lokal.
          </p>
        </div>
      </footer>
    </div>
  );
}
