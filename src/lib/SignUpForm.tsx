import { useNavigate } from "@solidjs/router";
import { createSignal } from "solid-js";
import { currentUser, pb } from "../lib/pocketbase";
import Modal from "../lib/Modal";
import { deriveKeys, encryptText, setVaultKey } from "../lib/crypto";
import { useLocale } from "../i18n";
import styles from "./Auth.module.scss";

export default function SignUpForm() {
    const { t } = useLocale();
    const navigate = useNavigate();
    // Replace the old import.meta.env line with this:
    const signupsDisabled = (window as any).__ENV__?.VITE_DISABLE_SIGNUPS === "true" || import.meta.env.VITE_DISABLE_SIGNUPS === "true";
    const [name, setName] = createSignal("");
    const [email, setEmail] = createSignal("");
    const [password, setPassword] = createSignal("");
    const [passwordConfirm, setPasswordConfirm] = createSignal("");
    const [isModalOpen, setIsModalOpen] = createSignal(false);
    const [modalMessage, setModalMessage] = createSignal("");
    const [shouldRedirect, setShouldRedirect] = createSignal(false);

    const handleSubmit = async (e: Event) => {
        e.preventDefault();

        if (!email() || !password() || !passwordConfirm()) {
            setModalMessage(t("signup_err_empty"));
            setIsModalOpen(true);
            return;
        }

        if (password() !== passwordConfirm()) {
            setModalMessage(t("signup_err_match"));
            setIsModalOpen(true);
            return;
        }

        try {
            const key = await deriveKeys(password(), email());
            await pb.collection("users").create({ email: email(), password: key.authSecret, passwordConfirm: key.authSecret, name: name() });
            await pb.collection("users").authWithPassword(email(), key.authSecret);

            const encryptedCanary = await encryptText("success", key.encKey);
            await pb.collection("users").update(currentUser()?.id || "", { vaultCheck: encryptedCanary });
            setVaultKey(key.encKey);

            setShouldRedirect(true);
            setModalMessage(t("signup_success"));
            setIsModalOpen(true);
        } catch (_) {
            setModalMessage(t("signup_err_creation"));
            setIsModalOpen(true);
        }
    };

    if (signupsDisabled) {
        return (
            <div>
                <h1>{t("signup_closed_title")}</h1>
                <p>{t("signup_closed_desc")}</p>
            </div>
        );
    }

    return (
        <div class={styles.authContainer}>
            <div class={styles.authCard}>
                <form onSubmit={handleSubmit}>
                    <h2>{t("signup_title")}</h2>
                    <input type="text" placeholder={t("signup_name")} value={name()} onInput={(e) => setName(e.currentTarget.value)} />
                    <input type="email" placeholder={t("login_email")} value={email()} onInput={(e) => setEmail(e.currentTarget.value)} />
                    <input type="password" placeholder={t("login_password")} value={password()} onInput={(e) => setPassword(e.currentTarget.value)} />
                    <input type="password" placeholder={t("signup_repeat_password")} value={passwordConfirm()} onInput={(e) => setPasswordConfirm(e.currentTarget.value)} />

                    {/* The Warning Callout */}
                    <div style={{
                        "background-color": "#fff3cd",
                        color: "#856404",
                        padding: "1rem",
                        "border-radius": "8px",
                        border: "1px solid #ffeeba",
                        "font-size": "0.9rem",
                        "line-height": "1.4"
                    }}>
                        <strong style={{ display: "block", "margin-bottom": "0.5rem" }}>
                            {t("signup_warning_title")}
                        </strong>
                        {t("signup_warning_desc")}
                    </div>

                    <input class={styles.primaryBtn} type="submit" value={t("signup_submit")} />
                </form>
                <Modal isOpen={isModalOpen()} title={t("info")} onClose={() => { setIsModalOpen(false); if (shouldRedirect()) navigate("/"); }}>
                    <p>{modalMessage()}</p>
                </Modal>
            </div>
        </div>
    );
}