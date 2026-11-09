import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { RecordModel } from "pocketbase";
import { pb, currentUser, logOut } from "./pocketbase";
import { deriveKeys, encryptText, decryptText, vaultKey, setVaultKey, type DerivedKeys } from "./crypto";

// Helper to generate a valid mock JWT with expiration in the future
function createMockJWT(userId: string): string {
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({
        id: userId,
        exp: Math.floor(Date.now() / 1000) + 3600 // 1 hour expiration
    })).toString("base64url");
    return `${header}.${payload}.mockSignature12345`;
}

// Helper to generate a valid RecordModel for authStore
function mockRecordModel(data: Record<string, any>): RecordModel {
    return {
        id: data.id || "rec_" + Math.random().toString(36).substring(2, 10),
        collectionId: "_pb_users_auth_",
        collectionName: "users",
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        ...data,
    } as RecordModel;
}

interface UserRecord {
    id: string;
    email: string;
    password: string; // The authSecret in zero-knowledge mode
    name?: string;
    vaultCheck?: string;
}

interface EntryRecord {
    id: string;
    author: string;
    title: string;
    body: string;
    created: string;
    updated: string;
}

describe("Database & Authentication Interactions", () => {
    // In-memory mock database collections
    let mockUsers: Map<string, UserRecord>;
    let mockEntries: Map<string, EntryRecord>;
    let collectionSpy: any;
    let entrySeq = 0;

    beforeEach(() => {
        // Reset in-memory database
        mockUsers = new Map();
        mockEntries = new Map();
        entrySeq = 0;

        // Ensure user is logged out and vault is clean
        logOut();

        // Mock the pb.collection method to simulate PocketBase database operations
        collectionSpy = vi.spyOn(pb, "collection").mockImplementation((collectionName: string) => {
            if (collectionName === "users") {
                return {
                    authWithPassword: vi.fn(async (email: string, password: string) => {
                        const user = Array.from(mockUsers.values()).find(
                            u => u.email.toLowerCase() === email.toLowerCase() && u.password === password
                        );
                        if (!user) {
                            throw new Error("Invalid login credentials.");
                        }
                        const token = createMockJWT(user.id);
                        pb.authStore.save(token, mockRecordModel({
                            id: user.id,
                            email: user.email,
                            name: user.name,
                            vaultCheck: user.vaultCheck
                        }));
                        return {
                            token,
                            record: { id: user.id, email: user.email, name: user.name, vaultCheck: user.vaultCheck }
                        };
                    }),

                    create: vi.fn(async (data: { email: string; password: string; passwordConfirm?: string; name?: string }) => {
                        if (Array.from(mockUsers.values()).some(u => u.email.toLowerCase() === data.email.toLowerCase())) {
                            throw new Error("User already exists.");
                        }
                        const id = "usr_" + Math.random().toString(36).substring(2, 10);
                        const record: UserRecord = {
                            id,
                            email: data.email,
                            password: data.password,
                            name: data.name
                        };
                        mockUsers.set(id, record);
                        return { id: record.id, email: record.email, name: record.name };
                    }),

                    getOne: vi.fn(async (id: string) => {
                        const user = mockUsers.get(id);
                        if (!user) throw new Error("User not found.");
                        return { id: user.id, email: user.email, name: user.name, vaultCheck: user.vaultCheck };
                    }),

                    update: vi.fn(async (id: string, data: Partial<UserRecord>) => {
                        const user = mockUsers.get(id);
                        if (!user) throw new Error("User not found.");
                        const updated = { ...user, ...data };
                        mockUsers.set(id, updated);
                        return { id: updated.id, email: updated.email, name: updated.name, vaultCheck: updated.vaultCheck };
                    }),
                } as any;
            }

            if (collectionName === "entries") {
                return {
                    create: vi.fn(async (data: { title: string; body: string; author: string }) => {
                        const id = "ent_" + Math.random().toString(36).substring(2, 10);
                        const now = new Date(Date.now() + (++entrySeq) * 1000).toISOString();
                        const record: EntryRecord = {
                            id,
                            author: data.author,
                            title: data.title,
                            body: data.body,
                            created: now,
                            updated: now
                        };
                        mockEntries.set(id, record);
                        return record;
                    }),

                    getFullList: vi.fn(async (options?: { sort?: string; fields?: string }) => {
                        const list = Array.from(mockEntries.values());
                        if (options?.sort === "-created") {
                            list.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
                        }
                        return list.map(item => ({
                            id: item.id,
                            title: item.title,
                            created: item.created,
                            author: item.author
                        }));
                    }),

                    getOne: vi.fn(async (id: string) => {
                        const entry = mockEntries.get(id);
                        if (!entry) throw new Error("Entry not found.");
                        return { ...entry };
                    }),

                    update: vi.fn(async (id: string, data: { title: string; body: string }) => {
                        const entry = mockEntries.get(id);
                        if (!entry) throw new Error("Entry not found.");
                        const updated = {
                            ...entry,
                            title: data.title,
                            body: data.body,
                            updated: new Date().toISOString()
                        };
                        mockEntries.set(id, updated);
                        return updated;
                    }),

                    delete: vi.fn(async (id: string) => {
                        if (!mockEntries.has(id)) throw new Error("Entry not found.");
                        mockEntries.delete(id);
                        return true;
                    })
                } as any;
            }

            throw new Error(`Collection ${collectionName} is not mocked.`);
        });
    });

    afterEach(() => {
        logOut();
        if (collectionSpy) {
            collectionSpy.mockRestore();
        }
    });

    // ==========================================
    // 1. Authentication & User Tests
    // ==========================================
    describe("Authentication & Session Interactions", () => {
        it("should register a new user in the database with authSecret and vaultCheck canary", async () => {
            const email = "carmen.laforet@example.com";
            const password = "laforet-master-password";
            const keys: DerivedKeys = await deriveKeys(password, email);

            // 1. Create user in database (only authSecret is sent, NEVER raw password)
            const createdUser = await pb.collection("users").create({
                email,
                password: keys.authSecret,
                passwordConfirm: keys.authSecret,
                name: "Carmen Laforet"
            });

            expect(createdUser.id).toBeDefined();
            expect(createdUser.email).toBe(email);

            // Verify stored record in database contains authSecret (64 hex characters) and NOT the raw password
            const storedInDb = mockUsers.get(createdUser.id);
            expect(storedInDb?.password).toBe(keys.authSecret);
            expect(storedInDb?.password).not.toBe(password);
            expect(storedInDb?.password).toMatch(/^[0-9a-f]{64}$/);

            // 2. Authenticate
            await pb.collection("users").authWithPassword(email, keys.authSecret);
            expect(pb.authStore.isValid).toBe(true);
            expect(currentUser()?.id).toBe(createdUser.id);

            // 3. Generate encrypted canary and update user record
            const encryptedCanary = await encryptText("success", keys.encKey);
            await pb.collection("users").update(currentUser()!.id, { vaultCheck: encryptedCanary });

            // Verify canary is properly stored in database
            const updatedUser = await pb.collection("users").getOne(currentUser()!.id);
            expect(updatedUser.vaultCheck).toBeDefined();
            expect(updatedUser.vaultCheck).toMatch(/^v1:[0-9a-f]{24}:[0-9a-f]+/);
        });

        it("should successfully log in, set currentUser signal, and unlock vaultKey", async () => {
            const email = "reader@example.com";
            const password = "secure-vault-pass";
            const keys = await deriveKeys(password, email);

            // Seed user in database
            const userId = "usr_reader123";
            const canary = await encryptText("success", keys.encKey);
            mockUsers.set(userId, {
                id: userId,
                email,
                password: keys.authSecret,
                name: "Avid Reader",
                vaultCheck: canary
            });

            // Perform login flow (matches LoginForm.tsx)
            const derived = await deriveKeys(password, email);
            await pb.collection("users").authWithPassword(email, derived.authSecret);
            setVaultKey(derived.encKey);

            // Assertions on PocketBase authStore and SolidJS signals
            expect(pb.authStore.isValid).toBe(true);
            expect(currentUser()).not.toBeNull();
            expect(currentUser()?.id).toBe(userId);
            expect(currentUser()?.email).toBe(email);
            expect(vaultKey()).not.toBeNull();
            expect(vaultKey()).toBe(derived.encKey);
        });

        it("should reject login when incorrect credentials are provided", async () => {
            const email = "author@example.com";
            const correctKeys = await deriveKeys("correct-password", email);
            const wrongKeys = await deriveKeys("wrong-password", email);

            // Seed user with correct authSecret
            mockUsers.set("usr_author", {
                id: "usr_author",
                email,
                password: correctKeys.authSecret
            });

            // Attempt login with wrong authSecret
            await expect(
                pb.collection("users").authWithPassword(email, wrongKeys.authSecret)
            ).rejects.toThrow("Invalid login credentials.");

            // Verify session was not established
            expect(pb.authStore.isValid).toBe(false);
            expect(currentUser()).toBeNull();
            expect(vaultKey()).toBeNull();
        });

        it("should verify vault password against the stored canary token (UnlockVault)", async () => {
            const email = "lock@example.com";
            const password = "my-secret-vault-password";
            const keys = await deriveKeys(password, email);

            // Seed user with canary
            const canary = await encryptText("success", keys.encKey);
            const userRecord = { id: "usr_lock", email, password: keys.authSecret, vaultCheck: canary };
            mockUsers.set("usr_lock", userRecord);

            // Simulate logged in authStore (session exists, but vaultKey is locked/null)
            pb.authStore.save(createMockJWT("usr_lock"), mockRecordModel(userRecord));
            setVaultKey(null);
            expect(vaultKey()).toBeNull();

            // 1. Successful Unlock: Correct password decrypts the canary token
            const attemptKeys = await deriveKeys(password, currentUser()!.email);
            const fetchedUser = await pb.collection("users").getOne(currentUser()!.id);
            const decryptedCanary = await decryptText(fetchedUser.vaultCheck!, attemptKeys.encKey);
            expect(decryptedCanary).toBe("success");
            setVaultKey(attemptKeys.encKey);
            expect(vaultKey()).not.toBeNull();

            // 2. Failed Unlock: Wrong password fails to decrypt canary
            const wrongKeys = await deriveKeys("wrong-vault-password", currentUser()!.email);
            await expect(
                decryptText(fetchedUser.vaultCheck!, wrongKeys.encKey)
            ).rejects.toThrow();
        });

        it("should wipe authStore, currentUser, and vaultKey upon logout", async () => {
            const email = "logout.test@example.com";
            const keys = await deriveKeys("password123", email);
            const token = createMockJWT("usr_logout");

            pb.authStore.save(token, mockRecordModel({ id: "usr_logout", email }));
            setVaultKey(keys.encKey);

            expect(currentUser()).not.toBeNull();
            expect(vaultKey()).not.toBeNull();

            // Execute logOut()
            logOut();

            expect(pb.authStore.isValid).toBe(false);
            expect(currentUser()).toBeNull();
            expect(vaultKey()).toBeNull();
        });
    });

    // ==========================================
    // 2. CRUD Operations on Entries
    // ==========================================
    describe("CRUD Operations on Entries Collection", () => {
        let activeKeys: DerivedKeys;
        const testAuthorId = "usr_carmen";

        beforeEach(async () => {
            activeKeys = await deriveKeys("carmen-master-key", "carmen@laforet.es");
            const token = createMockJWT(testAuthorId);
            pb.authStore.save(token, mockRecordModel({ id: testAuthorId, email: "carmen@laforet.es" }));
            setVaultKey(activeKeys.encKey);
        });

        it("CREATE: should encrypt title and body with AES-GCM before saving to database", async () => {
            const plainTitle = "Calle Aribau";
            const plainBody = "# Primeras impresiones\nLa casa de la calle de Aribau era una pesadilla de polvo y sombras.";

            const key = vaultKey()!;
            const encryptedTitle = await encryptText(plainTitle, key);
            const encryptedBody = await encryptText(plainBody, key);

            // Call database create (matches Write.tsx)
            const created = await pb.collection("entries").create({
                title: encryptedTitle,
                body: encryptedBody,
                author: currentUser()?.id!
            });

            expect(created.id).toBeDefined();
            expect(created.author).toBe(testAuthorId);

            // Check database contents: MUST NOT store plaintext
            const stored = mockEntries.get(created.id)!;
            expect(stored.title).not.toBe(plainTitle);
            expect(stored.body).not.toBe(plainBody);
            expect(stored.title).toMatch(/^v1:[0-9a-f]{24}:[0-9a-f]+/);
            expect(stored.body).toMatch(/^v1:[0-9a-f]{24}:[0-9a-f]+/);

            // Decrypting stored data with the user's key restores original text
            expect(await decryptText(stored.title, key)).toBe(plainTitle);
            expect(await decryptText(stored.body, key)).toBe(plainBody);
        });

        it("READ (List): should fetch and decrypt all entries from database", async () => {
            const key = vaultKey()!;

            // Seed 3 encrypted entries in database
            const entriesData = [
                { title: "Entrada 1 - Octubre", body: "Llegué a Barcelona..." },
                { title: "Entrada 2 - Noviembre", body: "La Universidad Central..." },
                { title: "Entrada 3 - Diciembre", body: "La amistad con Ena..." },
            ];

            for (const item of entriesData) {
                await pb.collection("entries").create({
                    title: await encryptText(item.title, key),
                    body: await encryptText(item.body, key),
                    author: testAuthorId
                });
            }

            // Fetch list from database (matches ListEntries.tsx)
            const rawEntries = await pb.collection("entries").getFullList<{ id: string; title: string; created: string }>({
                sort: "-created",
                fields: "id,title,created"
            });

            expect(rawEntries.length).toBe(3);

            // Decrypt each entry's title
            const decryptedEntries = await Promise.all(
                rawEntries.map(async (entry) => ({
                    id: entry.id,
                    title: await decryptText(entry.title, key)
                }))
            );

            expect(decryptedEntries.map(e => e.title)).toEqual([
                "Entrada 3 - Diciembre",
                "Entrada 2 - Noviembre",
                "Entrada 1 - Octubre"
            ]);
        });

        it("READ (List): should catch and handle decryption error if entry was encrypted with another key", async () => {
            const correctKey = vaultKey()!;
            const foreignKeys = await deriveKeys("another-user-password", "foreign@example.com");

            // Seed one valid entry and one foreign/corrupt entry
            await pb.collection("entries").create({
                title: await encryptText("Mi entrada válida", correctKey),
                body: await encryptText("Contenido propio", correctKey),
                author: testAuthorId
            });
            await pb.collection("entries").create({
                title: await encryptText("Entrada ajena o corrupta", foreignKeys.encKey),
                body: await encryptText("Contenido ajeno", foreignKeys.encKey),
                author: "other_user"
            });

            const rawEntries = await pb.collection("entries").getFullList<{ id: string; title: string; created: string }>();

            // Simulate the decryption loop in ListEntries.tsx with error fallback
            const results = await Promise.all(
                rawEntries.map(async (entry) => {
                    try {
                        return { id: entry.id, title: await decryptText(entry.title, correctKey) };
                    } catch {
                        return { id: entry.id, title: "🔒 [Decryption Error]" };
                    }
                })
            );

            expect(results.some(r => r.title === "Mi entrada válida")).toBe(true);
            expect(results.some(r => r.title === "🔒 [Decryption Error]")).toBe(true);
        });

        it("READ (Single Entry): should fetch one entry and decrypt title and body (Entry.tsx)", async () => {
            const key = vaultKey()!;
            const plainTitle = "Pensamientos de medianoche";
            const plainBody = "## Reflexión nocturna\n\nTodo parece más silencioso a estas horas.";

            const created = await pb.collection("entries").create({
                title: await encryptText(plainTitle, key),
                body: await encryptText(plainBody, key),
                author: testAuthorId
            });

            // Fetch one entry from database (matches Entry.tsx fetchEntry)
            const entryRecord = await pb.collection("entries").getOne(created.id);

            expect(entryRecord.id).toBe(created.id);
            const decryptedTitle = await decryptText(entryRecord.title, key);
            const decryptedBody = await decryptText(entryRecord.body, key);

            expect(decryptedTitle).toBe(plainTitle);
            expect(decryptedBody).toBe(plainBody);
        });

        it("UPDATE: should re-encrypt updated title and body and save to database (EditEntry.tsx)", async () => {
            const key = vaultKey()!;
            const originalTitle = "Borrador Inicial";
            const originalBody = "Texto provisional sin pulir.";

            const created = await pb.collection("entries").create({
                title: await encryptText(originalTitle, key),
                body: await encryptText(originalBody, key),
                author: testAuthorId
            });

            const updatedTitle = "Capítulo 1: La Llegada (Revisado)";
            const updatedBody = "La estación de Francia estaba envuelta en una neblina densa...";

            // Re-encrypt updated data with new IVs
            const newEncryptedTitle = await encryptText(updatedTitle, key);
            const newEncryptedBody = await encryptText(updatedBody, key);

            // Update database record (matches EditEntry.tsx)
            const updatedRecord = await pb.collection("entries").update(created.id, {
                title: newEncryptedTitle,
                body: newEncryptedBody
            });

            expect(updatedRecord.id).toBe(created.id);

            // Verify database contains updated ciphertexts
            const fetched = await pb.collection("entries").getOne(created.id);
            expect(fetched.title).toBe(newEncryptedTitle);
            expect(fetched.body).toBe(newEncryptedBody);

            // Verify ciphertexts decrypt to the updated plaintexts
            expect(await decryptText(fetched.title, key)).toBe(updatedTitle);
            expect(await decryptText(fetched.body, key)).toBe(updatedBody);
        });

        it("DELETE: should remove entry from database and verify it can no longer be retrieved", async () => {
            const key = vaultKey()!;

            const created = await pb.collection("entries").create({
                title: await encryptText("Entrada para eliminar", key),
                body: await encryptText("Este contenido debe desaparecer.", key),
                author: testAuthorId
            });

            expect(mockEntries.has(created.id)).toBe(true);

            // Delete entry (matches ListEntries.tsx removeEntry)
            const deleteResult = await pb.collection("entries").delete(created.id);
            expect(deleteResult).toBe(true);

            // Verify entry is removed from database
            expect(mockEntries.has(created.id)).toBe(false);

            // Verify getOne on deleted ID rejects with not found
            await expect(
                pb.collection("entries").getOne(created.id)
            ).rejects.toThrow("Entry not found.");

            // Verify entry no longer appears in getFullList
            const list = await pb.collection("entries").getFullList();
            expect(list.some(e => e.id === created.id)).toBe(false);
        });
    });
});
