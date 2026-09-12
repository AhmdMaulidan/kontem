# Ilustrasi halaman depan

Kecuali `clouds.svg`, `image-hero.svg`, `cowo-konten.svg`,
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
| `cowo-konten.svg` | Ilustrasi seksi "Tayang di mana saja" (disediakan sendiri) |
| `Creator.svg`, `Campaign.svg`, `Vendor.svg`, `Views.svg` | Ilustrasi di atas empat kubah angka (disediakan sendiri; viewBox tiap berkas dipotong ke isinya — kanvas aslinya 1500×1500 dengan isi yang tidak memenuhi, sehingga gambarnya tampil kecil kalau dipakai apa adanya) |
| `image-hero.svg` | Panel hero (disediakan pemilik proyek, bukan dari unDraw — latarnya transparan sehingga menumpang langsung di atas panel biru; dimuat dengan `unoptimized` karena SVG tidak dilewatkan ke pengoptimal gambar Next) |
