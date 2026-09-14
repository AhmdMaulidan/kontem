/**
 * Bentuk dekoratif halaman depan.
 *
 * Dua bidang abstrak — pita gelombang pendek dan jalur roadmap sembilan
 * langkah — yang warnanya mengikuti token sehingga ditulis sebagai SVG
 * inline. Semua
 * ilustrasi bergambar, termasuk pita awan penutup hero, berupa berkas di
 * `public/illustrations/`. Lihat README di folder itu.
 */

/**
 * Pita gelombang biru muda yang melintang di belakang seksi platform.
 * Dua lapis dengan opasitas berbeda supaya terbaca punya kedalaman tanpa
 * memakai gradien.
 */
export function WaveBand({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1440 520"
      preserveAspectRatio="none"
      className={className}
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M0 150C260 60 520 220 760 300c220 72 420 30 680-50v120c-260 80-460 122-680 50C520 340 260 180 0 270z"
        fill="#BDE9F7"
      />
      <path
        d="M0 316C300 236 560 396 820 446c240 46 420 10 620-58v92H0z"
        fill="#BDE9F7"
        opacity="0.55"
      />
    </svg>
  );
}

/**
 * Pita panjang yang menyambung dari bawah pita awan sampai seksi "Tayang di
 * mana saja", melewati deret kubah angka di antaranya.
 *
 * `preserveAspectRatio="none"` dipakai dengan sengaja: pita meregang mengikuti
 * tinggi seksi, dan koordinat viewBox-nya memetakan lurus ke persentase kotak
 * pembungkusnya (x/1440, y/1400) — berguna kalau suatu saat ada elemen yang
 * perlu ditempelkan tepat di tepi pita.
 */
/**
 * Bentuk jalur roadmap untuk tiap jumlah langkah.
 *
 * Koordinatnya diukur di browser dari posisi kubah yang sebenarnya (lihat
 * komentar di dalam `RoadmapPath`): 9 langkah tersusun 5+4, 8 langkah 5+3, dan
 * 5 langkah muat satu baris.
 *
 * Jalur BERAKHIR di kubah terakhir: pada alur dua baris kubah itu selalu di
 * kolom PALING KIRI (baris kedua rata kiri, bukan rata kanan — jumlah langkah
 * tidak mengubahnya), dan pada alur satu baris di kolom paling kanan.
 *
 * Ketiganya memakai ATURAN YANG SAMA supaya lengkungnya seragam antar-tab:
 * belok di x=955, dan peralihan antarbaris berupa DUA BUSUR SEPEREMPAT
 * LINGKARAN (perintah SVG `A`) berjari-jari sama, disambung ruas tegak bila
 * jarak barisnya muat. Jari-jarinya dijepit setengah jarak antarbaris supaya
 * kedua busur selalu muat. Versi sebelumnya memakai Bezier berpegangan pendek
 * dengan titik belok berbeda per tab — itu yang membuat lengkungnya menyiku
 * dan tidak seragam.
 */
