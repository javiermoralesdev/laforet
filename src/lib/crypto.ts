// lib/crypto.ts
//
// Key hierarchy (the server only ever sees `authSecret`):
//
//   password + salt("laforet:v1:" + normalized email)
//     └─ PBKDF2-HMAC-SHA256, 600,000 iterations ─> masterKey (never leaves the device)
//           ├─ HKDF-SHA256(info "laforet-auth-v1") ─> authSecret  (sent to PocketBase as the password)
//           └─ HKDF-SHA256(info "laforet-enc-v1")  ─> AES-GCM-256 key (encrypts the diary)
//
// Stored ciphertext format: "v1:" + hex(iv) + ":" + hex(ciphertext || 16-byte GCM tag)
// The "v1" labels are the first version of THIS scheme (they are independent of the app version).

import { createSignal } from "solid-js";

export const [vaultKey, setVaultKey] = createSignal<CryptoKey | null>(null);

const enc = new TextEncoder();

export const KDF_ITERATIONS = 600_000;
const SALT_PREFIX = "laforet:v1:";
const INFO_AUTH = "laforet-auth-v1";
const INFO_ENC = "laforet-enc-v1";
const FORMAT = "v1";
const NO_SALT = new Uint8Array(0); // HKDF salt: empty (equivalent to 32 zero bytes for SHA-256)

// Helper: ArrayBuffer / Uint8Array -> hex
const buf2hex = (buf: ArrayBuffer | Uint8Array) => {
    const view = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    return [...view].map(x => x.toString(16).padStart(2, "0")).join("");
};

// Helper: hex -> Uint8Array
const hex2buf = (hex: string) => {
    if (hex.length === 0 || hex.length % 2 !== 0 || /[^0-9a-f]/i.test(hex)) {
        throw new Error("Invalid encrypted format");
    }
    return new Uint8Array(hex.match(/.{2}/g)!.map(byte => parseInt(byte, 16)));
};

// The salt must be identical on every device, so normalize the email the same way everywhere.
export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export interface DerivedKeys {
    /** 64-char hex string. This is what gets sent to PocketBase as the account "password". */
    authSecret: string;
    /** AES-GCM key used for the diary. Non-extractable, never sent anywhere. */
    encKey: CryptoKey;
}

// 1. Derive both the login secret and the encryption key from the user's password.
export async function deriveKeys(password: string, email: string): Promise<DerivedKeys> {
    const passwordKey = await crypto.subtle.importKey(
        "raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]
    );

    const masterBits = await crypto.subtle.deriveBits(
        {
            name: "PBKDF2",
            salt: enc.encode(SALT_PREFIX + normalizeEmail(email)),
            iterations: KDF_ITERATIONS,
            hash: "SHA-256",
        },
        passwordKey,
        256
    );

    const masterKey = await crypto.subtle.importKey(
        "raw", masterBits, "HKDF", false, ["deriveBits", "deriveKey"]
    );

    const authBits = await crypto.subtle.deriveBits(
        { name: "HKDF", hash: "SHA-256", salt: NO_SALT, info: enc.encode(INFO_AUTH) },
        masterKey,
        256
    );

    const encKey = await crypto.subtle.deriveKey(
        { name: "HKDF", hash: "SHA-256", salt: NO_SALT, info: enc.encode(INFO_ENC) },
        masterKey,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
    );

    return { authSecret: buf2hex(authBits), encKey };
}

// 2. Encrypt text. `iv` is only for tests (known-answer vectors); leave it out in the app.
export async function encryptText(text: string, key: CryptoKey, iv?: Uint8Array): Promise<string> {
    const nonce = iv ?? crypto.getRandomValues(new Uint8Array(12)); // AES-GCM: 12-byte IV
    const ciphertextBuf = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv: nonce as BufferSource }, key, enc.encode(text)
    );
    return `${FORMAT}:${buf2hex(nonce)}:${buf2hex(ciphertextBuf)}`;
}

// 3. Decrypt text
export async function decryptText(encryptedStr: string, key: CryptoKey): Promise<string> {
    const parts = encryptedStr.split(":");
    if (parts.length !== 3 || parts[0] !== FORMAT) throw new Error("Invalid encrypted format");

    const iv = hex2buf(parts[1]);
    const ciphertext = hex2buf(parts[2]);
    if (iv.length !== 12 || ciphertext.length < 16) throw new Error("Invalid encrypted format");

    const decryptedBuf = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv as BufferSource }, key, ciphertext as BufferSource
    );
    return new TextDecoder().decode(decryptedBuf);
}