import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import net from "node:net";
import { pb, currentUser, logOut } from "./pocketbase";
import { deriveKeys, encryptText, decryptText, vaultKey, setVaultKey, type DerivedKeys } from "./crypto";

// Helper to find a free port for the test server
async function getAvailablePort(preferredPort = 8099): Promise<number> {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.listen(preferredPort, "127.0.0.1", () => {
            server.close(() => resolve(preferredPort));
        });
        server.on("error", () => {
            const ephemeralServer = net.createServer();
            ephemeralServer.listen(0, "127.0.0.1", () => {
                const port = (ephemeralServer.address() as net.AddressInfo).port;
                ephemeralServer.close(() => resolve(port));
            });
        });
    });
}

// Helper to poll PocketBase /api/health until server is ready
async function waitForHealth(url: string, timeoutMs = 8000): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        try {
            const res = await fetch(`${url}/api/health`);
            if (res.ok) return true;
        } catch (_) { }
        await new Promise((r) => setTimeout(r, 100));
    }
    return false;
}

// Compile the PocketBase binary from the Go sources in the repo root
function buildPocketBase(outputPath: string): void {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });

    const result = spawnSync("go", ["build", "-o", outputPath, "."], {
        cwd: process.cwd(),
        env: { ...process.env, CGO_ENABLED: "0" },
        encoding: "utf-8",
        timeout: 240_000,
    });

    if (result.error) {
        throw new Error(
            `Could not run "go build" (is Go installed and on PATH?): ${result.error.message}`
        );
    }
    if (result.status !== 0) {
        throw new Error(`PocketBase build failed:\n${result.stderr || result.stdout}`);
    }
}

