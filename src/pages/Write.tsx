import { createSignal, Show } from "solid-js";
import { currentUser, pb } from "../lib/pocketbase";
import Modal from "../lib/Modal";
import { useNavigate } from "@solidjs/router";
import { encryptText, vaultKey } from "../lib/crypto";
import UnlockVault from "../lib/UnlockVault";
import { useLocale } from "../i18n";
import { marked } from "marked";
import styles from "./Editor.module.scss";

export default function Write() {
    const { t } = useLocale();
    const [title, setTitle] = createSignal("");
    const [body, setBody] = createSignal("");
    const [isErrorOpen, setIsErrorOpen] = createSignal(false);
    const [errorMessage, setErrorMessage] = createSignal("");
    const [entrySaved, setEntrySaved] = createSignal(false);
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = createSignal<"edit" | "preview">("edit");

    const handleSubmit = async (e: Event) => {
        e.preventDefault();

        if (!title() || title().trim() === "" || !body() || body().trim() === "") {
            setErrorMessage(t("editor_err_empty"));
            setIsErrorOpen(true);
            return;
        }
        try {
            const key = vaultKey();
            await pb.collection("entries").create({
                title: await encryptText(title(), key!),
                body: await encryptText(body(), key!),
                author: currentUser()?.id
            });
            setEntrySaved(true);
            setErrorMessage(t("editor_success_save"));
            setIsErrorOpen(true);
        } catch (_) {
            setErrorMessage(t("editor_err_save"));
            setIsErrorOpen(true);
        }
    };

    return (
        <Show when={vaultKey()} fallback={<UnlockVault />}>
            <div class={styles.editorContainer}>
                <form onSubmit={handleSubmit} class={styles.editorForm}>
                    <div class={styles.header}>
                        <input 
                            type="text" class={styles.titleInput} placeholder={t("editor_title_placeholder")} 
                            value={title()} onInput={(e) => setTitle(e.currentTarget.value)} 
                        />
                        <button type="submit" class={styles.saveBtn}>{t("editor_save")}</button>
                    </div>

                    <div class={styles.tabContainer}>
                        <button type="button" class={activeTab() === "edit" ? styles.activeTab : styles.tabBtn} onClick={() => setActiveTab("edit")}>
                            {t("editor_write_tab")}
                        </button>
                        <button type="button" class={activeTab() === "preview" ? styles.activeTab : styles.tabBtn} onClick={() => setActiveTab("preview")}>
                            {t("editor_preview_tab")}
                        </button>
                    </div>

                    <div class={styles.editorBody}>
                        <Show when={activeTab() === "edit"}>
                            <textarea placeholder={t("editor_body_placeholder")} value={body()} class={styles.bodyInput} onInput={(e) => setBody(e.currentTarget.value)} />
                        </Show>
                        <Show when={activeTab() === "preview"}>
                            <div class={styles.previewPane} innerHTML={marked.parse(body() || t("editor_preview_empty")) as string} />
                        </Show>
                    </div>
                </form>
                <Modal isOpen={isErrorOpen()} title={t("info")} onClose={() => { setIsErrorOpen(false); if (entrySaved()) navigate("/"); }}>
                    <p>{errorMessage()}</p>
                </Modal>
            </div>
        </Show>
    );
}