import Image from "next/image";
import { redirect } from "next/navigation";
import { getSession, dashboardPath } from "@/lib/auth";
import { db } from "@/lib/db";
import { daysUntil, formatIDR } from "@/lib/format";
import {
  Accordion,
  ButtonLink,
  Card,
  CatalogCard,
  CountUp,
  IconArrowRight,
  IconEye,
  IconPin,
  LogoInstagram,
  LogoTikTok,
  LogoYouTube,
  cn,
  socialBrandColor,
} from "@/components/ui";
import { categoryLabel, categoryTone } from "@/lib/labels";
import { LandingNav } from "./landing-nav";
import { PhoneScreen, RibbonBand, WaveBand } from "./illustrations";

/**
 * Sembilan langkah alur campaign, dari vendor menyusun sampai payout cair.
 *
 * Judul tiap langkah selalu menyebut pelakunya — vendor, admin, creator, atau
 * sistem — karena alurnya berpindah tangan beberapa kali; langkah tanpa pelaku
 * membuat pengunjung tidak tahu bagian mana yang jadi tanggung jawabnya.
 */
const langkah = [
  {
    judul: "Vendor buat campaign",
    isi: "Tentukan budget pool, tarif CPM, kuota creator, dan brief kontennya.",
    gambar: "/illustrations/langkah-1-campaign.svg",
  },
  {
    judul: "Admin approve campaign",
    isi: "Setelah disetujui, campaign live dan muncul di listing creator.",
    gambar: "/illustrations/langkah-2-approve.svg",
  },
  {
    judul: "Creator join",
    isi: "Creator mengambil slot yang tersedia dan menerima kode redeem.",
    gambar: "/illustrations/langkah-3-join.svg",
  },
  {
    judul: "Creator datang ke lokasi",
    isi: "Kode ditukar di tempat, komplimen dinikmati, kunjungan tercatat.",
    gambar: "/illustrations/langkah-4-lokasi.svg",
  },
  {
    judul: "Creator submit konten",
    isi: "Tautan video publik dikirim lewat form submission.",
    gambar: "/illustrations/langkah-5-submit.svg",
  },
  {
    judul: "Vendor / admin review",
    isi: "Submission disetujui, atau ditolak dengan alasan yang bisa dibanding.",
    gambar: "/illustrations/langkah-6-review.svg",
  },
  {
    judul: "Sistem tracking views",
    isi: "Angka views dilacak berkala selama periode campaign berjalan.",
    gambar: "/illustrations/langkah-7-tracking.svg",
  },
  {
    judul: "Campaign selesai",
    isi: "Views dikunci, lalu proporsi tiap creator dihitung dari total views.",
    gambar: "/illustrations/langkah-8-hitung.svg",
  },
  {
    judul: "Admin cairkan payout",
    isi: "Pool budget vendor dibagi sesuai proporsi, langsung ke rekening creator.",
    gambar: "/illustrations/langkah-9-payout.svg",
  },
];

// Enum SocialPlatform mengenal tiga kanal, tapi yang benar-benar dibuka untuk
// campaign baru sekarang hanya TikTok — dua sisanya ditandai "Segera hadir"
// supaya creator tidak menyiapkan konten untuk kanal yang belum bisa dipilih
// saat submit.
const platform = [
  {
    nama: "TikTok",
    format: "Video pendek",
    aktif: true,
    Logo: LogoTikTok,
    warna: socialBrandColor.TikTok,
  },
  {
    nama: "Instagram",
    format: "Reels",
    aktif: false,
    Logo: LogoInstagram,
    warna: socialBrandColor.Instagram,
  },
  {
    nama: "YouTube",
    format: "Shorts",
    aktif: false,
    Logo: LogoYouTube,
    warna: socialBrandColor.YouTube,
  },
];

/**
 * Isi FAQ halaman depan. Jawabannya mengikuti aturan main yang benar-benar
 * berlaku di sistem (escrow, largest remainder, fee 15%, bukti kunjungan) —
 * kalau salah satunya berubah, teks di sini ikut diperbarui.
 */