const JALUR: Record<number, { d: string; panah: string; tinggi: number }> = {
  // Ruas mendatar baris dua berakhir di x=53, yaitu TEPI KIRI kubah terakhir
  // (kolom 1 membentang 40..220, kubahnya `lg:w-[86%]` = 53..207), bukan di
  // pusatnya. Panahnya lalu berdiri di koridor x=27..53 yang disediakan
  // `lg:pl-[4%]` (x=0..40) — itulah gunanya koridor tersebut.
  //
  // Dua nilai yang sudah dicoba dan SALAH: x=224 membuat garis putus satu
  // kolom lebih awal sehingga panah berdiri terpisah; x=129 (pusat kubah)
  // membuat panah tertimbun kubahnya sendiri, karena SVG ini digambar DI
  // BELAKANG deret langkah.
  // Koordinat y DIPERBARUI setelah ruang deskripsi (`lg:pb-24`, 96px) dilepas
  // dari tiap <li> — deskripsinya kini melayang sebagai tooltip. Barisnya jadi
  // jauh lebih rapat, jadi y lama (174/513) akan jatuh di atas kubah.
  //
  // Nilai barunya TIDAK dikira-kira, melainkan diturunkan dari nilai lama yang
  // memang hasil pengukuran browser: karena `preserveAspectRatio="none"`, yang
  // menentukan hanyalah RASIO y terhadap tinggi seksi. Dari dua rasio lama
  // (174/660 dan 513/660) dan pb=96, gap=16 didapat tinggi konten tiap <li>
  // 189,3px dengan pusat kubah 154,7px dari atasnya; kedua angka itu tidak
  // berubah saat pb dilepas, sehingga rasio barunya bisa dihitung langsung.
  9: {
    tinggi: 660,
    d: "M123 259 L860 259 A95 95 0 0 1 955 354 L955 507 A95 95 0 0 1 860 602 L53 602",
    panah: "M53 588 L27 602 L53 616 Z",
  },
  8: {
    tinggi: 699,
    d: "M123 246 L860 246 A95 95 0 0 1 955 341 L955 512 A95 95 0 0 1 860 607 L53 607",
    panah: "M53 593 L27 607 L53 621 Z",
  },
  5: {
    // Satu baris: melepas pb=96 dari <li> setinggi konten 189,3px menaikkan
    // rasio y sebesar (189,3+96)/189,3 = 1,507, jadi 174 -> 262.
    tinggi: 341,
    d: "M123 262 L958 262",
    panah: "M958 248 L984 262 L958 276 Z",
  },
};

