# Duittrack - Aplikasi Manajemen Keuangan Pribadi (PWA)

**Duittrack** adalah aplikasi web pencatat dan pengelola keuangan pribadi modern dengan antarmuka bersih (*clean e-wallet UI*), sistem gamifikasi disiplin harian (*daily streak*), pelacak target impian (*savings goals*), budgeting bulanan, serta analisis arus kas interaktif.

Aplikasi ini dibangun dengan arsitektur **Client-Side Offline-First**: seluruh data keuangan tersimpan aman secara lokal di perangkat Anda menggunakan IndexedDB bawaan browser, tanpa memerlukan server database eksternal dan dapat digunakan tanpa koneksi internet.

---

## Fitur Utama

- **Pencatatan Transaksi Lengkap**: Mencatat pengeluaran (*expense*), pemasukan (*income*), tabungan (*saving*), dan transfer antar-dompet dengan keypad virtual, foto struk, dan kategori fleksibel.
- **Gamifikasi Daily Streak**: Melatih disiplin finansial harian layaknya Duolingo dengan pelacak api streak, level kedisiplinan, kalender riwayat, serta perlindungan *Streak Freeze*.
- **Multi-Dompet (Wallets)**: Kelola saldo tunai, rekening bank, dan dompet digital dalam satu tempat secara terpisah.
- **Target Impian (Savings Goals)**: Rencanakan target tabungan (seperti gadget, dana darurat, liburan), pantau progres persentase, dan catat riwayat alokasi tabungan.
- **Budgeting Bulanan Dinamis**: Tetapkan batas maksimal pengeluaran per kategori per bulan dengan indikator real-time (*Aman*, *Waspada*, *Overbudget*).
- **Analisis dan Statistik Interaktif**:
  - Grafik perbandingan arus kas (*Cashflow comparison bar chart*).
  - Diagram lingkaran alokasi belanja (*Category distribution donut chart*).
  - Rekomendasi dan insight finansial otomatis berbasis data pengeluaran.
- **Feed Aktivitas Sosial (Instagram-Style)**: Tampilan linimasa interaktif dengan fitur *double-tap to like*, komentar catatan, dan kartu tipografi visual.
- **Pencadangan dan Ekspor Data**:
  - Ekspor laporan keuangan ke format spreadsheet **Excel (.xlsx)** lengkap dengan format Rupiah.
  - Cadangkan (*Backup*) dan Pulihkan (*Restore*) seluruh database ke file **JSON**.
  - Reset data ke setelan awal pabrik (*Factory Reset*).
- **Progressive Web App (PWA)**:
  - Dapat diinstal di layar utama smartphone (Android/iOS) maupun komputer desktop layaknya aplikasi native.
  - Alarm dan notifikasi pengingat harian otomatis via Web Notifications / Service Worker.

---

## Teknologi yang Digunakan

