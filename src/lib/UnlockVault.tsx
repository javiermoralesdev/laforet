import { createSignal } from "solid-js";
import { pb, currentUser } from "../lib/pocketbase";
import { deriveKey, decryptText, setVaultKey } from "../lib/crypto";
import { useLocale } from "../i18n";
import styles from './Auth.module.scss';

export default function UnlockVault() {
    const { t } = useLocale();
    const [password, setPassword] = createSignal("");
    const [error, setError] = createSignal("");

    const handleUnlock = async (e: Event) => {
        e.preventDefault();
        setError("");
        try {
            const tempKey = await deriveKey(password(), currentUser()?.id || "");
            const userRecord = await pb.collection("users").getOne(currentUser()?.id || "");
            await decryptText(userRecord.vaultCheck, tempKey);
            setVaultKey(tempKey);
        } catch (err) {
            setError(t("unlock_error"));
            setVaultKey(null);
        }
    };

    return (
        <div class={styles.authContainer}>
            <div class={styles.authCard}>
                <form onSubmit={handleUnlock}>
                    <h2>{t("unlock_title")}</h2>
                    <input
                        type="password"
                        placeholder={t("unlock_password")}
                        value={password()}
                        onInput={(e) => setPassword(e.currentTarget.value)}
                    />
                    <button class={styles.primaryBtn} type="submit">{t("unlock_submit")}</button>
                    {error() && <p style={{ color: "red"}}>{error()}</p>}
                </form>
            </div>
        </div>
    );
}