export function RoadmapPath({
  jumlah,
  className,
}: {
  /** Banyaknya langkah pada alur yang sedang tampil. */
  jumlah: number;
  className?: string;
}) {
  const bentuk = JALUR[jumlah];
  // Alur dengan jumlah langkah yang belum punya jalur tidak digambari apa pun,
  // daripada memakai jalur alur lain yang pasti meleset dari kubahnya.
  if (!bentuk) return null;

  return (
    <svg
      viewBox={`0 0 1000 ${bentuk.tinggi}`}
      preserveAspectRatio="none"
      className={className}
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Jalur roadmap: mengalir mendatar melewati baris pertama, membusur
          turun di tepi kanan bila ada baris kedua, lalu kembali ke kiri dan
          berakhir dengan panah yang menunjuk arah baris itu.

          Ruas mendatarnya melintas TEPAT DI TENGAH KUBAH; karena SVG ini
          digambar di belakang deret langkah, yang terlihat hanyalah ruas di
          sela antar-kubah. Itu yang membuat garisnya terbaca menyambung dari
          langkah pertama sampai terakhir.

          Koordinatnya diambil dari posisi kubah yang sebenarnya, diukur di
          browser, dan WAJIB diukur ulang setiap kali ukuran kubah, jarak
          baris, atau isi grid berubah — semuanya menggeser posisi kubah.

          `preserveAspectRatio="none"` membuat koordinat viewBox memetakan lurus
          ke persentase kotak pembungkus, jadi jalurnya tetap menempel pada
          deret kubah berapa pun tinggi seksinya. Peregangan itu ikut menarik
          tebal garis, maka `vectorEffect="non-scaling-stroke"` dipakai supaya
          garisnya tetap setebal yang ditulis. */}
      <defs>
        {/* Gradien mendatar melintasi seluruh lebar seksi: jalur menua dari
            biru muda di langkah pertama ke biru pekat di langkah terakhir,
            jadi arah perjalanannya terbaca dari warnanya saja. Ini salah satu
            tempat gradien yang diizinkan design.md bagian 2.3. */}
        <linearGradient
          id="jalurRoadmap"
          // `userSpaceOnUse`, bukan `objectBoundingBox` bawaan: alur satu baris
          // jalurnya lurus mendatar sehingga kotak batasnya bertinggi NOL, dan
          // gradien berbasis kotak batas merosot — badan jalurnya tidak
          // terlukis sama sekali, menyisakan marka putih melayang tanpa jalan.
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1="0"
          x2="1000"
          y2="0"
        >
          <stop offset="0%" stopColor="var(--brand-400)" />
          <stop offset="55%" stopColor="var(--brand-500)" />
          <stop offset="100%" stopColor="var(--brand-600)" />
        </linearGradient>

        {/* Mask singkap: marka putih dan chevron hanya terlihat di area yang
            sudah dilalui garis biru. Bentuknya salinan jalur yang sama,
            distroke putih (putih = terlihat dalam mask) dan dianimasikan
            persis seperti badan jalur biru, tapi SEDIKIT LEBIH LEBAR supaya
            tidak ada celah tipis di tepi.

            JANGAN memakai `vectorEffect="non-scaling-stroke"` di sini, beda
            dengan path yang terlihat. Mask dihitung di ruang koordinat viewBox
            yang sudah diregangkan `preserveAspectRatio="none"`, sedangkan
            non-scaling-stroke memaksa tebalnya ke piksel layar. Keduanya tidak
            sejajar, sehingga bidang singkapnya meleset dari jalur dan marka
            putih bocor terlihat di ruas yang BELUM dilalui garis — itu yang
            dulu terbaca sebagai titik mulai kedua di baris bawah.

            Tebalnya dinaikkan (26 badan -> 44) supaya setelah diregangkan
            vertikal tetap menutup penuh badan jalur tanpa celah tepi. */}
        <mask id="singkapRoadmap" maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height={bentuk.tinggi}>
          <path
            d={bentuk.d}
            fill="none"
            stroke="white"
            strokeWidth="44"
            className="roadmap-gambar"
            pathLength={1}
            strokeLinecap="butt"
          />
        </mask>
      </defs>

      {/* Badan jalur.
          `strokeLinecap` WAJIB `butt`, bukan `round`. Dengan
          `stroke-dasharray: 1; stroke-dashoffset: 1` pola dash-nya tergeser
          penuh, dan ujung membulat tetap dilukis pada dash sepanjang nol di
          KEDUA ujung jalur — sehingga di awal animasi muncul titik biru kedua
          di ujung akhir jalur (kubah terakhir baris dua), seolah jalurnya
          punya dua titik mulai. */}
      <path
        d={bentuk.d}
        fill="none"
        stroke="url(#jalurRoadmap)"
        strokeWidth="26"
        className="roadmap-gambar"
        pathLength={1}
        strokeLinecap="butt"
        vectorEffect="non-scaling-stroke"
      />

      <g mask="url(#singkapRoadmap)">
        {/* Garis putus-putus putih di tengah badan, seperti marka jalan.
            Panjang dash ditulis dalam satuan viewBox, BUKAN lewat `pathLength`:
            menyamakan panjang tiap jalur ke satu angka membuat satuan dash
            berbeda arti per alur, sehingga jalur yang lebih pendek bermarka
            rapat dan yang panjang renggang. */}
        <path
          d={bentuk.d}
          fill="none"
          stroke="white"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="22 30"
          className="roadmap-marka"
          opacity="0.95"
          vectorEffect="non-scaling-stroke"
        />

        {/* Kepala panah: satu ruas pendek diulang sepanjang jalur lewat
            `strokeDasharray`. Cara ini dipakai daripada menaruh polygon satu per
            satu karena posisinya ikut menyesuaikan sendiri kalau tata letaknya
            berubah. */}
        <path
          d={bentuk.d}
          fill="none"
          stroke="white"
          strokeWidth="11"
          strokeLinecap="butt"
          strokeDasharray="9 122"
          opacity="1"
          vectorEffect="non-scaling-stroke"
        />
      </g>

      {/* Panah penutup di ujung jalur. Digambar sebagai <path> berisi, bukan
          ujung garis, supaya bentuknya tidak ikut menipis saat viewBox
          diregangkan. */}
      <path
        d={bentuk.panah}
        fill="var(--brand-600)"
        className="roadmap-panah"
      />
    </svg>
  );
}

/**
 * Latar dekoratif seksi manfaat: siluet kepulauan Indonesia yang sangat pucat,
 * dilintasi garis putus-putus melengkung dan ditaburi titik penanda kota.
 *
 * Bentuk pulaunya SANGAT disederhanakan — ini elemen dekoratif, bukan peta
 * yang boleh dibaca sebagai data geografis. Karena itu ia `aria-hidden` dan
 * tidak diberi keterangan apa pun.
 *
 * Warnanya dari token dan pucat dengan sengaja: bidang ini duduk di belakang
 * daftar manfaat, jadi ia harus terbaca sebagai tekstur, bukan sebagai isi
 * yang bersaing dengan teksnya.
 */
