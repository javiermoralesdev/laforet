import { createSignal, Show } from "solid-js";
import { currentUser, pb } from "../lib/pocketbase";
import Modal from "../lib/Modal";
import { useNavigate } from "@solidjs/router";
import { deriveKey, setVaultKey } from "../lib/crypto";
import { useLocale } from "../i18n";
import styles from "./Auth.module.scss";

export default function LoginForm() {
    const { t } = useLocale();
    // Replace the old import.meta.env line with this:
    const signupsDisabled = (window as any).__ENV__?.VITE_DISABLE_SIGNUPS === "true" || import.meta.env.VITE_DISABLE_SIGNUPS === "true";
    const [email, setEmail] = createSignal("");
    const [password, setPassword] = createSignal("");
    const [isErrorOpen, setIsErrorOpen] = createSignal(false);
    const [errorMessage, setErrorMessage] = createSignal("");
    const navigate = useNavigate();

    const login = async (e: Event) => {
        e.preventDefault();
        try {
            await pb.collection("users").authWithPassword(email(), password());
            const key = await deriveKey(password(), currentUser()?.id || "");
            setVaultKey(key);
        } catch (error) {
            setErrorMessage(t("login_error"));
            setIsErrorOpen(true);
        }
    }

    return (
        <div class={styles.authContainer}>
            <div class={styles.authCard}>
                <h2>{t("login_title")}</h2>
                <form onSubmit={login}>
                    <input
                        type="email"
                        placeholder={t("login_email")}
                        value={email()}
                        onInput={(e) => setEmail(e.currentTarget.value)}
                    />
                    <input
                        type="password"
                        placeholder={t("login_password")}
                        value={password()}
                        onInput={(e) => setPassword(e.currentTarget.value)}
                    />
                    <button type="submit" class={styles.primaryBtn}>
                        {t("login_submit")}
                    </button>
                    <Show when={!signupsDisabled}>
                        <button type="button" class={styles.textBtn} onClick={() => navigate("/signup")}>
                            {t("login_signup_link")}
                        </button>
                    </Show>
                </form>
            </div>
            <Modal title={t("info")} isOpen={isErrorOpen()} onClose={() => setIsErrorOpen(false)}>
                <p>{errorMessage()}</p>
            </Modal>
        </div>
    );
}