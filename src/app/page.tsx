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
  IconTrend,
  IconVideo,
  IconWallet,
  Logo,
} from "@/components/ui";
import { categoryLabel, categoryTone } from "@/lib/labels";
import { LandingNav } from "./landing-nav";
import { GarisFigur, PetaLatar, PitaManfaat, WaveBand } from "./illustrations";
import { AlurSwitch } from "./alur-switch";
import { HeroSlider, type SlideHero } from "./hero-slider";

/**
 * Judul dan deskripsi hero yang bergantian.
 *
 * Slide pertama berbicara ke PEMILIK USAHA, dua berikutnya ke KREATOR — hero
 * halaman depan dilihat keduanya, dan satu kalimat tidak bisa menjanjikan hal
 * yang tepat untuk dua sisi sekaligus.
 *
 * Tiap klaim di sini WAJIB punya dasar di produk: escrow, tarif CPM, bukti
 * kunjungan, dan tanpa minimum followers semuanya aturan yang benar-benar
 * berlaku (design.md bagian 1 dan 4). Jangan menambah janji yang tidak ada
 * mekanismenya.
 */
const SLIDE_HERO: SlideHero[] = [
  {
    judul: "Promosikan tempatmu lewat kreator lokal,",
    judulTekan: "bayar hanya sesuai views",
    deskripsi:
      "Dana promosi aman tersimpan, kreator wajib datang ke lokasi, dan kamu hanya membayar berdasarkan views yang benar-benar didapat.",
  },
  {
    judul: "Punya followers sedikit?",
    judulTekan: "Tetap bisa dapat penghasilan",
    deskripsi:
      "Tidak ada batas minimum followers. Penghasilanmu dihitung dari views yang terkumpul, bukan dari besarnya akunmu.",
  },
  {
    judul: "Gabung, datang,",
    judulTekan: "lalu buat kontennya",
    deskripsi:
      "Pilih campaign yang kamu suka, kunjungi tempatnya langsung, buat konten sesuai arahan, lalu kirim tautannya lewat Kontem.",
  },
];

/**
 * Sembilan langkah alur campaign, dari vendor menyusun sampai campaign tutup.
 *
 * Judul tiap langkah selalu menyebut pelakunya — vendor, admin, creator, atau
 * sistem — karena alurnya berpindah tangan beberapa kali; langkah tanpa pelaku
 * membuat pengunjung tidak tahu bagian mana yang jadi tanggung jawabnya.
 */
const langkah = [
  {
    judul: "Vendor buat campaign",
    isi: "Tentukan anggaran promosi, jumlah kreator yang diinginkan, dan arahan kontennya.",
    gambar: "/illustrations/langkah-1-campaign.svg",
  },
  {
    judul: "Admin setujui campaign",
    isi: "Setelah lolos peninjauan, campaign tayang dan bisa dilihat semua kreator.",
    gambar: "/illustrations/langkah-2-approve.svg",
  },
  {
    judul: "Kreator ikut campaign",
    isi: "Kreator memilih campaign yang cocok dan langsung bergabung. Siapa pun boleh ikut.",
    gambar: "/illustrations/langkah-3-join.svg",
  },
  {
    judul: "Kreator datang ke lokasi",
    isi: "Kreator mendatangi tempat usaha secara langsung untuk melihat sendiri apa yang akan diliputnya.",
    gambar: "/illustrations/langkah-4-lokasi.svg",
  },
  {
    judul: "Kreator kirim konten",
    isi: "Setelah konten diunggah ke media sosial, tautannya dikirim lewat formulir di Kontem.",
    gambar: "/illustrations/langkah-5-submit.svg",
  },
  {
    judul: "Konten ditinjau",
    isi: "Vendor dan admin memeriksa konten. Jika ditolak, alasannya selalu dijelaskan.",
    gambar: "/illustrations/langkah-6-review.svg",
  },
  {
    judul: "Views dilacak otomatis",
    isi: "Sistem memantau jumlah views secara berkala selama campaign masih berjalan.",
    gambar: "/illustrations/langkah-7-tracking.svg",
  },
  {
    judul: "Penghasilan dapat dicairkan",
    isi: "Penghasilan dari views yang sudah terkumpul bisa ditarik kapan saja tanpa menunggu campaign berakhir, selama sudah mencapai batas minimum penarikan.",
    gambar: "/illustrations/langkah-9-payout.svg",
  },
  {
    // "Campaign selesai" ditaruh PALING AKHIR atas permintaan pemilik produk:
    // campaign baru benar-benar tutup setelah payout cair, jadi langkah ini
    // menutup alurnya, bukan mendahului pencairan.
    judul: "Campaign selesai",
    isi: "Vendor menerima laporan ringkas: total jangkauan, jumlah konten, dan kreator dengan performa terbaik.",
    gambar: "/illustrations/langkah-8-hitung.svg",
  },
];