export function PetaLatar({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1000 346"
      className={className}
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Garis pantai kepulauan Indonesia, diambil dari data Natural Earth
          (ne_110m_admin_0_countries, domain publik) lalu diproyeksikan
          equirectangular ke viewBox ini dan disederhanakan dengan
          Douglas-Peucker. Digambar dari data sungguhan, bukan dikira-kira:
          siluet Indonesia yang digambar tangan gampang terbaca salah bentuk.

          Tetap `aria-hidden` — ini tekstur latar, bukan peta yang dimaksudkan
          untuk dibaca sebagai informasi geografis. */}
      <g fill="var(--border)" opacity="0.85">
        <path d="M198.4 143.5 L202.1 158.8 L209.8 171.0 L225.8 172.9 L236.5 186.7 L231.0 213.9 L230.1 247.7 L205.9 248.2 L187.5 229.9 L159.4 212.1 L150.0 198.8 L133.5 181.0 L106.0 134.0 L86.8 115.8 L72.3 79.9 L52.6 66.2 L41.2 47.5 L24.7 35.2 L1.9 11.1 L0.0 0.0 L47.9 5.1 L67.3 26.5 L96.2 50.4 L116.9 73.9 L139.2 74.2 L157.5 89.2 L170.2 107.5 L186.8 117.5 L178.1 135.4 L190.6 143.0 L198.4 143.5 Z" />
        <path d="M999.3 176.6 L1000.0 319.1 L980.5 301.2 L958.3 296.8 L952.9 303.0 L925.2 303.7 L934.5 285.9 L948.3 279.8 L942.6 256.1 L932.1 237.7 L889.7 219.2 L871.7 217.4 L838.9 197.2 L832.4 207.8 L824.0 209.7 L819.0 201.7 L819.0 192.2 L802.3 181.5 L825.8 173.6 L841.4 174.0 L839.6 168.2 L807.6 168.2 L798.9 155.2 L779.4 151.1 L770.1 140.3 L799.6 135.0 L810.8 127.9 L845.9 136.9 L849.4 145.0 L855.5 180.3 L878.1 193.4 L896.4 170.2 L921.4 157.0 L940.9 157.0 L975.8 172.5 L999.3 176.6 Z" />
        <path d="M288.4 260.2 L291.4 268.0 L333.3 270.2 L338.1 261.1 L378.7 271.7 L386.7 285.8 L419.4 289.8 L446.3 302.8 L421.3 311.1 L397.3 302.3 L354.8 301.3 L334.3 297.4 L309.0 289.0 L293.0 286.9 L283.9 289.6 L244.0 280.6 L240.2 271.2 L220.2 269.6 L235.2 248.7 L261.7 250.0 L279.4 258.5 L288.4 260.2 Z" />
        <path d="M493.8 29.3 L481.4 49.1 L497.5 69.8 L493.7 79.8 L518.2 100.1 L492.3 102.7 L485.0 117.6 L486.0 137.4 L464.9 152.3 L464.4 174.1 L455.9 207.5 L452.7 199.8 L427.9 209.6 L419.2 196.2 L403.6 195.0 L392.7 188.0 L366.7 195.8 L358.8 185.3 L344.4 186.5 L326.4 183.9 L323.1 154.6 L312.2 148.5 L301.7 129.8 L298.6 110.7 L301.2 90.5 L314.2 75.9 L317.8 90.5 L332.8 102.9 L346.9 98.5 L360.8 100.0 L373.6 89.0 L384.1 87.1 L404.7 93.2 L422.6 88.5 L433.8 58.1 L442.2 50.5 L449.8 25.7 L474.9 25.7 L493.8 29.3 Z" />
        <path d="M604.2 100.7 L629.3 99.8 L650.9 83.9 L654.7 88.8 L637.2 110.4 L620.7 114.7 L599.7 110.4 L563.3 111.5 L544.2 114.6 L541.0 131.2 L560.6 150.6 L572.4 140.7 L613.2 133.3 L611.4 143.3 L601.9 140.2 L592.4 153.0 L573.1 161.4 L593.8 189.5 L589.8 197.0 L609.5 222.2 L609.3 236.6 L597.6 243.0 L589.0 235.3 L599.6 217.4 L578.2 225.9 L572.7 219.8 L575.6 211.4 L559.8 198.6 L561.4 177.2 L546.8 183.9 L549.6 240.7 L535.7 243.8 L526.3 237.4 L532.6 217.3 L529.2 196.2 L520.0 196.0 L513.2 181.1 L522.2 166.7 L525.4 149.4 L536.3 116.4 L540.9 107.4 L559.5 91.2 L576.6 97.6 L604.2 100.7 Z" />
        <path d="M569.5 306.4 L584.0 304.8 L603.6 296.8 L600.4 308.9 L567.6 315.1 L538.5 312.4 L538.4 304.4 L555.8 299.9 L569.5 306.4 Z" />
        <path d="M745.0 181.1 L769.1 187.4 L777.0 204.2 L758.6 195.1 L740.3 193.3 L728.0 194.8 L712.8 194.0 L718.0 182.0 L745.0 181.1 Z" />
        <path d="M502.1 302.6 L515.6 300.8 L521.1 310.1 L480.6 317.5 L468.9 317.3 L476.4 304.7 L488.4 304.5 L494.2 296.8 L502.1 302.6 Z" />
        <path d="M546.6 344.1 L517.6 328.8 L538.0 324.5 L557.1 337.8 L555.8 343.7 L546.6 344.1 Z" />
        <path d="M648.8 314.2 L651.0 318.5 L651.4 325.2 L637.1 341.5 L618.4 346.3 L615.8 343.7 L617.8 336.2 L627.2 322.9 L648.8 314.2 Z" />
        <path d="M713.6 72.3 L715.1 84.2 L728.0 86.1 L730.1 95.0 L729.0 114.2 L717.7 112.0 L714.4 125.3 L723.4 136.9 L717.2 139.5 L708.4 125.6 L701.9 97.7 L706.3 80.2 L713.6 72.3 Z" />
        <path d="M690.5 202.7 L675.3 198.7 L671.1 189.3 L693.2 188.2 L698.6 195.4 L690.5 202.7 Z" />
        <path d="M850.8 270.5 L848.7 254.1 L857.1 238.8 L862.1 245.2 L862.1 255.7 L850.8 270.5 Z" />
      </g>

      {/* Titik penanda sembilan kota, diproyeksikan dari koordinat
          sebenarnya dengan rumus yang sama seperti garis pantainya. */}
      <g fill="var(--muted)" opacity="0.45">
        <circle cx="74" cy="41" r="4" />
        <circle cx="207" cy="185" r="4" />
        <circle cx="253" cy="256" r="4" />
        <circle cx="270" cy="271" r="4" />
        <circle cx="382" cy="278" r="4" />
        <circle cx="436" cy="309" r="4" />
        <circle cx="471" cy="147" r="4" />
        <circle cx="528" cy="232" r="4" />
        <circle cx="993" cy="175" r="4" />
      </g>

      {/* Garis putus-putus melengkung antar-kota, memberi kesan jangkauan
          yang menyebar. Sengaja tipis supaya tidak menarik mata lebih dari
          daftar manfaat di depannya. */}
      <g
        fill="none"
        stroke="var(--muted)"
        opacity="0.35"
        strokeWidth="1.6"
        strokeDasharray="5 7"
        strokeLinecap="round"
      >
        <path d="M74 41 Q140 92 207 185" />
        <path d="M207 185 Q230 213 253 256" />
        <path d="M253 256 Q317 246 382 278" />
        <path d="M382 278 Q409 285 436 309" />
        <path d="M471 147 Q499 181 528 232" />
        <path d="M528 232 Q760 129 993 175" />
      </g>
    </svg>
  );
}

