import { describe, it, expect } from "vitest";
import { deriveKeys, encryptText, decryptText, normalizeEmail } from "./crypto";

// Known-answer vector produced by an INDEPENDENT implementation (Python hashlib/hmac + `cryptography`),
// so these tests fail if the parameters, labels, salt or format ever drift. The Dart port must pass the
// very same vector.
const V = {
    password: "my-secure-password",
    emailTyped: "  Javi@Example.COM ",
    plain: "Dear Diary, hoy escribí mi primer test 🌲",
    authSecret: "4fc5ef78e98123573a347af2f905a0f83c1bb96befd0a04567a7868de5f9b989",
    encrypted:
        "v1:000102030405060708090a0b:863fe536625558ae3da4ac275c96742ba2d9a9e6cfd176a55b9c0e9599791240643deef628b629da9eb6e7ccc7d1b4c5fe6f38c091694991d4cdcebd",
};
const IV = Uint8Array.from({ length: 12 }, (_, i) => i);

describe("Cryptography Module (v1 scheme)", () => {
    it("derives the same authSecret as the reference implementation", async () => {
        const { authSecret } = await deriveKeys(V.password, V.emailTyped);
        expect(authSecret).toBe(V.authSecret);
        expect(authSecret).toMatch(/^[0-9a-f]{64}$/);
    });

    it("decrypts a string produced by the reference implementation (proves encKey matches)", async () => {
        const { encKey } = await deriveKeys(V.password, V.emailTyped);
        expect(await decryptText(V.encrypted, encKey)).toBe(V.plain);
    });

    it("reproduces the reference ciphertext exactly with the same IV", async () => {
        const { encKey } = await deriveKeys(V.password, V.emailTyped);
        expect(await encryptText(V.plain, encKey, IV)).toBe(V.encrypted);
    });

    it("normalizes the email so the same account always gets the same keys", async () => {
        expect(normalizeEmail("  Javi@Example.COM ")).toBe("javi@example.com");
        const a = await deriveKeys(V.password, "javi@example.com");
        const b = await deriveKeys(V.password, "  JAVI@example.com");
        expect(a.authSecret).toBe(b.authSecret);
    });

    it("gives different authSecrets for a different password or a different email", async () => {
        const base = await deriveKeys("password-one", "a@example.com");
        const otherPw = await deriveKeys("password-two", "a@example.com");
        const otherEmail = await deriveKeys("password-one", "b@example.com");
        expect(otherPw.authSecret).not.toBe(base.authSecret);
        expect(otherEmail.authSecret).not.toBe(base.authSecret);
    });

    it("authSecret and encryption key are independent (authSecret can't decrypt anything)", async () => {
        const { authSecret, encKey } = await deriveKeys(V.password, V.emailTyped);
        const encrypted = await encryptText("secret", encKey);
        // Build a key straight from the authSecret bytes: it must NOT be able to decrypt.
        const bytes = Uint8Array.from(authSecret.match(/.{2}/g)!.map(h => parseInt(h, 16)));
        const wrong = await crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["decrypt"]);
        await expect(decryptText(encrypted, wrong)).rejects.toThrow();
    });

    it("round-trips, and uses a fresh IV every time", async () => {
        const { encKey } = await deriveKeys("password", "x@example.com");
        const e1 = await encryptText("Identical message", encKey);
        const e2 = await encryptText("Identical message", encKey);
        expect(e1).not.toBe(e2);
        expect(await decryptText(e1, encKey)).toBe("Identical message");
    });

    it("throws when decrypting with the wrong password", async () => {
        const good = await deriveKeys("correct-password", "x@example.com");
        const bad = await deriveKeys("wrong-password", "x@example.com");
        const encrypted = await encryptText("This should remain hidden", good.encKey);
        await expect(decryptText(encrypted, bad.encKey)).rejects.toThrow();
    });

    it("throws on tampered or malformed input", async () => {
        const { encKey } = await deriveKeys("password", "x@example.com");
        const encrypted = await encryptText("hello", encKey);
        const flipped = encrypted.slice(0, -1) + (encrypted.endsWith("0") ? "1" : "0");
        await expect(decryptText(flipped, encKey)).rejects.toThrow();
        await expect(decryptText("nope", encKey)).rejects.toThrow("Invalid encrypted format");
        await expect(decryptText("000102:abcd", encKey)).rejects.toThrow("Invalid encrypted format"); // old format
    });
});