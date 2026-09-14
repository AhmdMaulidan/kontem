"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Image from "next/image";
import { RoadmapPath } from "./illustrations";

export type Langkah = {
  judul: string;
  isi: string;
  gambar: string;
};

export type Alur = {
  id: string;
  label: string;
  langkah: Langkah[];
};

/**
 * Penempatan tiap langkah pada jalur roadmap: DUA BARIS, lima langkah di atas
 * dan empat di bawah, keduanya mulai dari tepi kiri tanpa petak kosong.
 *
 * Arahnya bolak-balik (boustrophedon): baris 1 dibaca kiri→kanan (1-2-3-4-5),
 * baris 2 kanan→kiri (6-7-8-9). Itu sebabnya langkah 6-9 dipasang terbalik di
 * grid — urutan tampilnya mengikuti jalur, bukan melawannya. Kalau baris kedua
 * dipaksa kiri→kanan, jalurnya harus melompat balik dari kanan ke kiri dan
 * garisnya pecah jadi dua potong, bukan satu perjalanan utuh.
 *
 * Kelasnya ditulis lengkap, bukan dirangkai saat runtime, karena Tailwind
 * memindai kode sebagai teks.
 */
const TATA_SEMBILAN = [
  "lg:col-start-1 lg:row-start-1",
  "lg:col-start-2 lg:row-start-1",
  "lg:col-start-3 lg:row-start-1",
  "lg:col-start-4 lg:row-start-1",
  "lg:col-start-5 lg:row-start-1",
  "lg:col-start-4 lg:row-start-2",
  "lg:col-start-3 lg:row-start-2",
  "lg:col-start-2 lg:row-start-2",
  "lg:col-start-1 lg:row-start-2",
];

/** Delapan langkah: lima di baris atas, tiga di baris bawah (dibalik). */
const TATA_DELAPAN = [
  "lg:col-start-1 lg:row-start-1",
  "lg:col-start-2 lg:row-start-1",
  "lg:col-start-3 lg:row-start-1",
  "lg:col-start-4 lg:row-start-1",
  "lg:col-start-5 lg:row-start-1",
  "lg:col-start-3 lg:row-start-2",
  "lg:col-start-2 lg:row-start-2",
  "lg:col-start-1 lg:row-start-2",
];

/**
 * Alur yang isinya lima langkah atau kurang muat dalam SATU baris, jadi tidak
 * perlu dibalik: semuanya dibaca kiri ke kanan.
 */
const TATA_SEBARIS = [
  "lg:col-start-1 lg:row-start-1",
  "lg:col-start-2 lg:row-start-1",
  "lg:col-start-3 lg:row-start-1",
  "lg:col-start-4 lg:row-start-1",
  "lg:col-start-5 lg:row-start-1",
];

/**
 * Berapa bagian panjang jalur yang sudah tergambar saat garisnya sampai di tiap
 * langkah — diukur dari `d` milik `PitaManfaat`/`JALUR` dengan menyusuri
 * kurvanya. Dipakai untuk menjadwalkan kemunculan kubah supaya PAS dengan
 * garisnya.
 *
 * Kalau bentuk jalur di `illustrations.tsx` diubah, angka ini wajib dihitung
 * ulang; kalau tidak, kubah dan garisnya kembali tidak sinkron.
 */
const PORSI_JALUR: Record<number, number[]> = {
  9: [0, 0.086, 0.168, 0.251, 0.333, 0.717, 0.8, 0.882, 0.965],
  8: [0, 0.085, 0.167, 0.249, 0.33, 0.801, 0.883, 0.965],
  5: [0, 0.224, 0.44, 0.655, 0.871],
};

/** Lama garis menggambar dirinya, sama dengan `.roadmap-gambar` di globals.css. */
const DURASI_GARIS = 1.5;

