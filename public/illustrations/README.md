# Ilustrasi halaman depan

Kecuali `clouds.webp` yang disediakan pemilik proyek, sumbernya
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

Kalau menambah ilustrasi baru, lakukan penggantian warna yang sama supaya satu
halaman tidak memakai dua palet sekaligus. Ikon di dalam gelembung memakai
path [lucide](https://lucide.dev) (MIT), pustaka ikon yang sama dengan antarmuka.

| Berkas | Dipakai di |
| :--- | :--- |
| `clouds.webp` | Pita awan penutup hero (disediakan sendiri, bukan dari unDraw) |
| `hero-konten-kreator.svg` | Panel hero — unDraw *Social influencer*, bidang blob latarnya dibuang dan diberi dua gelembung ikon (design.md bagian 2.3) |
| `platform-creator.svg` | Seksi "Tayang di mana saja" |
| `langkah-1-campaign.svg` … `langkah-5-payout.svg` | Seksi "Cara kerjanya" |
