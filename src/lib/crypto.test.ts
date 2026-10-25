import { describe, it, expect } from "vitest";
import { deriveKey, encryptText, decryptText } from "./crypto";

describe("Cryptography Module", () => {

    it("should successfully encrypt and decrypt a string", async () => {
        const password = "my-secure-password";
        const salt = "user_id_98765";
        const plainText = "Dear Diary, today I wrote my first test.";

        // 1. Generate the key
        const key = await deriveKey(password, salt);
        expect(key).toBeDefined();

        // 2. Encrypt the data
        const encrypted = await encryptText(plainText, key);

        // Ensure it actually encrypted and contains our IV separator ":"
        expect(encrypted).not.toBe(plainText);
        expect(encrypted).toContain(":");

        // 3. Decrypt the data back to the original text
        const decrypted = await decryptText(encrypted, key);
        expect(decrypted).toBe(plainText);
    });

    it("should throw an error if decrypted with the wrong password", async () => {
        const plainText = "This should remain hidden";
        const salt = "user_id_11111";

        const correctKey = await deriveKey("correct-password", salt);
        const wrongKey = await deriveKey("wrong-password", salt);

        // Encrypt with the correct key
        const encrypted = await encryptText(plainText, correctKey);

        // Attempting to decrypt with the wrong key should throw a cryptographic error
        await expect(decryptText(encrypted, wrongKey)).rejects.toThrow();
    });

    it("should generate different ciphertexts for the same plain text (IV check)", async () => {
        const key = await deriveKey("password", "salt");
        const plainText = "Identical message";

        const encrypted1 = await encryptText(plainText, key);
        const encrypted2 = await encryptText(plainText, key);

        // Because AES-GCM generates a random Initialization Vector (IV) every time,
        // encrypting the exact same string twice must yield different results.
        expect(encrypted1).not.toBe(encrypted2);
    });
});