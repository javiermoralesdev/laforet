<div align="center">

# 🌲 Laforet

**A quiet, zero-knowledge, end-to-end encrypted personal diary.**  
*Because your deepest thoughts belong to no one else.*

[![SolidJS](https://img.shields.io/badge/SolidJS-1.9-2c4f7c?style=flat-square&logo=solid)](https://www.solidjs.com/)
[![PocketBase](https://img.shields.io/badge/PocketBase-0.28-b8db57?style=flat-square&logo=pocketbase&logoColor=black)](https://pocketbase.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Web Crypto API](https://img.shields.io/badge/Crypto-AES--GCM%20256-darkgreen?style=flat-square)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg?style=flat-square)](https://www.gnu.org/licenses/gpl-3.0)
[![Docker Ready](https://img.shields.io/badge/Docker-Single%20Container-blue?style=flat-square&logo=docker)](https://www.docker.com/)

[Features](#-features) • [Why Carmen Laforet?](#-the-name) • [Security & Cryptography](#-how-the-cryptography-works) • [Quick Start](#-quick-start) • [Docker Deployment](#-docker-deployment) • [Testing](#-testing)

</div>

---

## 📖 The Name

> *"Unos la ven como un bosque; otros, como un laberinto..."*

**Laforet** is named in honor of Spanish novelist **Carmen Laforet** (1921–2004), author of the classic novel *Nada* (Premio Nadal, 1944). Her writing gave voice to intimate, unvarnished human truth — the inner monologues, quiet yearnings, and private contemplations that people keep tucked away from the rest of the world.

This project is built to be a safe, inviolable digital counterpart to that private space: a tranquil clearing where you can write freely, knowing no algorithm, server administrator, or third party can ever peer into your pages.

---

## ✨ Features

- 🔒 **Zero-Knowledge Encryption**: All titles and diary entries are encrypted on your device using the native **Web Crypto API** before ever being transmitted over the network.
- 🧠 **Memory-Only Key Storage**: The encryption key is derived locally in memory during your active session. It is never written to `localStorage`, session storage, or cookies, and it is wiped immediately on sign-out.
- 🐦 **Cryptographic Canary Verification**: Unlocks your vault seamlessly by testing the key against an encrypted canary token (`vaultCheck`) without exposing sensitive data.
- ✍️ **Markdown Editor with Live Preview**: Draft your reflections with full Markdown support, clean typography, and a toggleable preview tab.
- 🌍 **Bilingual by Nature**: Native internationalization in **English** and **Spanish** with an instant in-app language switcher.
- 🛡️ **Invite-Only / Closed Signups**: Control user registration with a single environment flag (`VITE_DISABLE_SIGNUPS`), enforced both on the frontend UI and guarded on the PocketBase server via a backend hook.
- ⚡ **Blazing Fast Reactive UI**: Built with [SolidJS](https://solidjs.com) for fine-grained reactivity and minimal JavaScript overhead.
- 🐳 **All-in-One Deployment**: Ships as a single, lightweight multi-stage Docker container serving both the PocketBase backend and the compiled SolidJS frontend.

---

## 🔐 How the Cryptography Works

Laforet follows a strict **zero-knowledge, client-side encryption** model:

```
[ User Password ] + [ Salt: User ID ]
                │
                ▼
     PBKDF2 (SHA-256, 100,000 iterations)
                │
                ▼
        [ AES-GCM 256-bit Key ]
         (Kept in memory only)
                │
    ┌───────────┴───────────────────────────┐
    ▼                                       ▼
[ Encrypt Entry ]                     [ Unlock Vault ]
- Generate random 12-byte IV           - Attempt decrypting user's `vaultCheck`
- Encrypt title & markdown body        - If successful: key retained in memory
- Format: `ivHex:ciphertextHex`        - If failed: access denied
    │
    ▼
[ Stored in PocketBase Database ]
(Server only ever sees random hex strings)
```

1. **Key Derivation**: When you sign up or unlock your vault, your password and your unique User ID (salt) are fed into **PBKDF2** with 100,000 iterations using **SHA-256**, deriving an **AES-GCM 256-bit** key.
2. **Deterministic Canary Check**: On signup, a canary string (`"success"`) is encrypted with your key and stored in your user record as `vaultCheck`. When unlocking your vault on subsequent visits, the client verifies your password by attempting to decrypt this canary.
3. **Unique Initialization Vectors**: Every single entry is encrypted with its own cryptographically secure, pseudo-random 12-byte Initialization Vector (IV). Even if two entries share the exact same content, their stored ciphertexts will look completely different.
4. **Server Blindness**: PocketBase only receives and stores the combined string `<iv_hex>:<ciphertext_hex>`. Without your password, the database contains only mathematically unrecoverable noise.

> [!WARNING]
> **There is no "Forgot Password" link.**  
> Because encryption keys are never sent to or stored on the server, losing your vault password means your entries are **permanently unrecoverable**. Always keep a secure backup of your master password.

---

## 🚀 Quick Start

### Prerequisites

- [Bun](https://bun.sh/) (recommended) or [Node.js](https://nodejs.org/) (v18+)
- [PocketBase](https://pocketbase.io/docs/) executable

### 1. Clone the repository

```bash
git clone https://github.com/javiermoralesdev/laforet.git
cd laforet
```

### 2. Install dependencies

```bash
bun install
# or: npm install
```

### 3. Start the PocketBase backend

In one terminal, start your local PocketBase server:

```bash
./pocketbase serve --http=127.0.0.1:8090
```

> **Note**: Database schema migrations (`pb_migrations/`) and backend hooks (`pb_hooks/`) are automatically applied on startup.

### 4. Configure environment variables

Create a `.env` file in the root directory (or use the provided defaults):

```env
VITE_PB_HOST=http://127.0.0.1:8090
VITE_DISABLE_SIGNUPS=false
```

### 5. Launch the development server

In a second terminal, start Vite:

```bash
bun run dev
# or: npm run dev
```

Open your browser at `http://localhost:5173`. Create your account, remember your password, and begin writing!

---

## 🐳 Docker Deployment

Laforet is packaged as a single self-contained image that bundles both the SolidJS frontend and the PocketBase server.

### Run with Docker CLI

```bash
docker build -t laforet .

docker run -d \
  -p 8090:8090 \
  -v laforet_data:/pb/pb_data \
  -e PB_ADMIN_EMAIL=admin@example.com \
  -e PB_ADMIN_PASSWORD=your_secure_password_here \
  -e VITE_DISABLE_SIGNUPS=false \
  --name laforet-app \
  laforet
```

Your diary is now live at `http://localhost:8090`. The PocketBase admin dashboard can be accessed at `http://localhost:8090/_/`.

### Run with Docker Compose

Create a `docker-compose.yml` file:

```yaml
version: "3.8"

services:
  laforet:
    build: .
    container_name: laforet
    restart: unless-stopped
    ports:
      - "8090:8090"
    environment:
      # Optional: Automatically provisions a superuser on first boot
      PB_ADMIN_EMAIL: "admin@example.com"
      PB_ADMIN_PASSWORD: "change_this_super_secret_password"
      # Set to "true" to lock down new registrations
      VITE_DISABLE_SIGNUPS: "false"
    volumes:
      - laforet_data:/pb/pb_data

volumes:
  laforet_data:
```

Launch the stack:

```bash
docker compose up -d
```

---

## ⚙️ Configuration Reference

| Variable | Scope | Default | Description |
| :--- | :--- | :--- | :--- |
| `VITE_PB_HOST` | Client (Dev) | `http://127.0.0.1:8090` | PocketBase host URL for local Vite development. In Docker, the frontend uses relative paths automatically. |
| `VITE_DISABLE_SIGNUPS` | Client & Server | `false` | When set to `true`, disables the registration form in the UI and rejects record creation via `pb_hooks/disable_signups.pb.js`. |
| `PB_ADMIN_EMAIL` | Server (Docker) | *unset* | PocketBase superuser email to create/upsert upon container startup. |
| `PB_ADMIN_PASSWORD` | Server (Docker) | *unset* | PocketBase superuser password (minimum 10 characters). |

---

## 🧪 Testing

Laforet includes both cryptographic unit tests and browser-based end-to-end tests:

### Cryptographic Unit Tests (Vitest)

Verifies PBKDF2 key derivation, AES-GCM encryption/decryption, wrong-password rejection, and unique IV generation:

```bash
bun test
# or: npm test
```

### End-to-End Tests (Playwright)

Executes the full user journey (Registration/Login, Vault Unlock, Markdown Entry Creation, Dashboard Verification, and Deletion):

```bash
npx playwright test
```

---

## 🛠️ Project Structure

```
laforet/
├── Dockerfile               # Multi-stage build (Bun SPA builder + Alpine PocketBase)
├── entrypoint.sh            # Injects runtime config & upserts superuser
├── pb_hooks/                # PocketBase server hooks (signup restriction)
├── pb_migrations/           # PocketBase database schema definitions
├── public/                  # Static assets & icons
├── src/
│   ├── i18n/                # Internationalization dictionaries (EN, ES)
│   ├── lib/
│   │   ├── crypto.ts        # Web Crypto PBKDF2 & AES-GCM implementation
│   │   ├── crypto.test.ts   # Cryptography test suite
│   │   ├── pocketbase.ts    # PocketBase SDK client instance
│   │   └── UnlockVault.tsx  # In-memory vault unlock interface
│   ├── pages/
│   │   ├── Home.tsx         # Dashboard / Entry list
│   │   ├── Write.tsx        # Markdown editor & encryptor
│   │   ├── Entry.tsx        # Decrypted entry reader view
│   │   └── EditEntry.tsx    # Entry updater
│   └── App.tsx              # Application router
└── tests/                   # Playwright E2E test specs
```

---

## 🤝 Contributing

Contributions, feedback, and security reviews are warmly welcome!

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/my-thoughtful-feature`)
3. Commit your changes (`git commit -m 'Add some feature'`)
4. Push to the branch (`git push origin feature/my-thoughtful-feature`)
5. Open a Pull Request

---

## 📜 License

This project is licensed under the **GNU General Public License v3.0** — see the [LICENSE](LICENSE) file for details. Free software to protect your privacy and ensure your code remains free forever.
