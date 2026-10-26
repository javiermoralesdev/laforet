<div align="center">

# 🌲 Laforet

**A quiet, zero-knowledge, end-to-end encrypted personal diary.**  
*Because your deepest thoughts belong to no one else.*

[![SolidJS](https://img.shields.io/badge/SolidJS-1.9-2c4f7c?style=flat-square&logo=solid)](https://www.solidjs.com/)
[![PocketBase](https://img.shields.io/badge/PocketBase-0.40.6-b8db57?style=flat-square&logo=pocketbase&logoColor=black)](https://pocketbase.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Web Crypto API](https://img.shields.io/badge/Crypto-AES--GCM%20256-darkgreen?style=flat-square)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
[![PBKDF2 Iterations](https://img.shields.io/badge/PBKDF2-600k%20rounds-darkgreen?style=flat-square)](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg?style=flat-square)](https://www.gnu.org/licenses/gpl-3.0)
[![Docker Ready](https://img.shields.io/badge/Docker-Single%20Container-blue?style=flat-square&logo=docker)](https://www.docker.com/)

[Features](#-features) • [Why Carmen Laforet?](#-the-name) • [Security & Cryptography](#-how-the-cryptography-works) • [Quick Start](#-quick-start) • [Docker Deployment](#-docker-deployment) • [Testing](#-testing) • [AI Disclosure](#-ai-disclosure)

</div>

---

## 📖 The Name

> *"Unos la ven como un bosque; otros, como un laberinto..."*

**Laforet** is named in honor of Spanish novelist **Carmen Laforet** (1921–2004), author of the classic novel *Nada* (Premio Nadal, 1944). Her writing gave voice to intimate, unvarnished human truth — the inner monologues, quiet yearnings, and private contemplations that people keep tucked away from the rest of the world.

This project is built to be a safe, inviolable digital counterpart to that private space: a tranquil clearing where you can write freely, knowing no algorithm, server administrator, or third party can ever peer into your pages.

---

## ✨ Features

- 🔒 **Zero-Knowledge Architecture**: All diary entries are encrypted locally on your device with **AES-GCM-256** before touching the network.
- 🛡️ **Zero-Knowledge Authentication**: The server never sees your actual master password. Your password is used locally to derive an isolated authentication token (`authSecret`), ensuring true zero-knowledge authentication.
- ⚙️ **OWASP-Hardened Key Derivation**: Uses **PBKDF2-HMAC-SHA256 with 600,000 iterations** combined with **HKDF-SHA256** domain separation to isolate login credentials from encryption keys.
- 🧠 **Memory-Only Key Storage**: Non-extractable encryption keys live strictly in client memory during your active session. Never persisted to `localStorage`, session storage, or cookies.
- 🏷️ **Versioned Authenticated Ciphertext (`v1`)**: Every entry is protected with a fresh 12-byte random IV and a 16-byte GCM authentication tag (`v1:<iv>:<ciphertext>`), guaranteeing tamper detection and protocol version stability.
- 🐦 **Cryptographic Canary Verification**: Unlocks your vault seamlessly by testing the key against an encrypted canary token (`vaultCheck`) without exposing sensitive data.
- ✍️ **Markdown Editor with Live Preview**: Draft your reflections with full Markdown support, clean typography, and a toggleable preview tab.
- 🌍 **Bilingual by Nature**: Native internationalization in **English** and **Spanish** with an instant in-app language switcher.
- 🛡️ **Invite-Only / Closed Signups**: Control user registration with a single environment flag (`VITE_DISABLE_SIGNUPS`), enforced both on the frontend UI and guarded on the PocketBase server via a backend hook.
- ⚡ **Blazing Fast Reactive UI**: Built with [SolidJS](https://solidjs.com) for fine-grained reactivity and minimal JavaScript overhead.
- 🐳 **All-in-One Deployment**: Ships as a single, lightweight multi-stage Docker container serving both the PocketBase backend and the compiled SolidJS frontend.

---

## 🔐 How the Cryptography Works

Laforet follows a modern **zero-knowledge cryptographic architecture** using the native **Web Crypto API**. The server only ever sees a derived authentication token—your actual master password and raw diary entries **never leave your device**.

### Key Hierarchy & Domain Separation

```
[ User Password ] + [ Salt: "laforet:v1:" + normalizeEmail(email) ]
                               │
                               ▼
            PBKDF2-HMAC-SHA256 (600,000 iterations)
                               │
                               ▼
                    [ 256-bit Master Key ]
                   (Never leaves the device)
                               │
                 HKDF-SHA256 Domain Separation
                               │
         ┌─────────────────────┴─────────────────────┐
         ▼                                           ▼
   info: "laforet-auth-v1"                     info: "laforet-enc-v1"
         │                                           │
         ▼                                           ▼
    [ authSecret ]                               [ encKey ]
 (64-char hex string)                     (AES-GCM 256-bit Key)
         │                                           │
         ▼                                           ▼
Sent to PocketBase as the                 Held in client memory only;
account "password"                        encrypts & decrypts diary entries
```

1. **Email Normalization & Salt**: Emails are stripped of whitespace and lowercased (`normalizeEmail`), then combined with a versioned domain prefix (`"laforet:v1:" + normalized_email`). This ensures identical, deterministic salt generation across every client device.
2. **Master Key Derivation (PBKDF2)**: The user password is run through **PBKDF2-HMAC-SHA256** with **600,000 iterations** (exceeding OWASP password storage recommendations) to generate a high-entropy 256-bit master key.
3. **HKDF Domain Separation**: Using **HKDF-SHA256**, the master key is split into two cryptographically independent secrets:
   - **`authSecret`**: Derived with context info `"laforet-auth-v1"`. This 64-character hex string is sent to PocketBase as the account password. PocketBase authenticates the user, but *never* learns their master password. Even if `authSecret` were compromised, an attacker cannot mathematically deduce `encKey`.
   - **`encKey`**: Derived with context info `"laforet-enc-v1"`. A non-extractable **AES-GCM 256-bit** key that stays strictly in device memory during an active session and is wiped immediately upon logout.
4. **Versioned Authenticated Encryption (AES-GCM)**: Each entry is encrypted with its own fresh, cryptographically secure 12-byte initialization vector (IV) and protected by a 16-byte GCM authentication tag:
   ```
   v1:<12-byte-hex-iv>:<hex-ciphertext-and-16-byte-gcm-tag>
   ```
   The `v1:` prefix provides explicit protocol versioning, strict format verification, and tampering rejection.
5. **Deterministic Canary Check**: On signup, a canary string (`"success"`) is encrypted with `encKey` and stored in the user record as `vaultCheck`. When unlocking the vault, the client tests `encKey` against this token to verify credentials before loading entries.

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

docker run -d \
  -p 8090:8090 \
  -v laforet_data:/pb/pb_data \
  -e PB_ADMIN_EMAIL=admin@example.com \
  -e PB_ADMIN_PASSWORD=your_secure_password_here \
  -e VITE_DISABLE_SIGNUPS=false \
  --name laforet-app \
  javiermorales/laforet:latest
```

Your diary is now live at `http://localhost:8090`. The PocketBase admin dashboard can be accessed at `http://localhost:8090/_/`.

### Run with Docker Compose

Create a `docker-compose.yml` file:

```yaml
version: "3.8"

services:
  laforet:
    image: javiermorales/laforet:latest   # or pin a version, e.g. 2.0.1
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
      - /path/to/your/data:/pb/pb_data
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

Verifies the complete v1 cryptographic suite against known-answer vectors generated by an independent reference implementation (Python `hashlib` / `cryptography`). Validates PBKDF2 key derivation (600,000 rounds), HKDF domain separation (`authSecret` vs. `encKey`), email normalization, AES-GCM encryption/decryption, unique IV generation, and ciphertext tamper detection:

```bash
bun run vitest run src/lib/crypto.test.ts
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

## 🤖 AI Disclosure

In the spirit of openness: generative AI tools were used during development, for CSS/SCSS styling and UI polish, the Docker and CI setup, a PocketBase hook that blocks signups server-side, and the app icon. 

The core application architecture, the cryptographic implementation (Web Crypto API, PBKDF2 key derivation, AES-GCM, in-memory vault management), database schemas and business logic were written and tested by me. The cryptography has not been independently audited.
---

## 📜 License

This project is licensed under the **GNU General Public License v3.0** — see the [LICENSE](LICENSE) file for details. Free software to protect your privacy and ensure your code remains free forever.