| Kategori | Teknologi |
| :--- | :--- |
| **Framework UI** | [React 19](https://react.dev/) |
| **Bahasa Pemrograman** | [TypeScript (~5.8)](https://www.typescriptlang.org/) |
| **Bundler & Dev Server** | [Vite 6](https://vitejs.dev/) |
| **Styling & Design System**| [Tailwind CSS v4](https://tailwindcss.com/) (`@tailwindcss/vite`) |
| **Ikonografi** | [Lucide React](https://lucide.dev/) |
| **Animasi** | [GSAP 3](https://gsap.com/) |
| **Penyimpanan Lokal** | Browser [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) & LocalStorage (Offline-first) |
| **Ekspor Data** | [SheetJS (xlsx)](https://sheetjs.com/) |
| **Hosting & Deployment**| [Vercel](https://vercel.com/) (Dukungan SPA rewrite via `vercel.json`) |

---

## Persyaratan Sistem

Sebelum menjalankan aplikasi, pastikan komputer Anda telah terpasang:
- **Node.js**: Versi `18.x`, `20.x`, atau `22.x` (disarankan versi LTS terbaru). Unduh di [nodejs.org](https://nodejs.org/).
- **NPM**: Versi `9.x` atau lebih baru (biasanya terpasang bersama Node.js).
- **Peramban Web Modern**: Google Chrome, Microsoft Edge, Mozilla Firefox, atau Safari dengan dukungan IndexedDB & Service Worker aktif.

---

## Panduan Instalasi dan Menjalankan Secara Lokal

Ikuti langkah-langkah berikut secara berurutan di terminal Anda:

### 1. Clone Repository
```bash
git clone https://github.com/USERNAME_ANDA/duit-track.git
cd duit-track
```

### 2. Instalasi Dependensi
Unduh semua paket pustaka yang diperlukan:
```bash
npm install
```

### 3. Konfigurasi Environment (Opsional)
Aplikasi ini berjalan mandiri di sisi klien dan tidak membutuhkan file environment wajib. Namun, template environment telah disediakan:
```bash
# Salin file template ke .env.local jika diperlukan
cp .env.example .env.local
```

### 4. Konfigurasi Database
> [!NOTE]
> **Tidak ada instalasi database server yang diperlukan.**
> Database menggunakan **IndexedDB** bawaan browser yang secara otomatis diinisialisasi saat aplikasi pertama kali dimuat di peramban.

### 5. Menjalankan Server Pengembangan (Dev Mode)
Jalankan dev server Vite:
```bash
npm run dev
```
Buka browser Anda dan akses alamat:
```
http://localhost:3000
```

---

## Perintah NPM yang Tersedia

| Perintah | Deskripsi |
| :--- | :--- |
| `npm run dev` | Menjalankan server development lokal pada port `3000`. |
| `npm run build` | Mengompilasi kode sumber TypeScript dan Tailwind CSS ke bundle produksi di folder `dist/`. |
| `npm run preview` | Menjalankan preview lokal dari hasil build folder `dist/`. |
| `npm run lint` | Memeriksa tipe dan sintaks TypeScript tanpa menghasilkan output (`tsc --noEmit`). |

---

## Panduan Deployment ke Vercel

Proyek ini telah dikonfigurasi secara optimal untuk deployment instan ke **Vercel**:

1. Unggah (*push*) repositori Anda ke GitHub.
2. Buka dashboard [Vercel](https://vercel.com/) dan klik **"Add New..." > "Project"**.
3. Pilih repository GitHub Anda dan klik **"Import"**.
4. Vercel akan otomatis mengenali konfigurasi berikut:
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`
5. Klik **"Deploy"**. Dalam waktu kurang dari 1 menit, website Anda sudah aktif secara global dengan HTTPS gratis.

> File `vercel.json` sudah disediakan di root folder untuk menangani routing SPA (*rewrite rule*) agar tidak terjadi error 404 saat pengguna me-refresh halaman.

---

## Struktur Direktori Proyek

```text
duit-track/
├── public/                     # Aset publik statis
│   ├── assets/                 # Logo aplikasi
│   ├── manifest.json           # Konfigurasi PWA (Web App Manifest)
│   ├── pwa-icon.png            # Ikon PWA beresolusi tinggi
│   └── sw.js                   # Service worker untuk PWA & notifikasi lokal
├── src/                        # Kode sumber aplikasi
│   ├── assets/                 # Aset gambar internal
│   ├── components/             # Komponen halaman dan antarmuka
│   │   ├── CategoryIcon.tsx    # Ikon kategori dinamis
│   │   ├── Dashboard.tsx       # Tampilan beranda & saldo utama
│   │   ├── Goals.tsx           # Tampilan target impian & budgeting
│   │   ├── History.tsx         # Tampilan linimasa aktivitas & pencarian
│   │   ├── Profile.tsx         # Tampilan profil, dompet, backup & reset
│   │   ├── Statistics.tsx      # Tampilan grafik & analisis finansial
│   │   └── TransactionModal.tsx# Form modal catat transaksi
│   ├── db/                     # Lapisan database lokal
│   │   └── indexedDB.ts        # Inisialisasi & operasi CRUD IndexedDB
│   ├── utils/                  # Utilitas logika pembantu
│   │   ├── financeHelpers.ts   # Formatter Rupiah, kalkulasi saldo & tanggal
│   │   └── streakLogic.ts      # Logika perhitungan streak harian & freeze
│   ├── App.tsx                 # Root component & bottom navigation
│   ├── index.css               # Design system tokens & Tailwind CSS v4
│   ├── main.tsx                # Entry point React
│   └── types.ts                # Deklarasi TypeScript interfaces
├── .env.example                # Template variabel lingkungan
├── .gitignore                  # Berkas dan direktori yang diabaikan Git
├── index.html                  # Dokumen HTML utama
├── package.json                # Daftar dependensi dan script proyek
├── package-lock.json           # Kunci versi dependensi npm
├── PROGRESS.md                 # Catatan progres redesign tampilan
├── tsconfig.json               # Konfigurasi TypeScript compiler
├── vercel.json                 # Konfigurasi rewrite SPA di Vercel
└── vite.config.ts              # Konfigurasi Vite bundler
```

---

## Privasi dan Keamanan Data

- Seluruh data transaksi, nominal, nama dompet, dan foto struk tersimpan **hanya di peramban lokal Anda**.
- Tidak ada data keuangan yang dikirim ke server pihak ketiga mana pun.
- Untuk mengamankan data, manfaatkan fitur **Cadangkan Data (JSON)** di menu Profil secara berkala.

---

## Lisensi

Proyek ini dibuat untuk keperluan manajemen keuangan pribadi. Bebas dikembangkan dan dimodifikasi sesuai kebutuhan.