describe("PocketBase Backend Integration & Database Tests", () => {
    let pbProcess: ChildProcess | null = null;
    let testDataDir: string | null = null;
    let originalBaseUrl: string;
    let activeServerUrl: string;

    beforeAll(async () => {
        originalBaseUrl = pb.baseUrl;

        // 1. Check if an external PocketBase instance is already specified or running
        const externalUrl = process.env.TEST_PB_URL || process.env.VITE_PB_HOST;
        if (externalUrl) {
            const isUp = await waitForHealth(externalUrl, 1000);
            if (isUp) {
                activeServerUrl = externalUrl;
                pb.baseUrl = activeServerUrl;
                return;
            }
        }

        // 2. Launch local ./pocketbase binary with isolated test database
        const binaryPath = process.env.PB_PATH || path.resolve(process.cwd(), "pocketbase");
        if (!fs.existsSync(binaryPath)) {
            buildPocketBase(binaryPath);
        }

        const testPort = await getAvailablePort(8099);
        activeServerUrl = `http://127.0.0.1:${testPort}`;
        testDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "pb_test_data_"));

        // Pre-create a superuser so PocketBase doesn't open the installer in the browser
        const su = spawnSync(
            binaryPath,
            [
                "superuser", "upsert", "test@laforet.local", "test-superuser-password-123",
                `--dir=${testDataDir}`,
                `--migrationsDir=${path.resolve(process.cwd(), "pb_migrations")}`,
            ],
            { encoding: "utf-8", timeout: 30_000 }
        );
        if (su.status !== 0) {
            throw new Error(`Could not create test superuser:\n${su.stderr || su.stdout}`);
        }

        pbProcess = spawn(
            binaryPath,
            [
                "serve",
                `--http=127.0.0.1:${testPort}`,
                `--dir=${testDataDir}`,
                `--migrationsDir=${path.resolve(process.cwd(), "pb_migrations")}`,
                `--hooksDir=${path.resolve(process.cwd(), "pb_hooks")}`,
            ],
            {
                stdio: "pipe",
                env: {
                    ...process.env,
                    VITE_DISABLE_SIGNUPS: "false",
                },
            }
        );

        let serverLog = "";
        pbProcess.stdout?.on("data", (d) => (serverLog += d));
        pbProcess.stderr?.on("data", (d) => (serverLog += d));
        let exitInfo = "";
        pbProcess.on("exit", (code, signal) => (exitInfo = `exited code=${code} signal=${signal}`));
        pbProcess.on("error", (err) => (exitInfo = `spawn error: ${err.message}`));

        const isReady = await waitForHealth(activeServerUrl, 10000);
        if (!isReady) {
            pbProcess.kill();
            if (testDataDir) fs.rmSync(testDataDir, { recursive: true, force: true });
            throw new Error(
                `PocketBase failed to start at ${activeServerUrl} within 10s. ${exitInfo}\n${serverLog}`
            );
        }

        // Connect the app's pocketbase client to the active test server
        pb.baseUrl = activeServerUrl;
    }, 15000);

    afterAll(async () => {
        logOut();
        pb.baseUrl = originalBaseUrl;

        if (pbProcess) {
            pbProcess.kill();
            pbProcess = null;
        }

        if (testDataDir && fs.existsSync(testDataDir)) {
            try {
                fs.rmSync(testDataDir, { recursive: true, force: true });
            } catch (_) { }
        }
    });

    beforeEach(() => {
        logOut();
    });

    // ==========================================
    // 1. Server Health & Hooks Verification
    // ==========================================
    describe("Server Health & PocketBase Hooks", () => {
        it("should return healthy status from PocketBase health check endpoint", async () => {
            const health = await pb.health.check();
            expect(health.code).toBe(200);
            expect(health.message).toBe("API is healthy.");
        });

        it("should execute custom JS app hook (/env-config.js)", async () => {
            const res = await fetch(`${activeServerUrl}/env-config.js`);
            expect(res.ok).toBe(true);
            const content = await res.text();
            expect(content).toContain("window.__ENV__");
        });
    });

    // ==========================================
    // 2. Authentication & Session Interactions
    // ==========================================
    describe("Authentication & Session Interactions", () => {
        it("should register a new user in the database with authSecret and vaultCheck canary", async () => {
            const email = `carmen_${Date.now()}@laforet.es`;
            const password = "carmen-secret-diary-password";
            const keys = await deriveKeys(password, email);
            const canary = await encryptText("success", keys.encKey);

            // Create user in PocketBase users collection
            const createdUser = await pb.collection("users").create({
                email,
                password: keys.authSecret,
                passwordConfirm: keys.authSecret,
                name: "Carmen",
                vaultCheck: canary,
            });

            expect(createdUser.id).toBeDefined();
            expect(createdUser.vaultCheck).toBe(canary);
            // Verify zero-knowledge invariant: the master password is never stored or transmitted
            expect(createdUser.vaultCheck).not.toContain(password);

            // Verify the created user can successfully authenticate and returns email + canary
            const auth = await pb.collection("users").authWithPassword(email, keys.authSecret);
            expect(auth.record.email).toBe(email);
            expect(auth.record.vaultCheck).toBe(canary);
            logOut();

            // Duplicate registration must be rejected by PocketBase validation
            await expect(
                pb.collection("users").create({
                    email,
                    password: keys.authSecret,
                    passwordConfirm: keys.authSecret,
                })
            ).rejects.toThrow();
        });

        it("should successfully log in, set currentUser signal, and unlock vaultKey", async () => {
            const email = `login_${Date.now()}@laforet.es`;
            const password = "safe-login-pass-456";
            const keys = await deriveKeys(password, email);
            const canary = await encryptText("success", keys.encKey);

            // Register account first
            await pb.collection("users").create({
                email,
                password: keys.authSecret,
                passwordConfirm: keys.authSecret,
                name: "Login Tester",
                vaultCheck: canary,
            });

            expect(pb.authStore.isValid).toBe(false);
            expect(currentUser()).toBeNull();

            // Perform login against PocketBase
            const authData = await pb.collection("users").authWithPassword(email, keys.authSecret);
            setVaultKey(keys.encKey);

            expect(pb.authStore.isValid).toBe(true);
            expect(pb.authStore.token).toBeTruthy();
            expect(currentUser()).not.toBeNull();
            expect(currentUser()?.id).toBe(authData.record.id);
            expect(currentUser()?.email).toBe(email);
            expect(vaultKey()).not.toBeNull();
        });

        it("should reject login when incorrect credentials are provided", async () => {
            const email = `wrong_${Date.now()}@laforet.es`;
            const password = "correct-password-789";
            const keys = await deriveKeys(password, email);

            await pb.collection("users").create({
                email,
                password: keys.authSecret,
                passwordConfirm: keys.authSecret,
                vaultCheck: "test-canary",
            });

            // Attempt login with wrong auth secret
            await expect(
                pb.collection("users").authWithPassword(email, "completely-wrong-auth-secret")
            ).rejects.toThrow();

            expect(pb.authStore.isValid).toBe(false);
            expect(currentUser()).toBeNull();
        });

        it("should verify vault password against the stored canary token (UnlockVault)", async () => {
            const email = `unlock_${Date.now()}@laforet.es`;
            const masterPassword = "vault-super-secure-key";
            const keys = await deriveKeys(masterPassword, email);
            const canary = await encryptText("success", keys.encKey);

            await pb.collection("users").create({
                email,
                password: keys.authSecret,
                passwordConfirm: keys.authSecret,
                vaultCheck: canary,
            });

            // Log in but leave vault locked (simulates page reload where authStore is preserved in localStorage)
            await pb.collection("users").authWithPassword(email, keys.authSecret);
            setVaultKey(null);
            expect(vaultKey()).toBeNull();
            expect(currentUser()).not.toBeNull();

            // 1. Successful Unlock: candidate password decrypts canary to "success"
            const attemptKeys = await deriveKeys(masterPassword, currentUser()!.email);
            const fetchedUser = await pb.collection("users").getOne(currentUser()!.id);
            const decryptedCanary = await decryptText(fetchedUser.vaultCheck, attemptKeys.encKey);
            expect(decryptedCanary).toBe("success");
            setVaultKey(attemptKeys.encKey);
            expect(vaultKey()).not.toBeNull();

            // 2. Failed Unlock: wrong password fails AES-GCM tag verification
            const wrongKeys = await deriveKeys("wrong-master-password", currentUser()!.email);
            await expect(
                decryptText(fetchedUser.vaultCheck, wrongKeys.encKey)
            ).rejects.toThrow();
        });

        it("should wipe authStore, currentUser, and vaultKey upon logout", async () => {
            const email = `logout_${Date.now()}@laforet.es`;
            const password = "logout-password-123";
            const keys = await deriveKeys(password, email);

            await pb.collection("users").create({
                email,
                password: keys.authSecret,
                passwordConfirm: keys.authSecret,
                vaultCheck: "canary",
            });

            await pb.collection("users").authWithPassword(email, keys.authSecret);
            setVaultKey(keys.encKey);

            expect(currentUser()).not.toBeNull();
            expect(vaultKey()).not.toBeNull();

            // Call app's logOut()
            logOut();

            expect(pb.authStore.isValid).toBe(false);
            expect(currentUser()).toBeNull();
            expect(vaultKey()).toBeNull();
        });
    });

    // ==========================================
    // 3. CRUD Operations on Entries Collection
    // ==========================================
    describe("CRUD Operations on Entries Collection", () => {
        let activeKeys: DerivedKeys;
        let testAuthorId: string;

        beforeEach(async () => {
            const email = `author_${Date.now()}_${Math.random().toString(36).substring(2, 6)}@laforet.es`;
            const password = "carmen-master-key";
            activeKeys = await deriveKeys(password, email);
            const canary = await encryptText("success", activeKeys.encKey);

            const user = await pb.collection("users").create({
                email,
                password: activeKeys.authSecret,
                passwordConfirm: activeKeys.authSecret,
                name: "Carmen Author",
                vaultCheck: canary,
            });

            await pb.collection("users").authWithPassword(email, activeKeys.authSecret);
            testAuthorId = user.id;
            setVaultKey(activeKeys.encKey);
        });

        it("CREATE: should encrypt title and body with AES-GCM before saving to PocketBase", async () => {
            const plainTitle = "Calle Aribau";
            const plainBody = "# Primeras impresiones\nLa casa de la calle de Aribau era una pesadilla de polvo y sombras.";

            const key = vaultKey()!;
            const encryptedTitle = await encryptText(plainTitle, key);
            const encryptedBody = await encryptText(plainBody, key);

            // Save to real PocketBase entries collection
            const created = await pb.collection("entries").create({
                title: encryptedTitle,
                body: encryptedBody,
                author: testAuthorId,
            });

            expect(created.id).toBeDefined();
            expect(created.author).toBe(testAuthorId);
            expect(created.created).toBeDefined();

            // Fetch stored record directly from database
            const stored = await pb.collection("entries").getOne(created.id);
            expect(stored.title).not.toBe(plainTitle);
            expect(stored.body).not.toBe(plainBody);
            expect(stored.title).toMatch(/^v1:[0-9a-f]{24}:[0-9a-f]+/);
            expect(stored.body).toMatch(/^v1:[0-9a-f]{24}:[0-9a-f]+/);

            // Decrypting stored data with the user's vault key restores original text
            expect(await decryptText(stored.title, key)).toBe(plainTitle);
            expect(await decryptText(stored.body, key)).toBe(plainBody);
        });

        it("READ (List): should fetch and decrypt all entries from database", async () => {
            const key = vaultKey()!;

            // Seed 3 encrypted entries in PocketBase
            const entriesData = [
                { title: "Entrada 1 - Octubre", body: "Llegué a Barcelona..." },
                { title: "Entrada 2 - Noviembre", body: "La Universidad Central..." },
                { title: "Entrada 3 - Diciembre", body: "La amistad con Ena..." },
            ];

            for (const item of entriesData) {
                await pb.collection("entries").create({
                    title: await encryptText(item.title, key),
                    body: await encryptText(item.body, key),
                    author: testAuthorId,
                });
                // Small sleep to ensure distinct creation timestamps
                await new Promise((r) => setTimeout(r, 20));
            }

            // Fetch list from database (mirrors ListEntries.tsx query)
            const rawEntries = await pb.collection("entries").getFullList<{ id: string; title: string; created: string }>({
                sort: "-created",
                fields: "id,title,created",
            });

            expect(rawEntries.length).toBe(3);

            // Decrypt each entry's title
            const decryptedEntries = await Promise.all(
                rawEntries.map(async (entry) => ({
                    id: entry.id,
                    title: await decryptText(entry.title, key),
                }))
            );

            expect(decryptedEntries.map((e) => e.title)).toEqual([
                "Entrada 3 - Diciembre",
                "Entrada 2 - Noviembre",
                "Entrada 1 - Octubre",
            ]);
        });

        it("READ (List): should catch and handle decryption error if entry was encrypted with another key", async () => {
            const key = vaultKey()!;
            const foreignKeys = await deriveKeys("another-user-pass", "another@example.com");

            // Create one normally encrypted entry and one with a foreign key
            await pb.collection("entries").create({
                title: await encryptText("Valid Entry", key),
                body: await encryptText("Valid body", key),
                author: testAuthorId,
            });

            await pb.collection("entries").create({
                title: await encryptText("Foreign Entry", foreignKeys.encKey),
                body: await encryptText("Foreign body", foreignKeys.encKey),
                author: testAuthorId,
            });

            const rawEntries = await pb.collection("entries").getFullList<{ id: string; title: string; created: string }>();

            const decryptedList = await Promise.all(
                rawEntries.map(async (entry) => {
                    try {
                        return { id: entry.id, title: await decryptText(entry.title, key) };
                    } catch (_) {
                        return { id: entry.id, title: "🔒 [Decryption Error]" };
                    }
                })
            );

            const titles = decryptedList.map((e) => e.title);
            expect(titles).toContain("Valid Entry");
            expect(titles).toContain("🔒 [Decryption Error]");
        });

        it("READ (Single Entry): should fetch one entry and decrypt title and body (Entry.tsx)", async () => {
            const key = vaultKey()!;
            const created = await pb.collection("entries").create({
                title: await encryptText("Día de lluvia", key),
                body: await encryptText("## Recuerdos\nLa lluvia caía sobre las baldosas de la plaza...", key),
                author: testAuthorId,
            });

            // Fetch single record from PocketBase
            const fetched = await pb.collection("entries").getOne<{ id: string; title: string; body: string; created: string }>(created.id);
            const decryptedTitle = await decryptText(fetched.title, key);
            const decryptedBody = await decryptText(fetched.body, key);

            expect(decryptedTitle).toBe("Día de lluvia");
            expect(decryptedBody).toBe("## Recuerdos\nLa lluvia caía sobre las baldosas de la plaza...");
        });

        it("UPDATE: should re-encrypt updated title and body and save to database (EditEntry.tsx)", async () => {
            const key = vaultKey()!;
            const initial = await pb.collection("entries").create({
                title: await encryptText("Título Inicial", key),
                body: await encryptText("Cuerpo inicial", key),
                author: testAuthorId,
            });

            // Modify and re-encrypt
            const newPlainTitle = "Título Modificado";
            const newPlainBody = "Cuerpo modificado con nuevos detalles.";
            const newEncTitle = await encryptText(newPlainTitle, key);
            const newEncBody = await encryptText(newPlainBody, key);

            await pb.collection("entries").update(initial.id, {
                title: newEncTitle,
                body: newEncBody,
            });

            // Verify the database record was updated
            const updated = await pb.collection("entries").getOne<{ title: string; body: string }>(initial.id);
            expect(await decryptText(updated.title, key)).toBe(newPlainTitle);
            expect(await decryptText(updated.body, key)).toBe(newPlainBody);
        });

        it("DELETE: should remove entry from database and verify it can no longer be retrieved", async () => {
            const key = vaultKey()!;
            const entry = await pb.collection("entries").create({
                title: await encryptText("Entrada para borrar", key),
                body: await encryptText("Contenido efímero", key),
                author: testAuthorId,
            });

            // Delete from database
            await pb.collection("entries").delete(entry.id);

            // Attempting to read deleted entry must throw PocketBase 404
            await expect(pb.collection("entries").getOne(entry.id)).rejects.toThrow();
        });
    });

    // ==========================================
    // 4. Security Rules & Access Control (Backend Permissions)
    // ==========================================
    describe("Security Rules & Access Control Enforcement", () => {
        it("should reject unauthenticated operations on entries collection", async () => {
            // Unauthenticated client
            logOut();
            expect(pb.authStore.isValid).toBe(false);

            // PocketBase create rule requires @request.auth.id != ""
            await expect(
                pb.collection("entries").create({
                    title: "Malicious entry",
                    body: "Attempting unauthenticated write",
                    author: "fake_id",
                })
            ).rejects.toThrow();

            // PocketBase list rule '@request.auth.id != "" && author = @request.auth.id' yields empty list
            const unauthList = await pb.collection("entries").getFullList();
            expect(unauthList).toEqual([]);

            // PocketBase view rule '@request.auth.id != "" && author = @request.auth.id' rejects getOne
            await expect(
                pb.collection("entries").getOne("non_existent_or_protected")
            ).rejects.toThrow();
        });

        it("should isolate user data: User B cannot access or modify User A's entries", async () => {
            // User A creates an entry
            const userAEmail = `user_a_${Date.now()}@example.com`;
            const keysA = await deriveKeys("passA123", userAEmail);
            const userA = await pb.collection("users").create({
                email: userAEmail,
                password: keysA.authSecret,
                passwordConfirm: keysA.authSecret,
                vaultCheck: "canaryA",
            });

            await pb.collection("users").authWithPassword(userAEmail, keysA.authSecret);
            const entryA = await pb.collection("entries").create({
                title: await encryptText("User A's Diary", keysA.encKey),
                body: await encryptText("Private thoughts", keysA.encKey),
                author: userA.id,
            });

            // Switch to User B
            const userBEmail = `user_b_${Date.now()}@example.com`;
            const keysB = await deriveKeys("passB456", userBEmail);
            await pb.collection("users").create({
                email: userBEmail,
                password: keysB.authSecret,
                passwordConfirm: keysB.authSecret,
                vaultCheck: "canaryB",
            });

            await pb.collection("users").authWithPassword(userBEmail, keysB.authSecret);

            // User B lists entries: PocketBase rule 'author = @request.auth.id' hides User A's entry
            const userBList = await pb.collection("entries").getFullList();
            expect(userBList.some((e) => e.id === entryA.id)).toBe(false);

            // User B trying to fetch User A's entry directly throws 404
            await expect(pb.collection("entries").getOne(entryA.id)).rejects.toThrow();

            // User B trying to delete User A's entry directly throws 404
            await expect(pb.collection("entries").delete(entryA.id)).rejects.toThrow();
        });
    });
});
