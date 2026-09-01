# 🔐 VLMRS Tool

Secure client-side multi-file encoder & decoder dengan enkripsi AES-256-GCM. Semua proses berjalan di browser, file Anda tidak pernah meninggalkan perangkat.

## ✨ Fitur Utama

- 🛡️ **Enkripsi AES-256-GCM** dengan PBKDF2 key derivation (100.000 iterasi)
- 📁 **Multi-file support** — encode/decode banyak file sekaligus
- 🔒 **Metadata terenkripsi** — nama file, timestamp, dan hash tersembunyi dari mata-mata
- ✅ **Integritas terverifikasi** — SHA-256 hash memastikan file tidak korup
- 📦 **Bulk download** — simpan semua file sebagai ZIP atau unduh satu per satu
- 👁️ **Preview file** — lihat gambar, video, audio, PDF, dan teks sebelum download
- 📊 **History operasi** — lacak aktivitas encode/decode (tersimpan di IndexedDB)
- 🎨 **UI modern** — dark-mode friendly, responsive, dan intuitif
- 🔄 **Drag & drop** — cukup seret file ke halaman

## 🛠️ Instalasi Lokal

### Prasyarat
- Web browser modern (Chrome, Firefox, Safari, Edge)
- Git (opsional, untuk clone)
- Tidak perlu Node.js atau server — cukup buka file HTML langsung!

### Langkah Instalasi

#### Metode 1: Git Clone (Recommended)

```bash
# Clone repository
git clone https://github.com/valmortheos/VlmrsTool.git

# Masuk ke direktori
cd VlmrsTool

# Buka di browser default
# Windows
start index.html

# macOS
open index.html

# Linux
xdg-open index.html
```

#### Metode 2: Download ZIP

1. Klik tombol **Code** → **Download ZIP** di GitHub
2. Extract file ZIP ke folder manapun
3. Buka `index.html` dengan double-click

#### Metode 3: Local Server (Opsional)

Jika ingin menggunakan local server (lebih direkomendasikan untuk development):

```bash
# Menggunakan Python 3
python -m http.server 8080

# Atau menggunakan Node.js
npx serve .

# Lalu buka di browser
# http://localhost:8080
```

> 💡 **Tip**: Metode 1 atau 2 sudah cukup untuk penggunaan normal. Local server hanya diperlukan jika ingin development atau testing.

## 🚀 Cara Pakai

### Encode
1. Buka tab **Encoder**
2. Drop file (atau klik untuk browse) — bisa multiple
3. Masukkan password kuat
4. Klik **Encode All Files**
5. Download hasilnya — individual atau ZIP

### Decode
1. Buka tab **Decoder**
2. Drop file `.vlmrs`
3. Masukkan password yang sama
4. Klik **Decode & Preview All**
5. Preview dan download file asli

## 🔧 Struktur File

```
vlmrs-tool/
├── index.html      # Markup utama
├── style.css       # Styling
├── script.js       # Logika encode/decode
└── README.md
```

## 📐 Format VLMRS

```
Header (15 bytes)
├── Magic: "VLMR" (4 bytes)
├── Version: 1 (1 byte)
├── Salt Length: 16 (1 byte)
├── IV Length: 12 (1 byte)
├── Encrypted Meta Length (4 bytes, LE)
└── Iterations (4 bytes, LE)

Payload
├── Salt (16 bytes)
├── IV (12 bytes)
├── Encrypted Metadata (AES-GCM)
└── File Ciphertext (AES-GCM)
```

## 🛡️ Keamanan

- **AES-256-GCM** menyediakan enkripsi + autentikasi
- **PBKDF2-HMAC-SHA-256** dengan 100.000 iterasi + salt unik per file
- **AAD terpisah** untuk metadata dan file mencegah tampering
- **Semua proses client-side** — zero upload, zero server
- **Metadata tersembunyi** — nama file, ukuran, dan info lainnya terenkripsi

> ⚠️ **Peringatan**: File > 200 MB dapat menyebabkan lag browser karena keterbatasan memori.

## 📦 Dependencies

- [JSZip](https://stuk.github.io/jszip/) — untuk bulk download ZIP (CDN)
- Sisanya vanilla JavaScript + Web Crypto API

## 🖥️ Browser Support

| Browser | Support |
|---------|---------|
| Chrome  | ✅      |
| Firefox | ✅      |
| Safari  | ✅      |
| Edge    | ✅      |

## 🤝 Kontribusi

Pull request selalu diterima! Untuk perubahan besar, buka issue dulu untuk diskusi.

## 📄 Lisensi

MIT — bebas dipakai, dimodifikasi, dan didistribusikan.

---

<div align="center">
  <sub>Dibuat dengan ❤️ oleh <a href="https://github.com/valmortheos">@valmortheos</a></sub>
</div>
