# Ilustrasi halaman depan

Kecuali `clouds.svg`, `image-hero.svg`, `tayangan.svg`,
`Creator.svg`, `Campaign.svg`, `Vendor.svg`, `Views.svg`, dan seluruh
`langkah-*.svg` yang disediakan pemilik proyek, sumbernya
[unDraw](https://undraw.co) — ilustrasi open source karya Katerina
Limpitsouni. Lisensinya mengizinkan pemakaian komersial **tanpa kewajiban
atribusi**, selama asetnya tidak didistribusikan ulang sebagai paket atau
dipakai melatih model AI.

Berkas di folder ini sudah **diwarnai ulang** ke palet Kontem, bukan versi
mentah dari unDraw:

| Warna asal unDraw | Diganti jadi | Alasan |
| :--- | :--- | :--- |
| `#6c63ff` (ungu primer) | `#0ea5e9` (`--brand-500`) | Warna primer mengikuti brand |
| `#7c26c0`, `#565388`, `#514e7f`, `#575988` | `#0369a1` / `#3b5a75` | Ungu pendamping digeser ke biru supaya tidak ada dua nada primer |
| `#ffd037`, `#ffab50`, `#ffd77c` | `#fabf18`, `#ffd45e` | Aksen kuning mengikuti `--accent-500` |
| `#f2f2f2`, `#f0f0f0` (abu latar) | `#ffffff` / dibuang | Bidang blob abu terbaca sebagai noda di atas panel biru hero |
| `#e6e6e6`, `#e4e4e4` | `#e7f1fb` | Abu netral digeser ke putih kebiruan agar sejalan dengan langit |
| `#d6d6e3` (lavender muda) | `#bcd9ef` / `#cfe3f5` | Ungu pucat ikut digeser ke biru muda |
| `#090814` (hitam pekat) | `#23303d` | Hitam pekat ditarik ke arah navy supaya sederet dengan `--foreground` |
| `#ccc`, `#cacaca` (garis bingkai) | `#bae6fd` (`--brand-200`) | Abu bingkai ikut token garis tepi bernuansa brand; `#e7f1fb` terlalu pucat untuk garis setipis ini |

Kalau menambah ilustrasi baru, lakukan penggantian warna yang sama supaya satu
halaman tidak memakai dua palet sekaligus. Ikon di dalam gelembung memakai
path [lucide](https://lucide.dev) (MIT), pustaka ikon yang sama dengan antarmuka.

| Berkas | Dipakai di |
| :--- | :--- |
| `clouds.svg` | Pita awan penutup hero (disediakan sendiri, bukan dari unDraw; bingkainya dirapatkan ke isi dan atribut `height` disamakan dengan tinggi viewBox — selisihnya dulu jadi pita transparan yang terbaca sebagai garis di bawah awan) |
| `langkah-1-campaign.svg` … `langkah-9-payout.svg` | Seksi "Cara kerjanya", satu berkas per langkah (disediakan pemilik proyek; kanvas persegi 1500×1500 dan isinya memenuhi kanvas, jadi bingkainya di halaman juga persegi) |
| `tayangan.svg` | Ilustrasi seksi "Tayang di mana saja" — menggantikan panel tiga kartu ponsel dan `cowo-konten.svg` yang dulu berdampingan di sana (disediakan pemilik proyek). Nama kanal dan status "Tersedia"/"Segera hadir" kini tergambar di dalam berkas, jadi saat Instagram atau YouTube dibuka gambarnya harus diganti — tidak cukup mengubah kode |
| `Creator.svg`, `Campaign.svg`, `Vendor.svg`, `Views.svg` | Ilustrasi di atas empat kubah angka (disediakan sendiri; viewBox tiap berkas dipotong ke isinya — kanvas aslinya 1500×1500 dengan isi yang tidak memenuhi, sehingga gambarnya tampil kecil kalau dipakai apa adanya) |
| `logo-biru.svg`, `logo-putih.svg` | Logo Kontem, dipakai lewat `<Logo>` di `components/ui/logo.tsx`. Biru untuk latar terang (nav halaman depan, kepala login, menu samping dasbor), putih untuk latar pekat (footer). Disediakan pemilik proyek. **viewBox dipotong ke isinya** (`58 328 1414 514`) — kanvas aslinya 1500×1125 dengan lockup di tengah, sehingga logonya tampil kecil dan berjarak besar kalau dipakai apa adanya |
| `image-hero.svg` | Panel hero (disediakan pemilik proyek, bukan dari unDraw — latarnya transparan sehingga menumpang langsung di atas panel biru; dimuat dengan `unoptimized` karena SVG tidak dilewatkan ke pengoptimal gambar Next) |
| `pesawat.svg` | Pesawat kertas berjejak putus-putus di atas pita awan hero, seolah baru menembus awan (disediakan pemilik proyek). Dirender SEBELUM `clouds.svg` dan awannya diberi `relative z-10`, supaya ekor jejaknya terbenam di dalam awan. **Bukan vektor sungguhan**: dua PNG (2157×729) tertanam sebagai base64, ±166 KB, hanya satu `<path>` — warnanya tidak bisa mengikuti token |
| `vektor-nilik.svg` | Dua figur yang mengintip dari tepi kiri panel FAQ (disediakan pemilik proyek). **Bukan vektor sungguhan**: isinya dua PNG 1024×1536 yang ditanam sebagai `data:` base64 di dalam bungkus `<svg>`, total ±486 KB — hanya ada satu elemen `<path>`. Akibatnya warnanya TIDAK bisa mengikuti token dan gambarnya pecah kalau ditampilkan lebih besar dari ukuran aslinya. Kalau nanti tersedia versi vektor betulan, berkas ini sebaiknya diganti |

## Peta Indonesia (`PetaLatar` di `src/app/illustrations.tsx`)

Garis pantai pada seksi manfaat **bukan** berkas di folder ini, melainkan SVG
inline yang koordinatnya diturunkan dari [Natural Earth](https://www.naturalearthdata.com/)
(`ne_110m_admin_0_countries`, **domain publik** — bebas dipakai komersial tanpa
atribusi, meski atribusi tetap dihargai).

Alurnya: GeoJSON → proyeksi equirectangular ke `viewBox` 1000×346 →
penyederhanaan Douglas-Peucker (epsilon 1,1) → 13 poligon pulau.

Kalau siluetnya perlu digambar ulang, ambil lagi dari sumber itu. **Jangan
menggambarnya dengan tangan** — sudah dicoba dan hasilnya tidak terbaca sebagai
Indonesia.

## Kartu figur seksi manfaat (`*-vektor.svg`)

`biru-vektor.svg`, `ungu-vektor.svg`, `merah-vektor.svg`, `kuning-vektor.svg` —
empat kartu figur dekoratif di penjuru seksi "Beragam manfaat". Disediakan
pemilik produk. Asetnya sudah membawa sudut membulat dan latar warnanya
sendiri, jadi dipasang apa adanya tanpa pembungkus.

## Ikon seksi manfaat (`27.svg`–`32.svg`)

Enam ikon daftar "Beragam manfaat", disediakan pemilik produk. Tiap berkas
sudah membawa kotak biru muda bersudut membulat, jadi dipasang tanpa pembungkus.
Pasangannya: 32 escrow, 27 tanpa minimum followers, 31 bayar sesuai views,
30 bukti kunjungan, 29 penolakan beralasan, 28 potongan 15%.