/**
 * Nama ikon -> komponennya, dipakai chip di garis kartu figur. Datanya
 * menyimpan nama, bukan komponen React,
 * dengan alasan yang sama seperti `nav-icons.tsx`: konstanta di berkas ini
 * boleh dibaca komponen mana pun tanpa memaksa berkasnya jadi Client
 * Component.
 */
function IkonManfaat({ nama }: { nama: keyof typeof IKON }) {
  const Ikon = IKON[nama];
  return <Ikon className="h-5 w-5" strokeWidth={2} />;
}

const IKON = {
  video: IconVideo,
  trend: IconTrend,
  pin: IconPin,
  wallet: IconWallet,
};

/**
 * Empat kartu figur dekoratif di penjuru seksi manfaat.
 *
 * Asetnya sudah bersudut membulat dengan latar warnanya masing-masing, jadi
 * dipasang apa adanya tanpa pembungkus. Ukurannya berbeda-beda dengan sengaja
 * supaya deretnya tidak terbaca sebagai grid — yang atas lebih kecil daripada
 * yang bawah, mengikuti kedalaman pada rujukan.
 *
 * Kelas posisinya ditulis lengkap, bukan dirangkai saat runtime, karena
 * Tailwind memindai kode sebagai teks.
 */
const KARTU_FIGUR = [
  // Titik PIJAK tiap kartu pada kurva `PitaManfaat`: x dalam piksel kolom
  // konten, y dalam persen tinggi wadah — sama dengan sistem viewBox pitanya.
  { src: "/illustrations/merah-vektor.svg", posisi: "left-[-10px] top-[62.14%]" },
  { src: "/illustrations/ungu-vektor.svg", posisi: "left-[400px] top-[82.15%]" },
  { src: "/illustrations/biru-vektor.svg", posisi: "left-[660px] top-[82.15%]" },
  { src: "/illustrations/kuning-vektor.svg", posisi: "left-[1085px] top-[58.38%]" },
];

/**
 * Chip ikon kecil yang menempel di kurva `GarisManfaat`.
 *
 * Pada rujukan, chip inilah yang membuat garis terbaca sebagai alur berisi —
 * bukan sekadar coretan. Isinya ikon yang mewakili kegiatan di platform
 * (konten video, lokasi, pembayaran), bukan hiasan acak.
 *
 * Posisinya dipatok pada titik-titik di sepanjang kurva; kalau kurvanya
 * diubah, posisi chip ikut disesuaikan. Kelasnya ditulis lengkap karena
 * Tailwind memindai kode sebagai teks.
 */
const CHIP_GARIS = [
  // Satu chip per kartu, WARNANYA MENGIKUTI KARTUNYA (merah-melon, kuning-mango,
  // ungu-violet, biru-azure) supaya pasangannya terbaca tanpa perlu dijelaskan.
  // Keempat token itu memang milik deret kubah angka; dipakai juga di sini atas
  // permintaan pemilik produk karena kartu figurnya sendiri berwarna sama.
  { ikon: "video" as const, posisi: "left-[110px] top-[58.72%]", warna: "bg-[color-mix(in_srgb,var(--stat-melon)_16%,var(--surface))] border-stat-melon/45 text-[color-mix(in_srgb,var(--stat-melon)_72%,var(--foreground))]" },
  { ikon: "pin" as const, posisi: "left-[1012px] top-[58.88%]", warna: "bg-[color-mix(in_srgb,var(--stat-mango)_16%,var(--surface))] border-stat-mango/45 text-[color-mix(in_srgb,var(--stat-mango)_72%,var(--foreground))]" },
  { ikon: "wallet" as const, posisi: "left-[492px] top-[74.48%]", warna: "bg-[color-mix(in_srgb,var(--stat-violet)_16%,var(--surface))] border-stat-violet/45 text-[color-mix(in_srgb,var(--stat-violet)_72%,var(--foreground))]" },
  { ikon: "trend" as const, posisi: "left-[752px] top-[75.15%]", warna: "bg-[color-mix(in_srgb,var(--stat-azure)_16%,var(--surface))] border-stat-azure/45 text-[color-mix(in_srgb,var(--stat-azure)_72%,var(--foreground))]" },
];