/**
 * Pita gelombang panjang yang membungkus seksi angka dan seksi manfaat, dan
 * tempat keempat kartu figur berdiri.
 *
 * Bentuknya dari rujukan: datang dari kanan atas di samping seksi angka, turun
 * tegak di sisi kanan, menyapu di bawah daftar manfaat, naik ke puncak di kiri,
 * lalu keluar dari tepi kiri. Pita MENGITARI peta — turun di luar tepi kanannya
 * dan menyapu di bawahnya — dan tidak pernah melintasinya.
 *
 * viewBox-nya dalam PIKSEL kolom konten (1120 x tinggi wadah), jadi titiknya
 * bisa dibaca langsung dari tata letak.
 *
 * Jalurnya DIRANCANG dari BUSUR LINGKARAN ASLI (perintah SVG `A`, bukan
 * pendekatan Bezier) yang disambung searah garis singgungnya:
 *   - kanan atas: masuk mendatar di y=64, busur r=110 turun ke x=1085;
 *   - sisi kanan: SATU garis lurus di x=1085. Versi sebelumnya menggeser
 *     landai dari 1085 ke 1055 di tengah ruas ini; pergeseran itu terbaca
 *     sebagai garis tegak yang goyah, bukan lurus.
 *   - kanan bawah: busur r=260 ke dasar di y=985;
 *   - kiri: busur r=130 naik, lalu busur r=110 melewati puncak (kartu merah)
 *     dan terus turun keluar dari tepi kiri.
 * Dua busur kiri sengaja bersambung tanpa ruas tegak: ruas tegak di antaranya
 * yang dulu membuat tanjakan terlihat patah.
 * Menyambung belasan titik dengan Catmull-Rom sudah dicoba dan ditolak: jarak
 * titik yang tak rata membuat lengkungnya bergelombang dan patah-patah. Ujung-ujungnya ditarik jauh melewati
 * kotak supaya di layar lebar pun pita terbaca datang dan pergi dari tepi
 * layar.
 *
 * POSISI KARTU FIGUR dan CHIP di `page.tsx` dihitung dari kurva ini. Kalau `d`
 * diubah — atau tinggi seksi angka/manfaat berubah dan jalurnya ikut digeser —
 * posisi kartu dan chip WAJIB dihitung ulang, atau kartunya melayang lepas.
 */
