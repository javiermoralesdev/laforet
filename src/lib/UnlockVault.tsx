import { createSignal } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { pb, currentUser, logOut } from "../lib/pocketbase";
import { deriveKeys, decryptText, setVaultKey } from "../lib/crypto";
import { useLocale } from "../i18n";
import styles from './Auth.module.scss';

export default function UnlockVault() {
    const { t } = useLocale();
    const navigate = useNavigate();
    const [password, setPassword] = createSignal("");
    const [error, setError] = createSignal("");

    const handleUnlock = async (e: Event) => {
        e.preventDefault();
        setError("");
        try {
            const tempKey = await deriveKeys(password(), currentUser()?.email|| "");
            const userRecord = await pb.collection("users").getOne(currentUser()?.id || "");
            await decryptText(userRecord.vaultCheck, tempKey.encKey);
            setVaultKey(tempKey.encKey);
        } catch (err) {
            setError(t("unlock_error"));
            setVaultKey(null);
        }
    };

    const handleSignOut = () => {
        logOut();
        navigate("/");
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
                        autocomplete="current-password"
                    />
                    <button class={styles.primaryBtn} type="submit">{t("unlock_submit")}</button>
                    {error() && <p>{error()}</p>}
                    <button type="button" class={styles.signOutBtn} onClick={handleSignOut}>
                        {t("unlock_signout")}
                    </button>
                </form>
            </div>
        </div>
    );
}
