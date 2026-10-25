import { useNavigate } from "@solidjs/router";
import { createSignal } from "solid-js";
import { currentUser, pb } from "../lib/pocketbase";
import Modal from "../lib/Modal";
import { deriveKey, encryptText, setVaultKey } from "../lib/crypto";
import { useLocale } from "../i18n";
import styles from "./Auth.module.scss";

export default function SignUpForm() {
    const { t } = useLocale();
    const navigate = useNavigate();
    const signupsDisabled = import.meta.env.VITE_DISABLE_SIGNUPS === "true";
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
            await pb.collection("users").create({ email: email(), password: password(), passwordConfirm: passwordConfirm(), name: name() });
            await pb.collection("users").authWithPassword(email(), password());

            const key = await deriveKey(password(), currentUser()?.id || "");
            const encryptedCanary = await encryptText("success", key);
            await pb.collection("users").update(currentUser()?.id || "", { vaultCheck: encryptedCanary });
            setVaultKey(key);
            
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
                    <input class={styles.primaryBtn} type="submit" value={t("signup_submit")} />
                </form>
                <Modal isOpen={isModalOpen()} title={t("info")} onClose={() => { setIsModalOpen(false); if (shouldRedirect()) navigate("/"); }}>
                    <p>{modalMessage()}</p>
                </Modal>
            </div>
        </div>
    );
}