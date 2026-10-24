import { createSignal } from "solid-js";
import { pb, currentUser } from "../lib/pocketbase";
import { deriveKey, decryptText } from "../lib/crypto";
import { setVaultKey } from "../lib/crypto";

export default function UnlockVault() {
    const [password, setPassword] = createSignal("");
    const [error, setError] = createSignal("");

    const handleUnlock = async (e: Event) => {
        e.preventDefault();
        setError("");

        try {
            console.log("Decrypt...");
            // 1. Derive the hypothetical key from their input
            const tempKey = await deriveKey(password(), currentUser()?.id || "");

            // 2. Fetch their stored canary from PocketBase
            const userRecord = await pb.collection("users").getOne(currentUser()?.id || "");

            // 3. Attempt to decrypt the canary
            await decryptText(userRecord.vaultCheck, tempKey);

            // 4. If the line above didn't throw an error, the password is CORRECT!
            console.log("Correct");
            setVaultKey(tempKey);
            // navigate("/") or close the unlock screen here...

        } catch (err) {
            // If decryptText throws, the password was WRONG.
            setError("Incorrect vault password. Please try again.");
            setVaultKey(null);
        }
    };

    return (
        <form onSubmit={handleUnlock}>
            <h2>Unlock your Diary</h2>
            <input
                type="password"
                placeholder="Vault Password"
                value={password()}
                onInput={(e) => setPassword(e.currentTarget.value)}
            />
            <button type="submit">Unlock</button>
            {error() && <p style={{ color: "red" }}>{error()}</p>}
        </form>
    );
}