/**
 * Garis putus-putus dari pusat tiap kartu figur, menembus chip-nya, lalu
 * berlanjut sampai ke satu titik lokasi di peta — seperti rujukan, tiap figur
 * terhubung ke tempat yang diliputnya. Pangkalnya di pusat kartu dan tertutup kartu itu sendiri, jadi
 * garis terbaca keluar DARI kartu. Dihitung bersama `CHIP_GARIS`; kalau salah
 * satunya digeser, keduanya wajib dihitung ulang.
 */
const GARIS_FIGUR = [
  "M-10 717 Q50 704 110 704 Q200 710 300 714",
  "M1085 672 Q1048 683 1012 706 Q986 790 891 818",
  "M400 957 Q446 930 492 893 Q478 880 470 880",
  "M660 957 Q706 932 752 901 Q700 898 640 905",
];

/**
 * Titik lokasi di peta tempat tiap garis kartu berakhir — Medan, Jayapura,
 * Denpasar, dan Nusa Tenggara; tiga yang pertama diambil dari posisi titik kota
 * `PetaLatar` yang diukur di browser. Garisnya dirutekan lewat CELAH di antara
 * baris dan kolom daftar manfaat, dan titik ujungnya dipilih yang tidak
 * tertimpa teks. Warnanya mengikuti chip di garis yang sama. Makassar sengaja
 * dan Jakarta tidak dipakai: keduanya tertimpa ikon dan teks baris manfaat.
 */
const TITIK_PETA = [
  { x: 300, y: 714, warna: "var(--stat-melon)" },
  { x: 891, y: 818, warna: "var(--stat-mango)" },
  { x: 470, y: 880, warna: "var(--stat-violet)" },
  { x: 640, y: 905, warna: "var(--stat-azure)" },
];

/**
 * Enam manfaat yang ditampilkan di seksi "Kenapa lewat Kontem".
 *
 * Naskahnya dari pemilik produk. Tiga poin pertama manfaat bagi CREATOR, tiga
 * berikutnya bagi VENDOR — urutannya mengikuti itu, jangan diacak.
 *
 * Hanya judulnya yang ditampilkan; tidak ada penjelasan di bawahnya.
 */
const MANFAAT = [
  {
    gambar: "/illustrations/27.svg",
    judul: "Peluang Mendapatkan Penghasilan dari Konten",
  },
  {
    gambar: "/illustrations/28.svg",
    judul: "Mendapatkan Akses Campaign dari Bisnis Lokal",
  },
  {
    gambar: "/illustrations/32.svg",
    judul: "Membangun Portofolio dan Meningkatkan Kredibilitas",
  },
  {
    gambar: "/illustrations/31.svg",
    judul: "Promosi Lebih Efektif dan Terukur",
  },
  {
    gambar: "/illustrations/30.svg",
    judul: "Menjangkau Audiens Lokal yang Relevan",
  },
  {
    gambar: "/illustrations/29.svg",
    judul: "Menghasilkan Banyak Konten Organik untuk Brand",
  },
];

/**
 * Tiga alur yang bisa dipilih lewat switch di seksi "Alur Kerja Kontem".
 *
 * `bisnis` adalah alur penuh sembilan langkah, dipakai bersama `langkah` di
 * atas. `creator` dan `vendor` menceritakan alur yang sama dari sudut pandang
 * perannya masing-masing — naskahnya dari pemilik produk, bukan hasil
 * penyaringan otomatis, karena tiap peran melihat langkah yang berbeda.
 *
 * Ilustrasinya memakai kembali sembilan aset langkah yang ada, dipetakan ke
 * makna terdekat; satu aset boleh muncul di lebih dari satu alur.
 *
 * SELURUH alur tidak lagi menyebut kode redeem, kunjungan fisik, maupun
 * kuota slot (keputusan pemilik produk): kreator submit konten langsung dari
 * halaman campaign, siapa pun boleh ikut tanpa batas jumlah peserta. Model
 * `RedeemCode` dan field `maxCreators` sudah dihapus dari skema.
 */