export function PitaManfaat({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1120 1199"
      preserveAspectRatio="none"
      // Lengkungnya sengaja melewati batas viewBox. Overflow bawaan SVG
      // `hidden` akan memangkasnya jadi potongan datar dan tegak; batas
      // akhirnya dipegang `overflow-hidden` wadah pembungkus.
      overflow="visible"
      className={className}
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M2600 64 L1195 64 A110 110 0 0 0 1085 174 L1085 725 A260 260 0 0 1 825 985 L230 985 A130 130 0 0 1 100 855 A110 110 0 0 0 -87.8 777.2 L-900 1589"
        fill="none"
        stroke="var(--brand-100)"
        // Sedikit transparan atas permintaan pemilik produk: pita setebal ini
        // di warna penuh terbaca sebagai bidang, bukan latar.
        strokeOpacity="0.7"
        // Tebal dalam PIKSEL, tidak ikut diregangkan viewBox.
        strokeWidth="74"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/**
 * Garis putus-putus penghubung kartu figur dengan chip ikonnya.
 *
 * Memakai sistem koordinat yang sama dengan `PitaManfaat` (piksel kolom konten
 * x tinggi wadah), jadi keduanya dipasang di kotak yang sama. Warnanya abu
 * netral dan tipis seperti garis antar-kota di peta: ia penghubung, bukan
 * elemen yang boleh bersaing dengan chip berwarna di ujungnya.
 */
export function GarisFigur({
  garis,
  titik,
  className,
}: {
  garis: string[];
  /** Titik lokasi di peta tempat tiap garis berakhir. */
  titik: { x: number; y: number; warna: string }[];
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 1120 1199"
      preserveAspectRatio="none"
      overflow="visible"
      className={className}
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
    >
      <g
        fill="none"
        stroke="var(--muted)"
        strokeOpacity="0.5"
        strokeWidth="1.6"
        strokeDasharray="5 6"
        strokeLinecap="round"
      >
        {garis.map((d) => (
          <path key={d} d={d} vectorEffect="non-scaling-stroke" />
        ))}
      </g>
      {/* Penanda lokasi berwarna di ujung garis, bercincin putih supaya
          terpisah dari siluet peta di belakangnya. */}
      {titik.map((t) => (
        <circle
          key={`${t.x}-${t.y}`}
          cx={t.x}
          cy={t.y}
          r="6"
          fill={t.warna}
          stroke="var(--surface)"
          strokeWidth="2.5"
        />
      ))}
    </svg>
  );
}