const faq = [
  {
    pertanyaan: "Berapa lama dana escrow dikunci?",
    jawaban:
      "Dana dikunci sejak vendor menyetor sampai campaign selesai dihitung. Selama periode itu vendor tidak bisa menariknya, dan creator tidak pernah bekerja tanpa jaminan. Sisa pool yang tidak terserap dikembalikan utuh ke vendor saat settlement.",
  },
  {
    pertanyaan: "Apakah ada minimum followers untuk jadi creator?",
    jawaban:
      "Tidak ada. Siapa pun yang punya akun media sosial aktif boleh mengambil slot campaign. Yang dibayar adalah views yang benar-benar tercipta, bukan jumlah pengikut akunmu.",
  },
  {
    pertanyaan: "Bagaimana penghasilan creator dihitung?",
    jawaban:
      "Dasarnya tarif CPM: setiap 1.000 views dihargai sesuai tarif yang dipasang vendor. Kalau total tagihan seluruh creator melebihi budget pool, pool dibagi proporsional menurut kontribusi views masing-masing, dibulatkan dengan metode largest remainder supaya jumlahnya genap sampai rupiah terakhir.",
  },
  {
    pertanyaan: "Berapa potongan platform Kontem?",
    jawaban:
      "15% dan dipotong hanya dari pembayaran yang benar-benar diterima creator. Tidak ada biaya pendaftaran, baik untuk creator maupun vendor.",
  },
  {
    pertanyaan: "Kenapa creator harus datang ke lokasi dulu?",
    jawaban:
      "Setiap slot menghasilkan kode redeem yang hanya bisa disahkan kasir atau PIC di outlet. Kunjungan yang belum terkonfirmasi membuat form submission belum terbuka — inilah yang memastikan konten dibuat di tempat, bukan dari materi orang lain.",
  },
  {
    pertanyaan: "Bagaimana kalau konten saya ditolak vendor?",
    jawaban:
      "Vendor wajib memilih kategori pelanggaran brief dan menuliskan alasannya; penolakan tanpa alasan tidak bisa dikirim. Kalau kamu tidak setuju, ajukan banding dan admin akan menengahi dengan melihat video, brief, serta argumen kedua pihak.",
  },
  {
    pertanyaan: "Kapan payout dicairkan?",
    jawaban:
      "Setelah periode campaign berakhir, angka views dikunci, pembagian pool dihitung, lalu admin mengeksekusi transfer ke rekening atau e-wallet yang terdaftar di profilmu.",
  },
  {
    pertanyaan: "Platform media sosial mana yang didukung?",
    jawaban:
      "Untuk sekarang campaign berjalan di TikTok. Instagram Reels dan YouTube Shorts sedang disiapkan dan akan dibuka menyusul.",
  },
];

