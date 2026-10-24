// lib/crypto.ts

import { createSignal } from "solid-js";

export const [vaultKey, setVaultKey] = createSignal<CryptoKey | null>(null);

// 1. Derive a secure key from a password and a salt (we'll use the user's ID as the salt)
export async function deriveKey(password: string, saltString: string): Promise<CryptoKey> {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        "raw", enc.encode(password), { name: "PBKDF2" }, false, ["deriveKey"]
    );

    return crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: enc.encode(saltString),
            iterations: 100000,
            hash: "SHA-256"
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
    );
}

// Helper: Convert ArrayBuffer or Uint8Array to Hex String
const buf2hex = (buf: ArrayBuffer | Uint8Array) => {
    // If it's an ArrayBuffer, wrap it in a Uint8Array. If it's already a Uint8Array, just use it.
    const uint8View = buf instanceof Uint8Array ? buf : new Uint8Array(buf);

    return [...uint8View].map(x => x.toString(16).padStart(2, '0')).join('');
};

// Helper: Convert Hex String to Uint8Array
const hex2buf = (hex: string) =>
    new Uint8Array(hex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));

// 2. Encrypt text
export async function encryptText(text: string, key: CryptoKey): Promise<string> {
    const enc = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12)); // AES-GCM requires a 12-byte IV

    const ciphertextBuf = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv }, key, enc.encode(text)
    );

    // Combine IV and ciphertext into a single hex string for easy database storage
    return buf2hex(iv) + ":" + buf2hex(ciphertextBuf);
}

// 3. Decrypt text
export async function decryptText(encryptedStr: string, key: CryptoKey): Promise<string> {
    const [ivHex, cipherHex] = encryptedStr.split(":");
    if (!ivHex || !cipherHex) throw new Error("Invalid encrypted format");

    const iv = hex2buf(ivHex);
    const ciphertext = hex2buf(cipherHex);

    const decryptedBuf = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv }, key, ciphertext
    );

    return new TextDecoder().decode(decryptedBuf);
}