const ALUR_CREATOR = [
  {
    judul: "Cari campaign",
    isi: "Lihat campaign yang sedang berjalan, saring berdasarkan kota, kategori, atau besaran anggarannya.",
    gambar: "/illustrations/langkah-1-campaign.svg",
  },
  {
    judul: "Ikut campaign",
    isi: "Bergabung ke campaign, lalu terima arahan konten: sudut pengambilan, durasi minimum, dan hal yang wajib tampil.",
    gambar: "/illustrations/langkah-3-join.svg",
  },
  {
    judul: "Kunjungi lokasi",
    isi: "Datangi tempat usahanya secara langsung untuk melihat sendiri apa yang akan kamu liput.",
    gambar: "/illustrations/langkah-4-lokasi.svg",
  },
  {
    judul: "Buat konten",
    isi: "Buat konten video sesuai arahan yang diberikan, lalu unggah ke media sosialmu.",
    gambar: "/illustrations/langkah-2-approve.svg",
  },
  {
    judul: "Kirim tautan konten",
    isi: "Kirimkan tautan video TikTok, Instagram Reels, atau YouTube Shorts lewat formulir Kontem.",
    gambar: "/illustrations/langkah-5-submit.svg",
  },
  {
    judul: "Peninjauan admin",
    isi: "Admin memeriksa apakah konten sudah sesuai arahan dan akun yang mengirim sama dengan yang terdaftar.",
    gambar: "/illustrations/langkah-6-review.svg",
  },
  {
    judul: "Views dipantau",
    isi: "Sistem memantau jumlah views secara otomatis selama campaign masih berjalan.",
    gambar: "/illustrations/langkah-7-tracking.svg",
  },
  {
    judul: "Penghasilan cair",
    isi: "Penghasilan dari views yang sudah terkumpul bisa ditarik tanpa menunggu campaign berakhir, selama sudah mencapai batas minimum penarikan.",
    gambar: "/illustrations/langkah-9-payout.svg",
  },
];

const ALUR_VENDOR = [
  {
    judul: "Daftar & verifikasi",
    isi: "Lengkapi profil bisnis, lalu tunggu persetujuan dari admin.",
    gambar: "/illustrations/langkah-2-approve.svg",
  },
  {
    judul: "Buat campaign",
    isi: "Tentukan anggaran promosi, tarif per 1.000 views, arahan konten, dan periode tayangnya.",
    gambar: "/illustrations/langkah-1-campaign.svg",
  },
  {
    judul: "Tinjau konten",
    isi: "Setujui atau tolak konten yang masuk. Setiap penolakan wajib disertai alasan.",
    gambar: "/illustrations/langkah-6-review.svg",
  },
  {
    judul: "Pantau performa",
    isi: "Lihat total views, sisa anggaran, dan performa tiap kreator secara langsung di dashboard.",
    gambar: "/illustrations/langkah-7-tracking.svg",
  },
  {
    judul: "Campaign selesai",
    isi: "Dapatkan laporan ringkas: total jangkauan, jumlah konten, dan kreator dengan performa terbaik.",
    gambar: "/illustrations/langkah-8-hitung.svg",
  },
];

const ALUR = [
  { id: "bisnis", label: "Alur Lengkap", langkah },
  { id: "creator", label: "Kreator", langkah: ALUR_CREATOR },
  { id: "vendor", label: "Pemilik Usaha", langkah: ALUR_VENDOR },
];