export function AlurSwitch({ alur }: { alur: Alur[] }) {
  const [aktif, setAktif] = useState(alur[0].id);

  /**
   * Animasi jalur dijalankan saat seksinya PERTAMA KALI terlihat, dan diulang
   * SETIAP KALI pilihan alur berganti — keduanya permintaan pemilik produk.
   *
   * `putaran` naik tiap kali tombol alur ditekan. Angkanya dipakai
   * sebagai `key` pada kotak jalur, sehingga React membuang elemen lama dan
   * memasang yang baru; itulah yang membuat animasi CSS benar-benar mulai dari
   * nol. Tanpa itu, kelas yang sudah menempel membuat animasinya tidak
   * berjalan lagi — `animation` hanya memicu saat elemen atau nilainya
   * berubah, bukan saat kelas yang sama dipasang ulang.
   */
  const [putaran, setPutaran] = useState(0);
  const [terlihat, setTerlihat] = useState(false);
  const wadah = useRef<HTMLDivElement>(null);

  /**
   * Langkah yang deskripsinya sedang dibuka dengan KETUKAN (indeksnya), atau
   * `null` kalau tidak ada.
   *
   * Hover saja tidak cukup: di ponsel dan tablet tidak ada hover sama sekali,
   * jadi deskripsinya akan mustahil dibaca. Hover ditangani CSS murni
   * (`group-hover`), sedangkan state ini khusus untuk ketukan — keduanya
   * berdampingan, bukan saling menggantikan.
   */
  const [dibuka, setDibuka] = useState<number | null>(null);

  // Ganti alur menutup deskripsi yang masih terbuka: indeksnya menunjuk
  // langkah milik alur lama, yang isinya sudah berbeda.
  const gantiAlur = (id: string) => {
    setAktif(id);
    setDibuka(null);
  };

  useEffect(() => {
    const el = wadah.current;
    if (!el) return;
    const pengamat = new IntersectionObserver(
      (entri) => {
        if (!entri[0].isIntersecting) return;
        setTerlihat(true);
        pengamat.disconnect();
      },
      { threshold: 0.25 },
    );
    pengamat.observe(el);
    return () => pengamat.disconnect();
  }, []);

  const terpilih = alur.find((a) => a.id === aktif) ?? alur[0];
  const n = terpilih.langkah.length;
  const tata = n === 9 ? TATA_SEMBILAN : n === 8 ? TATA_DELAPAN : TATA_SEBARIS;

  /**
   * Langkah 1-5 selalu menempati baris atas pada susunan dua baris (lihat
   * TATA_SEMBILAN / TATA_DELAPAN); sisanya baris bawah. Alur yang muat satu
   * baris tidak punya baris kedua sama sekali.
   *
   * Dipakai untuk menentukan ARAH panel deskripsi: baris atas membukanya ke
   * ATAS dan baris bawah ke BAWAH, supaya panel selalu mengarah ke ruang
   * kosong di luar deret — bukan menimpa baris di seberangnya.
   */
  const barisAtas = (i: number) => n > 5 && i < 5;

  return (
    <>
      {/* Switch alur: pil berlatar putih berisi tombol-tombol, yang aktif
          berlatar brand. `role="tablist"` dipakai supaya pembaca layar
          mengumumkannya sebagai pemilih tampilan, bukan sebagai daftar
          tautan biasa. */}
      <div
        role="tablist"
        aria-label="Pilih alur"
        className="mx-auto mt-6 flex w-fit max-w-full gap-1 overflow-x-auto rounded-full bg-surface p-1.5 shadow-card"
      >
        {alur.map((a) => {
          const dipilih = a.id === terpilih.id;
          return (
            <button
              key={a.id}
              role="tab"
              type="button"
              aria-selected={dipilih}
              onClick={() => {
                gantiAlur(a.id);
                // Ganti pilihan memulai animasi jalur dari awal lagi. Dinaikkan
                // di sini, bukan lewat efek: ini reaksi atas tindakan pengguna,
                // dan setState di dalam efek memicu render berantai.
                if (terlihat) setPutaran((p) => p + 1);
              }}
              className={`rounded-full px-4 py-2 text-[13px] font-semibold whitespace-nowrap transition-colors sm:px-6 sm:text-sm ${
                dipilih
                  ? "bg-brand-600 text-white"
                  : "text-muted hover:bg-brand-50 hover:text-brand-700"
              }`}
            >
              {a.label}
            </button>
          );
        })}
      </div>

      {/* Jalur roadmap digambar di belakang deret langkah, bukan di dalamnya:
          kubah berdiri di atas garis, dan garisnya hanya terlihat di sela-sela.
          Disembunyikan di bawah lg — begitu langkahnya menumpuk jadi satu atau
          dua kolom, jalur mendatar tidak lagi punya arti dan hanya jadi
          coretan. Bentuk jalurnya berbeda per alur — koordinatnya dihitung
          khusus untuk tiap susunan (9 langkah 5+4, 8 langkah 5+3, 5 langkah
          satu baris), jadi `RoadmapPath` diberi tahu jumlahnya. */}
      <div
        ref={wadah}
        key={putaran}
        className={`relative mt-8 lg:mt-4 ${terlihat ? "roadmap-jalan" : ""}`}
      >
        <RoadmapPath
          jumlah={n}
          className="pointer-events-none absolute inset-0 hidden h-full w-full lg:block"
        />

        {/* Lima kolom: baris pertama terisi penuh (langkah 1-5), baris kedua
            berisi empat langkah yang dipasang terbalik sehingga dibaca kanan
            ke kiri (6-9). Kolom pertama baris kedua kosong — di situ jalur
            membelok turun dari langkah 5. `lg:pr-[6%]` menyediakan koridor
            bagi busur peralihan di kanan, `lg:pl-[4%]` bagi panah penutup di
            kiri — tanpa itu panahnya tertimbun kubah langkah 9 yang menempel
            tepi. */}
        <ol className="relative grid gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-5 lg:gap-x-5 lg:gap-y-4 lg:pr-[6%] lg:pl-[4%]">
          {terpilih.langkah.map((item, i) => (
            <li
              key={item.judul}
              // Kolom dan pergeseran naik-turunnya dari tabel tata letak.
              // Urutan di DOM tetap 1-9, jadi pembaca layar dan keyboard
              // menyusurinya berurut walau di layar baris kedua berjalan
              // mundur; nomor pada tiap kubah yang menegaskan urutannya.
              className={`roadmap-kubah flex flex-col lg:h-full ${tata[i]}`}
              // Jeda tiap langkah = SAAT GARIS BENAR-BENAR SAMPAI di sana,
              // dihitung dari panjang jalur (lihat `PORSI_JALUR`), bukan
              // dibagi rata: baris pertama dan kedua dipisahkan tikungan balik
              // yang panjang, jadi pembagian rata membuat kubah baris kedua
              // tertinggal jauh di belakang garisnya.
              style={
                {
                  // Porsi jalur × durasi garis = saat garis SAMPAI di kubah.
                  // + 0.15 s menambah jeda kecil supaya garis terlihat TIBA
                  // DULU sebelum kubahnya muncul, menghindari kesan keduanya
                  // berebut muncul bersamaan.
                  "--tunda": `${(PORSI_JALUR[n]?.[i] ?? i / n) * DURASI_GARIS + 0.15}s`,
                } as CSSProperties
              }
            >
              {/* Ilustrasi menumpang LANGSUNG di atas kubah, tanpa lingkaran
                  di belakangnya (design.md bagian 2.3) — tiap aset sudah
                  membawa gelembung birunya sendiri, jadi lingkaran tambahan
                  hanya jadi bidang kedua di baliknya. Tingginya dipatok:
                  bidang tiap langkah tetap seragam meski isi gambarnya
                  berbeda-beda. */}
              <Image
                src={item.gambar}
                alt=""
                width={1500}
                height={1500}
                className="relative z-10 -mb-9 mx-auto h-36 w-36 shrink-0 object-contain lg:-mb-10 lg:h-36 lg:w-36"
              />
              {/* Kubah dipersempit (`lg:w-[86%]`) dan ditinggikan
                  (`lg:pt-14`) supaya bidangnya tegak, bukan lebar-pipih: pada
                  bentuk yang melebar, lengkung `.dome` jadi landai dan
                  kubahnya terbaca sebagai pita, bukan kubah.

                  Kubahnya <button>, bukan <div>: di layar sentuh deskripsi
                  dibuka dengan ketukan, dan hanya elemen yang bisa difokus
                  yang membuatnya terbaca pemakai keyboard. `group` dipakai
                  supaya hover pada kubah menampilkan panel yang jadi
                  saudaranya.

                  `relative` di sini, bukan di <li>: panel melayangnya
                  ditambatkan ke kubah, sedangkan <li> juga memuat ilustrasi
                  yang menjulang di atasnya. */}
              <div className="group relative mx-auto w-full lg:w-[86%]">
                <button
                  type="button"
                  // Ketukan hanya berlaku DI BAWAH lg. Mulai lg panelnya
                  // dibuka hover saja (permintaan pemilik produk), jadi klik
                  // di desktop tidak boleh meninggalkan panel yang menempel
                  // terbuka setelah kursor pergi.
                  onClick={() => {
                    if (window.matchMedia("(min-width: 1024px)").matches) return;
                    setDibuka((d) => (d === i ? null : i));
                  }}
                  aria-expanded={dibuka === i}
                  className="dome flex w-full items-start gap-1.5 bg-brand-600 px-3 pt-12 pb-4 text-left transition-colors hover:bg-brand-700 focus-visible:ring-4 focus-visible:ring-brand-100 focus-visible:outline-none lg:flex-col lg:items-center lg:gap-2 lg:px-4 lg:pt-14 lg:pb-5"
                >
                  <span className="tabular mt-px grid h-[18px] w-[18px] flex-none place-items-center rounded-full bg-white text-[11px] font-semibold text-brand-600 lg:h-[22px] lg:w-[22px] lg:text-[12px]">
                    {i + 1}
                  </span>
                  <p className="text-[13px] leading-snug font-semibold text-white lg:flex lg:min-h-[2.6em] lg:items-center lg:text-center">
                    {item.judul}
                  </p>
                </button>

                {/* Panel deskripsi yang melayang di luar kubah.
                    `absolute` supaya tidak memakan ruang baris — tinggi grid
                    tetap sama apakah panelnya terbuka atau tidak, jadi jalur
                    roadmap tidak melar-menyusut mengikuti isi panel.
                    Ruang bekas deskripsi sudah DILEPAS dari baris supaya
                    seksinya tidak menyisakan pita kosong; koordinat y pada
                    `JALUR` sudah diperbarui mengikuti baris yang lebih rapat
                    itu (lihat komentarnya di `illustrations.tsx`).

                    ARAHNYA mengikuti baris (permintaan pemilik produk):
                    baris atas membuka KE ATAS, baris bawah KE BAWAH. Dengan
                    begitu panel selalu mengarah ke ruang kosong di luar
                    deret, bukan menimpa baris di seberangnya.

                    Panel yang ke atas dipasang `bottom-full` dan ber-z-30:
                    ilustrasi langkah menjulang 104px di atas kubah dengan
                    z-10, jadi z-20 saja masih tertimbun olehnya. Konsekuensi
                    yang disengaja: selama hover, panel baris atas menutupi
                    ilustrasi langkah itu sendiri — ilustrasinya kembali
                    terlihat begitu kursor pergi.

                    Dua cara membukanya, dipisah per lebar layar:
                    - mulai lg: HOVER saja (`lg:group-hover:opacity-100`),
                      plus fokus keyboard supaya tetap terjangkau Tab;
                    - di bawah lg: KETUKAN (`dibuka`), karena layar sentuh
                      tidak punya hover sama sekali. */}
                <div
                  role="tooltip"
                  className={`pointer-events-none absolute inset-x-0 z-30 rounded-xl bg-surface p-3 text-left text-[13px] leading-relaxed text-body opacity-0 shadow-float transition-opacity duration-200 group-focus-within:opacity-100 lg:group-hover:opacity-100 ${
                    barisAtas(i) ? "bottom-full mb-3" : "top-full mt-3"
                  } ${dibuka === i ? "opacity-100" : ""}`}
                >
                  {/* Panah penunjuk ke kubah: bujur sangkar yang diputar 45°
                      dan setengahnya tersembunyi di balik badan panel.
                      Dibuat begini, bukan dengan border-trick, supaya
                      warnanya ikut token `bg-surface` yang sama dengan
                      panelnya — satu tempat kalau warnanya berubah.
                      Sisinya ikut arah panel: panel di atas kubah berpanah di
                      bawah, dan sebaliknya. */}
                  <span
                    aria-hidden
                    className={`absolute left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 rounded-[2px] bg-surface ${
                      barisAtas(i) ? "-bottom-1.5" : "-top-1.5"
                    }`}
                  />
                  {item.isi}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </>
  );
}
