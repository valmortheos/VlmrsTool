VLMRS Tool 🔐

Secure Client-Side File Encoder & Decoder

Aplikasi web untuk enkripsi dan dekripsi file secara lokal di browser. Menggunakan AES-256-GCM dengan PBKDF2 key derivation, tanpa mengirim data ke server.

✨ Fitur Utama

· 🔒 Enkripsi end-to-end menggunakan Web Crypto API
· 👁️ Preview file sebelum dienkripsi dan setelah didekripsi
· 🛡️ Header terautentikasi untuk mencegah manipulasi metadata
· 📱 Responsive, bekerja di desktop maupun mobile
· 🚫 100% client-side, tanpa backend

🚀 Penggunaan

Encode:

1. Buka index.html di browser
2. Pilih tab Encoder
3. Upload file dan preview akan muncul
4. Masukkan password lalu klik Encode File

Decode:

1. Pilih tab Decoder
2. Upload file .vlmrs
3. Masukkan password dan klik Decode & Preview
4. Download file hasil dekripsi jika diperlukan

📦 Format VLMRS

```
Header (authenticated):
- Magic "VLMR" (4 bytes)
- Version, salt length, IV length
- Metadata JSON (filename, type, size, KDF params)

Payload:
- Ciphertext AES-256-GCM + Auth Tag
```

🛠️ Teknologi

· HTML5, CSS3, Vanilla JavaScript (ES6+)
· Web Crypto API untuk enkripsi native
· Tanpa dependencies eksternal

🔧 Menjalankan

```bash
https://github.com/valmortheos/VlmrsTool.git
cd VlmrsTool
python -m http.server 8000
```

Atau langsung buka index.html di browser.

⚠️ Catatan

· Keamanan bergantung pada kekuatan password
· Tidak ada pemulihan password yang hilang
· File besar (>500MB) mungkin lambat karena pemrosesan di memori

📄 Lisensi

MIT License

---

Dibuat dengan fokus pada privasi dan keamanan data pengguna.