/**
 * Isi FAQ halaman depan. Jawabannya mengikuti aturan main yang benar-benar
 * berlaku di sistem (escrow, largest remainder, fee 3%, bukti kunjungan) —
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
      "Tidak ada. Siapa pun yang punya akun media sosial aktif boleh ikut campaign. Yang dibayar adalah views yang benar-benar tercipta, bukan jumlah pengikut akunmu.",
  },
  {
    pertanyaan: "Bagaimana penghasilan creator dihitung?",
    jawaban:
      "Dasarnya tarif CPM: setiap 1.000 views dihargai sesuai tarif yang dipasang vendor. Kalau total tagihan seluruh creator melebihi budget pool, pool dibagi proporsional menurut kontribusi views masing-masing, dibulatkan dengan metode largest remainder supaya jumlahnya genap sampai rupiah terakhir.",
  },
  {
    pertanyaan: "Berapa potongan platform Kontem?",
    jawaban:
      "3% dan dipotong hanya dari pembayaran yang benar-benar diterima creator. Tidak ada biaya pendaftaran, baik untuk creator maupun vendor.",
  },
  {
    pertanyaan: "Kenapa creator harus datang ke lokasi dulu?",
    jawaban:
      "Supaya kontennya benar-benar dibuat di tempat, bukan dari materi orang lain. Kreator cukup datang, melihat sendiri suasananya, lalu membuat konten di sana. Kesesuaian konten dengan lokasi diperiksa admin saat peninjauan.",
  },
  {
    pertanyaan: "Bagaimana kalau konten saya ditolak vendor?",
    jawaban:
      "Vendor wajib memilih kategori pelanggaran brief dan menuliskan alasannya; penolakan tanpa alasan tidak bisa dikirim. Alasan penolakan itu bisa kamu lihat di halaman Submission Saya supaya tahu bagian mana yang perlu diperbaiki untuk campaign berikutnya.",
  },
  {
    pertanyaan: "Kapan payout dicairkan?",
    jawaban:
      "Kamu tidak perlu menunggu campaign berakhir. Penghasilan dari views yang sudah terkumpul bisa ditarik kapan saja selama sudah mencapai batas minimum penarikan, dan admin mengirimkannya ke rekening atau e-wallet yang terdaftar di profilmu. Di akhir periode, angka views dikunci dan sisa bagianmu dihitung final.",
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
        where: { status: "APPROVED" },
      }),
      // Delapan campaign aktif dengan pool terbesar — dua baris penuh pada
      // grid empat kolom. Yang sudah lewat tenggat tidak ikut: kartunya akan
      // mengajak bergabung ke campaign yang sudah tutup.
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
              <HeroSlider slides={SLIDE_HERO} />
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

          {/* Pesawat kertas menanjak ke kanan atas di atas pita awan.
              Dilukis DI DEPAN `clouds.svg`, bukan di belakangnya.

              Percobaan sebelumnya menaruhnya di belakang (pita awan diberi
              `relative z-10`) supaya ekornya terbenam di awan. Itu SALAH:
              `clouds.svg` satu berkas utuh yang juga memuat bidang awan biru
              pucat di bagian atasnya, jadi menaikkan gambar itu ikut menutupi
              ekor jejak pesawat dengan bidang biru — bukan dengan awan putih.
              Memisahkan keduanya mustahil tanpa memecah berkasnya.

              Ekornya sengaja dimulai tepat di garis awan putih, sehingga
              jejaknya tetap terbaca muncul DARI awan.

              Ditambatkan ke tepi bawah seksi dengan lebar relatif, jadi
              posisinya terhadap pita awan tidak berubah walau tinggi hero ikut
              berubah mengikuti panjang teks slide.

              Hanya mulai md: di ponsel pita awannya jauh lebih pendek dan
              pesawatnya akan menabrak tombol ajakan. */}
          <Image
            src="/illustrations/pesawat.svg"
            alt=""
            width={1476}
            height={500}
            aria-hidden
            className="pointer-events-none absolute bottom-24 left-[56%] z-10 hidden h-auto w-[26%] max-w-[320px] select-none md:block lg:bottom-28"
          />

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

        {/* Seksi angka dan seksi platform berbagi satu wadah berlatar putih.
            Latarnya `bg-surface`, bukan `bg-background`: dasar halaman depan
            memang putih (design.md bagian 2.1 — `--background` itu dasar
            dasbor), dan abu kebiruan #f8fafc terlihat sebagai bidang berbeda
            begitu bertemu putih pita awan di atasnya. */}
        <div className="relative overflow-hidden bg-surface">
          {/* Pita gelombang panjang: datang dari kanan atas di samping seksi
              angka, turun tegak di sisi kanan, menyapu di bawah daftar manfaat,
              lalu naik ke kiri dan keluar dari tepi kiri — MENGITARI peta, tidak
              melintasinya. Karena itu ia tinggal di wadah yang membungkus kedua
              seksi, bukan di dalam seksi manfaat.

              Kotaknya selebar kolom konten (1120px) dan dipusatkan, bukan
              selebar layar: kartu figur harus berdiri di garis dan sejajar
              dengan daftar manfaat berapa pun lebar layarnya. Garisnya sendiri
              tetap menjangkau tepi layar lewat `overflow="visible"`, dan batas
              akhirnya dipegang `overflow-hidden` wadah ini.

              Hanya mulai xl — di bawah itu kolomnya lebih sempit dari 1120px
              dan kartu figurnya tidak punya ruang di samping daftar. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-1/2 hidden w-[1120px] -translate-x-1/2 xl:block"
          >
            <PitaManfaat className="absolute inset-0 h-full w-full" />
            <GarisFigur garis={GARIS_FIGUR} titik={TITIK_PETA} className="absolute inset-0 h-full w-full" />

            {/* Kartu figur berdiri di garis: pusat mendatarnya di titik pijak,
                kakinya sedikit masuk ke pita. */}
            {KARTU_FIGUR.map((k) => (
              <Image
                key={k.src}
                src={k.src}
                alt=""
                width={1500}
                height={1500}
                className={`absolute h-[104px] w-[104px] -translate-x-1/2 -translate-y-[85%] object-contain ${k.posisi}`}
              />
            ))}

            {/* Chip ikon berwarna di ujung garis kartunya. Latarnya satu warna
                PEKAT (token dicampur putih lewat color-mix), bukan warna transparan
                di atas `bg-surface`: dua kelas latar bertabrakan dan yang menang
                ditentukan urutan stylesheet, dan garis putus-putus tembus kalau
                latarnya transparan. */}
            {CHIP_GARIS.map((c) => (
              <span
                key={c.ikon}
                className={`absolute grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-xl border shadow-card ${c.warna} ${c.posisi}`}
              >
                <IkonManfaat nama={c.ikon} />
              </span>
            ))}
          </div>

        {/* ------------------------------------------------------- angka */}
        <section className="relative z-10 mx-auto max-w-6xl px-4 pt-6 pb-16 text-center">
            <h2 className="font-display text-xl font-bold sm:text-2xl">
              Dipercaya kreator dan pelaku usaha lokal
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-sm text-muted sm:text-base">
              Satu platform yang mempertemukan pemilik usaha dan kreator lokal —
              transparan, aman, dan semua angka bisa dilihat kedua pihak.
            </p>

          <div className="mt-10 flex flex-wrap justify-center gap-4 xl:gap-8">
            {angka.map(({ gambar, value, compact, label, warna }) => (
              <div
                key={label}
                className="flex w-[120px] flex-col sm:w-[158px] lg:w-[186px]"
              >
                {/* Ilustrasi menumpang di atas kubah dengan tinggi dipatok —
                    rasio unDraw yang berbeda-beda diseragamkan oleh tinggi
                    tetap, bukan oleh bingkai (design.md bagian 2.3). */}
                <Image
                  src={gambar.src}
                  alt=""
                  width={gambar.w}
                  height={gambar.h}
                  className="relative z-10 -mb-5 h-[76px] w-auto self-center object-contain sm:-mb-6 sm:h-[88px] lg:h-[100px]"
                />
                <div
                  className={`dome flex h-[100px] w-full flex-col justify-end pb-4 text-white sm:h-[112px] sm:pb-5 ${warna}`}
                >
                  <p className="tabular font-display text-[22px] font-bold sm:text-[27px] lg:text-[32px]">
                    <CountUp value={value} compact={compact} />
                  </p>
                  <p className="mt-0.5 text-xs font-medium sm:text-sm lg:text-base">
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

          <div className="relative z-10 mx-auto max-w-6xl px-4 pt-14 pb-16 lg:pb-24">
            <div className="text-center">
              <div className="flex items-center justify-center gap-2">
                <span className="h-px w-8 bg-brand" />
                <span className="text-xs font-medium text-brand-600">
                  Kenapa Kontem
                </span>
              </div>

              <h2 className="mx-auto mt-3 max-w-xl font-display text-2xl leading-tight font-bold lg:text-[2.15rem]">
                Kenapa harus lewat Kontem?
              </h2>
            </div>

            {/* Peta duduk di belakang daftar, bukan di sampingnya: di contoh
                rujukan justru tumpang-tindih itu yang membuat seksinya terasa
                lapang. Disembunyikan di bawah lg — pada satu kolom, daftar
                manfaat menutupi hampir seluruh peta sehingga ia hanya jadi
                beban render. */}
            <div className="relative mt-10 lg:mt-14">
              {/* Peta ditambatkan ke baris manfaat dan dibatasi `max-w-4xl`: pita
                  gelombang mengitarinya dari luar (turun di kanan, menyapu di
                  bawah), jadi peta tidak boleh melebar sampai ke jalur pita. */}
              <PetaLatar className="pointer-events-none absolute top-1/2 left-1/2 hidden h-auto w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 opacity-70 lg:block xl:top-[187px]" />

              {/* Lebar kolom mengikuti ISI (`w-fit` + `grid-cols-[auto_auto]`), bukan
                  dipatok `max-w-3xl`: judulnya pendek-pendek, sehingga kolom
                  berlebar tetap menyisakan ruang kosong di kanan dan seluruh
                  blok terbaca condong ke kiri walau wadahnya sudah `mx-auto`.

                  `grid-flow-col` + `grid-rows-3`: grid mengisi MENURUN per kolom,
                  jadi kolom kiri memuat tiga manfaat creator (poin 1-3) dan kolom
                  kanan tiga manfaat vendor (4-6) — pengelompokan naskahnya jadi
                  terbaca. Urutan di DOM tetap 1-6, jadi pembaca layar tetap
                  menyusurinya berurutan. */}
              <ul className="relative mx-auto grid w-fit gap-x-10 gap-y-6 sm:grid-flow-col sm:grid-rows-3 sm:grid-cols-[auto_auto] xl:gap-x-24 xl:pt-4 xl:pb-[165px]">
                {MANFAAT.map((m) => (
                  <li key={m.judul} className="flex items-center gap-3.5">
                    {/* Ikon manfaat berupa berkas SVG yang SUDAH membawa kotak
                        biru muda bersudut membulat, jadi tidak dibungkus kotak
                        lagi. Kotak di dalam berkasnya mengisi sekitar 78%
                        kanvas, maka gambarnya dipasang lebih besar dengan
                        margin negatif supaya kotak yang terlihat ~52px dan
                        teks di sampingnya tidak bergeser. */}
                    <Image
                      src={m.gambar}
                      alt=""
                      width={1500}
                      height={1500}
                      className="-m-2 h-[68px] w-[68px] flex-none"
                    />
                    {/* Lebar judul dibatasi supaya yang panjang MEMBUNGKUS dua baris:
                        tanpa batas ini daftar melebar sampai 52..1068 dan
                        menembus jalur pita di kiri dan kanannya. */}
                    <p className="max-w-[230px] font-display text-sm leading-snug font-semibold text-foreground sm:text-base">
                      {m.judul}
                    </p>
                  </li>
                ))}
              </ul>
            </div>

            <p className="mx-auto mt-10 flex max-w-md items-start justify-center gap-2 text-left text-xs text-muted">
              <IconEye className="mt-0.5 h-4 w-4 flex-none text-brand-600" />
              <span>
                Saat ini campaign berjalan di TikTok. Views diperbarui otomatis
                dari tautan yang kamu kirim, dan bisa dilihat oleh kreator
                maupun pemilik usaha.
              </span>
            </p>
          </div>
        </section>
        </div>

        {/* ------------------------------------------------- cara kerja */}
        <section id="cara-kerja" className="bg-surface-muted py-16">
          <div className="mx-auto max-w-6xl px-4">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-[11px] font-semibold tracking-[0.3em] text-brand-600 uppercase">
                Cara kerja
              </p>
              <h2 className="mt-1.5 font-display text-2xl font-bold text-brand-700 lg:text-[2.15rem]">
                Bagaimana Kontem Bekerja?
              </h2>
              <p className="mt-2.5 text-sm text-muted sm:text-base">
                Dari pembuatan campaign hingga penghasilan cair ke kreator — semuanya transparan.
              </p>
              <span className="mx-auto mt-4 block h-1 w-16 rounded-full bg-brand-300" />
            </div>

            <AlurSwitch alur={ALUR} />
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
                Campaign yang Sedang Berjalan
              </h2>
              <p className="mt-2 text-sm text-muted sm:text-base">
                Lihat anggaran promosi, tarif per 1.000 views, dan sisa waktu
                tiap campaign — semua info sudah tertera di awal, tanpa biaya tersembunyi.
              </p>
              <p className="mt-4 text-sm text-body">
                Total dana campaign yang diamankan platform:{" "}
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
                      creatorBergabung={campaign._count.participations}
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
        {/* `overflow-hidden`: figur FAQ digeser keluar tepi kiri panel, dan di
            lg terkecil ujungnya melewati kolom konten ~48px. Tanpa ini halaman
            jadi bisa digeser ke samping — dilarang design.md. */}
        <section
          id="faq"
          className="overflow-hidden bg-gradient-to-b from-brand-100 to-surface py-16"
        >
          <div className="mx-auto max-w-6xl px-4">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="font-display text-2xl font-bold lg:text-[2.15rem]">
                Pertanyaan yang Sering Diajukan
              </h2>
              <p className="mt-2 text-sm text-muted sm:text-base">
                Jawaban untuk hal-hal yang paling sering ditanyakan kreator
                dan pemilik usaha sebelum memulai campaign pertama.
              </p>
            </div>

            {/* Panel FAQ dengan dua figur yang MENGINTIP dari tepi kirinya.
                Pembungkus `relative` ini SELEBAR PANEL saja, jadi panelnya
                tetap di tengah kolom dan margin kiri-kanannya sama. Figurnya
                ditambatkan ke tepi panel lalu digeser KELUAR dengan nilai
                negatif (`lg:-left-40`), bukan diberi ruang lewat padding kiri
                pada pembungkus: padding itu menyusutkan panel sekaligus
                mendorongnya ke kanan, sehingga margin kirinya habis dimakan
                figur sementara margin kanannya tetap penuh.

                Figur hanya muncul mulai lg: di bawah itu panel memakai hampir
                seluruh lebar layar, jadi figurnya akan menimpa teks
                pertanyaan, bukan berdiri di sampingnya. */}
            <div className="relative mx-auto mt-10 max-w-3xl">
              <Image
                src="/illustrations/vektor-nilik.svg"
                alt=""
                width={1000}
                height={1500}
                // Ditambatkan ke ATAS panel (`top-0`) dengan tinggi tetap dalam
                // piksel. Keduanya perlu supaya figur benar-benar diam saat
                // jawaban FAQ dibuka-tutup:
                //   - tinggi persen (`h-[86%]`) membuatnya ikut membesar
                //     ~83px, karena panelnya memang berubah tinggi;
                //   - `bottom-0` membuatnya ikut TERDORONG TURUN, karena
                //     panel tumbuh ke bawah.
                // Dengan tambatan di atas, panel boleh tumbuh sepanjang apa
                // pun — yang bergerak hanya tepi bawahnya, persis seperti
                // rujukan.
                // Geserannya 177px, bukan angka bulat: TANGAN yang memegang
                // tepi panel ada di x≈0,78 lebar gambar, bukan di tepi
                // kanannya — sisa 22% kanvasnya kosong. Pada tinggi 340px
                // figur selebar 227px, jadi tangannya 177px dari tepi kiri
                // gambar. Kalau digeser kurang dari itu, tangannya masuk ke
                // dalam panel dan menutupi teks pertanyaan.
                //
                // Tingginya 340px, bukan 430px: pada 430px figur butuh 223px
                // sementara margin kiri kolom cuma 192px, jadi ujung kirinya
                // selalu terpotong `overflow-hidden` walau di layar lebar.
                className="pointer-events-none absolute top-0 hidden h-[340px] w-auto select-none object-contain object-top lg:-left-[177px] lg:block"
                priority={false}
              />
              <div className="rounded-3xl bg-surface-muted p-4 sm:p-6 lg:p-8">
                <Accordion items={faq} />
              </div>
            </div>
          </div>
        </section>

      </main>

      <footer className="bg-brand-600">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-10">
          <Logo variant="putih" className="h-9" />
          <p className="max-w-md text-sm text-white/90">
            Platform promosi lokasi yang menghubungkan UMKM dengan kreator
            lokal — transparan, aman, dan bayar sesuai hasil.
          </p>
        </div>
      </footer>
    </div>
  );
}