export default async function LandingPage() {
  const session = await getSession();
  if (session) redirect(dashboardPath(session.role));

  const [campaignAktif, totalCreator, totalVendor, poolAgg, viewsAgg, katalog] =
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
      // Delapan campaign aktif dengan pool terbesar — dua baris penuh pada
      // grid empat kolom. Yang sudah lewat tenggat tidak ikut: kartunya akan
      // menawarkan slot yang tidak bisa diklaim.
      db.campaign.findMany({
        where: { status: "ACTIVE", endDate: { gt: new Date() } },
        include: {
          vendor: { include: { vendorProfile: true } },
          _count: { select: { participations: true } },
        },
        orderBy: { budgetPool: "desc" },
        take: 8,
      }),
    ]);

  // Angka pada kartu kubah selalu berasal dari database — design.md bagian 10.1
  // melarang angka publik yang dikarang.
  // Urutan warna kubah tetap: azure -> violet -> mango -> melon (design.md
  // bagian 5.1), tidak diacak per-render. Kubahnya terang, jadi angka dan
  // labelnya navy — putih di atas warna seterang ini tidak terbaca.
  const angka = [
    {
      gambar: { src: "/illustrations/Creator.svg", w: 730, h: 1085 },
      value: totalCreator,
      label: "Creator",
      warna: "bg-stat-azure",
    },
    {
      gambar: { src: "/illustrations/Campaign.svg", w: 1287, h: 1464 },
      value: campaignAktif,
      label: "Campaign",
      warna: "bg-stat-violet",
    },
    {
      gambar: { src: "/illustrations/Vendor.svg", w: 1403, h: 1403 },
      value: totalVendor,
      label: "Vendor",
      warna: "bg-stat-mango",
    },
    {
      gambar: { src: "/illustrations/Views.svg", w: 1500, h: 1270 },
      value: viewsAgg._sum.lastViews ?? 0,
      compact: true,
      label: "Views",
      warna: "bg-stat-melon",
    },
  ];

  return (
    <div className="bg-surface">
      {/* ------------------------------------------------------------ nav */}
      <LandingNav />

      <main>
        {/* -------------------------------------------------------- hero */}
        <section className="relative bg-brand-300 pt-24">
          <div className="mx-auto flex max-w-6xl flex-col-reverse items-center gap-8 px-4 pb-4 lg:flex-row lg:gap-10 lg:pb-0">
            <div className="flex-[3] text-center lg:text-left">
              <h1 className="font-display text-[2rem] leading-[1.16] font-bold tracking-tight text-white drop-shadow-[0_2px_4px_rgba(2,132,199,0.2)] sm:text-4xl lg:text-[3.25rem]">
                Promosikan tempatmu lewat kreator lokal,{" "}
                <span className="block text-brand-700">
                  bayar sesuai views
                </span>
              </h1>
              <p className="mt-4 max-w-xl text-base font-medium text-foreground lg:text-xl lg:leading-relaxed">
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
                src="/illustrations/image-hero.svg"
                alt="Tiga kreator lokal membuat konten lewat ponsel, dikelilingi angka views dan suka"
                width={1500}
                height={1000}
                priority
                // Ilustrasi dibesarkan melewati kolomnya hanya mulai xl — di lebar lg
                // ruang sisanya tidak cukup dan halaman jadi bisa digeser ke samping.
                className="mx-auto h-auto w-full max-w-md lg:max-w-none xl:-mx-[7%] xl:w-[114%]"
              />
            </div>
          </div>

          {/* Pita awan penutup hero. translate-y-px menutup celah subpiksel
              antara tepi bawah gambar dan seksi putih di bawahnya. */}
          <Image
            src="/illustrations/clouds.svg"
            alt=""
            width={1496}
            height={314}
            priority
            // Tinggi gambar selalu jatuh di angka pecahan (302,48px di 1440),
            // jadi tepi bawah panel biru menyembul di bawah awan dan terbaca
            // sebagai garis. Tumpang tindihnya dibuat 3px — satu piksel tidak
            // cukup karena pembulatan bisa menyisakan dua baris, dan tiga
            // piksel masih tertutup penuh oleh bidang putih di kaki awan.
            className="-mt-10 -mb-[3px] block w-full sm:-mt-14"
          />
        </section>

        {/* ----------------------------------------- pita penghubung ----
            Seksi angka dan seksi platform dibungkus satu wadah supaya pita
            gelombangnya bisa mengalir menyambung dari bawah pita awan sampai
            "Tayang di mana saja" — kalau tiap seksi menggambar pitanya
            sendiri, sambungannya patah di batas seksi.

            Latarnya `bg-surface` (putih), bukan `bg-background`: dasar halaman
            depan memang putih (design.md bagian 2.1 — `--background` itu dasar
            dasbor), dan abu kebiruan #f8fafc terlihat sebagai bidang berbeda
            begitu bertemu putih pita awan di atasnya. */}
        <div className="relative overflow-hidden bg-surface">
          <RibbonBand className="pointer-events-none absolute inset-0 hidden h-full w-full lg:block" />

        {/* ------------------------------------------------------- angka */}
        <section className="relative z-10 mx-auto max-w-6xl px-4 pt-6 pb-16 text-center">
          <h2 className="font-display text-xl font-bold sm:text-2xl">
            Gabung di Kontem sekarang!
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-muted sm:text-base">
            Satu tempat untuk mempertemukan pemilik usaha dan kreator lokal —
            hemat, aman, dan angkanya terbuka untuk kedua pihak.
          </p>

          <div className="mt-14 flex flex-wrap justify-center gap-5 xl:gap-10">
            {angka.map(({ gambar, value, compact, label, warna }) => (
              <div
                key={label}
                className="flex w-[150px] flex-col sm:w-[200px] lg:w-[235px]"
              >
                {/* Ilustrasi menumpang di atas kubah dengan tinggi dipatok —
                    rasio unDraw yang berbeda-beda diseragamkan oleh tinggi
                    tetap, bukan oleh bingkai (design.md bagian 2.3). */}
                <Image
                  src={gambar.src}
                  alt=""
                  width={gambar.w}
                  height={gambar.h}
                  className="relative z-10 -mb-10 h-24 w-auto self-center object-contain sm:-mb-12 sm:h-28 lg:h-32"
                />
                <div
                  className={`dome flex h-[126px] w-full flex-col justify-end pb-5 text-white sm:h-[140px] sm:pb-6 ${warna}`}
                >
                  <p className="tabular font-display text-[28px] font-bold sm:text-[34px] lg:text-[40px]">
                    <CountUp value={value} compact={compact} />
                  </p>
                  <p className="mt-0.5 text-sm font-medium sm:text-base lg:text-lg">
                    {label}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ---------------------------------------------------- platform */}
        <section className="relative overflow-hidden">
          {/* Di bawah lg pita panjang dimatikan — seksi yang menumpuk jadi
              terlalu tinggi dan pitanya hanya terbaca sebagai coretan. Pita
              pendek ini yang menggantikannya di layar sempit. */}
          <WaveBand className="absolute inset-x-0 bottom-0 h-[300px] w-full sm:h-[380px] lg:hidden" />

          <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-10 px-4 pt-14 pb-16 lg:grid-cols-2 lg:gap-16 lg:pb-24">
            <div className="text-center lg:text-left">
              <div className="flex items-center justify-center gap-2 lg:justify-start">
                <span className="h-px w-8 bg-brand" />
                <span className="text-xs font-medium text-brand-600">
                  Distribusi konten
                </span>
              </div>

              <h2 className="mt-3 font-display text-2xl font-bold lg:text-[2.15rem]">
                Tayang di mana saja
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted sm:text-base lg:mx-0">
                Untuk sekarang campaign berjalan di TikTok. Yang dihitung views
                dari tautan publik kontenmu, bukan jumlah pengikut akunmu.
              </p>

              {/* Ketiga layar dibingkai satu panel putih, bukan berdiri
                  sendiri di atas pita biru: bidang warna merek yang pekat
                  butuh permukaan netral supaya tidak beradu dengan biru
                  halaman. Panelnya memakai bahasa kartu sorotan Kontem
                  (rounded-3xl + shadow-float, design.md 2.3). */}
              <div className="mx-auto mt-7 max-w-md rounded-3xl bg-surface p-4 shadow-float sm:p-5 lg:mx-0">
                <ul className="grid grid-cols-3 gap-1.5 sm:gap-2">
                  {platform.map(({ nama, format, aktif, Logo, warna }) => (
                    <li
                      key={nama}
                      // Kanal yang sudah bisa dipakai diberi alas biru pucat —
                      // satu-satunya warna Kontem di kelompok ini, dan yang
                      // mengikat bidang merek yang ramai itu ke palet halaman.
                      className={cn(
                        "flex flex-col items-center rounded-2xl px-1.5 py-3 text-center sm:px-3",
                        aktif && "bg-brand-50",
                      )}
                    >
                      <PhoneScreen
                        layar={warna.layar}
                        tanda={warna.tanda}
                        aksen={warna.aksen}
                        active={aktif}
                        className="h-auto w-full max-w-[88px]"
                      />

                      <p className="mt-3 flex items-center gap-1.5 font-display text-sm font-semibold">
                        {/* Logo merek dipakai apa adanya: bentuk dan warna
                            aslinya, termasuk untuk kanal yang belum dibuka. */}
                        <Logo
                          className="h-3.5 w-3.5 flex-none"
                          style={{ color: warna.mark }}
                        />
                        {nama}
                      </p>
                      <p className="text-xs text-muted">{format}</p>
                      <span
                        className={cn(
                          "mt-2 rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap",
                          // Di atas kolom yang sudah beralas biru pucat,
                          // chip biru pucat hilang bentuknya — chipnya jadi
                          // putih supaya tetap terbaca sebagai chip.
                          aktif
                            ? "bg-surface text-brand-600 shadow-card"
                            : "bg-surface-muted text-muted",
                        )}
                      >
                        {aktif ? "Tersedia" : "Segera hadir"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <p className="mx-auto mt-7 flex max-w-md items-start gap-2 text-xs text-muted lg:mx-0">
                <IconEye className="mt-0.5 h-4 w-4 flex-none text-brand-600" />
                <span>
                  Angka views diambil berkala dari tautan yang kamu kirim, dan
                  terlihat sama oleh creator maupun vendor.
                </span>
              </p>
            </div>

            <Image
              src="/illustrations/cowo-konten.svg"
              alt="Creator merekam dirinya sendiri lewat ponsel"
              width={967}
              height={1450}
              className="mx-auto h-auto w-7/12 sm:w-5/12 lg:w-8/12"
            />
          </div>
        </section>
        </div>

        {/* ------------------------------------------------- cara kerja */}
        <section id="cara-kerja" className="bg-surface-muted py-16">
          <div className="mx-auto max-w-6xl px-4">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="font-display text-2xl font-bold lg:text-[2.15rem]">
                Cara kerjanya
              </h2>
              <p className="mt-2 text-sm text-muted sm:text-base">
                Sembilan langkah berurutan, dari vendor menyusun campaign sampai
                payout cair ke rekening creator.
              </p>
            </div>

            {/* Tiga baris subgrid: ilustrasi, kubah, penjelasan. Tanpa ini
                kubah yang judulnya dua baris jadi lebih tinggi dari
                tetangganya dan deretnya terlihat bergelombang.

                Di lg dibagi 5 + 4: grid 10 kolom, tiap langkah mengambil 2
                kolom, lalu langkah ke-6 digeser setengah petak (col-start 2)
                sehingga empat langkah terakhir tampil di tengah, bukan rata
                kiri dengan satu petak kosong menganga di kanan. */}
            <ol className="mt-12 grid gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-10 lg:grid-rows-[repeat(6,auto)] lg:gap-y-6">
              {langkah.map((item, i) => (
                <li
                  key={item.judul}
                  className={`flex flex-col lg:col-span-2 lg:row-span-3 lg:grid lg:grid-rows-subgrid lg:gap-0 ${
                    i === 5 ? "lg:col-start-2" : ""
                  }`}
                >
                  {/* Ilustrasi menumpang LANGSUNG di atas kubah, tanpa
                      lingkaran di belakangnya (design.md bagian 2.3) — tiap
                      aset sudah membawa gelembung birunya sendiri, jadi
                      lingkaran tambahan hanya jadi bidang kedua di baliknya.
                      Tingginya dipatok: bidang tiap langkah tetap seragam
                      meski isi gambarnya berbeda-beda. */}
                  <Image
                    src={item.gambar}
                    alt=""
                    width={1500}
                    height={1500}
                    className="relative z-10 -mb-9 mx-auto h-36 w-36 shrink-0 object-contain lg:-mb-12 lg:h-44 lg:w-44"
                  />
                  <div className="dome flex items-start gap-1.5 bg-brand-600 px-3.5 pt-12 pb-4">
                    <span className="tabular mt-px grid h-[18px] w-[18px] flex-none place-items-center rounded-full bg-white text-[11px] font-semibold text-brand-600">
                      {i + 1}
                    </span>
                    <p className="text-[13px] leading-snug font-semibold text-white">
                      {item.judul}
                    </p>
                  </div>
                  <p className="mt-3 px-1 text-[13px] leading-relaxed text-muted">
                    {item.isi}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ---------------------------------------------------- campaign */}
        <section
          id="campaign"
          className="bg-surface-sky py-16"
        >
          <div className="mx-auto max-w-6xl px-4">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="font-display text-2xl font-bold lg:text-[2.15rem]">
                Campaign yang sedang berjalan
              </h2>
              <p className="mt-2 text-sm text-muted sm:text-base">
                Setiap kartu menampilkan budget pool, tarif CPM, sisa slot, dan
                komplimen yang didapat creator sejak awal — tidak ada angka yang
                baru muncul setelah kamu ikut.
              </p>
              <p className="mt-4 text-sm text-body">
                Total nilai campaign yang dikelola dan dikunci di escrow{" "}
                <span className="tabular font-display font-bold text-brand-600">
                  {formatIDR(poolAgg._sum.budgetPool ?? 0)}
                </span>
              </p>
            </div>

            {katalog.length === 0 ? (
              <Card className="mx-auto mt-10 max-w-md p-10 text-center text-sm text-muted">
                Belum ada campaign berjalan.
              </Card>
            ) : (
              <>
                {/* Grid 2/3/4 kolom — design.md bagian 5.1. Empat kolom hanya
                    dipakai kalau kartunya memang cukup untuk mengisinya. */}
                {/* Empat kolom mulai xl — design.md bagian 5.1. Di lebar itu
                    tiga kolom membuat tiap kartu selebar ~370px, jauh lebih
                    besar daripada yang dibutuhkan tiga baris fakta. */}
                <div className="mt-10 grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-5 xl:grid-cols-4">
                  {katalog.map((campaign) => (
                    <CatalogCard
                      key={campaign.id}
                      href={`/creator/campaigns/${campaign.id}`}
                      judul={campaign.title}
                      vendor={
                        campaign.vendor.vendorProfile?.businessName ?? "Vendor"
                      }
                      kota={campaign.vendor.vendorProfile?.city ?? "—"}
                      kategori={categoryLabel[campaign.category]}
                      kategoriTone={categoryTone[campaign.category]}
                      budgetPool={campaign.budgetPool}
                      cpmRate={campaign.cpmRate}
                      maxCreators={campaign.maxCreators}
                      slotTerpakai={campaign._count.participations}
                      komplimen={campaign.complimentType}
                      sisaHari={daysUntil(campaign.endDate)}
                      foto={campaign.vendor.vendorProfile?.photos[0]}
                    />
                  ))}
                </div>

                {/* Tombol hanya muncul kalau memang ada campaign lain yang
                    belum tampil di sini. */}
                {campaignAktif > katalog.length ? (
                  <div className="mt-10 text-center">
                    <ButtonLink href="/creator/campaigns" size="lg">
                      Lihat semua campaign
                      <IconArrowRight className="h-4 w-4" strokeWidth={2.5} />
                    </ButtonLink>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </section>

        {/* ------------------------------------------------------- faq */}
        {/* Pita gradien brand-200 -> putih adalah satu-satunya gradien yang
            diizinkan sebagai latar seksi (design.md bagian 2.3 & 6.7): ia
            pemisah antar seksi, bukan hiasan kartu.

            Arahnya ke bawah, bukan ke atas seperti tertulis di design.md 6.7:
            di sana FAQ duduk sesudah seksi berlatar abu, sedangkan sekarang ia
            langsung menyambung seksi katalog yang berlatar biru pucat. Gradien
            yang memutih di ujung atas memotong bidang biru itu dengan garis
            terang; memulai dari biru membuat keduanya menyatu lalu meluruh ke
            putih menjelang footer. Ujung atasnya brand-100, bukan brand-200,
            karena nilainya praktis sama dengan --surface-sky milik seksi
            katalog — perpindahan seksinya jadi tidak berjejak sama sekali. */}
        <section
          id="faq"
          className="bg-gradient-to-b from-brand-100 to-surface py-16"
        >
          <div className="mx-auto max-w-6xl px-4">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="font-display text-2xl font-bold lg:text-[2.15rem]">
                Pertanyaan yang sering ditanyakan
              </h2>
              <p className="mt-2 text-sm text-muted sm:text-base">
                Hal yang paling sering ditanyakan creator dan pemilik usaha
                sebelum campaign pertamanya jalan.
              </p>
            </div>

            <div className="mx-auto mt-10 max-w-3xl rounded-3xl bg-surface-muted p-4 sm:p-6 lg:p-8">
              <Accordion items={faq} />
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
