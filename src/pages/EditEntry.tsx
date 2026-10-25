import { useNavigate, useParams } from "@solidjs/router";
import { createEffect, createResource, createSignal, Show } from "solid-js";
import { currentUser, pb } from "../lib/pocketbase";
import Modal from "../lib/Modal";
import type { EntryDetails } from "./Entry";
import { decryptText, encryptText, vaultKey } from "../lib/crypto";
import UnlockVault from "../lib/UnlockVault";
import { useLocale } from "../i18n";
import { marked } from "marked";
import styles from './Editor.module.scss';

async function fetchEntry(id: string): Promise<EntryDetails> {
    return pb.collection("entries").getOne(id);
}

export default function EditEntry() {
    const { t } = useLocale();
    const params = useParams();
    const [body, setBody] = createSignal("");
    const [title, setTitle] = createSignal("");
    const [activeTab, setActiveTab] = createSignal<"edit" | "preview">("edit");
    const [isErrorOpen, setIsErrorOpen] = createSignal(false);
    const [errorMessage, setErrorMessage] = createSignal("");
    const [shouldRedirect, setShouldRedirect] = createSignal(false);
    const navigate = useNavigate();
    const [entry] = createResource(() => params.id, fetchEntry);

    createEffect(async () => {
        if (!params.id) {
            setErrorMessage(t("editor_err_no_url_id"));
            setShouldRedirect(true); setIsErrorOpen(true); return;
        }
        if (entry.error) {
            setErrorMessage(t("editor_err_load"));
            setShouldRedirect(true); setIsErrorOpen(true); return;
        }
        const key = vaultKey();
        if (!key) return;
        const data = entry();
        if (data) {
            try {
                setTitle(await decryptText(data.title, key));
                setBody(await decryptText(data.body, key));
            } catch (err) {
                setErrorMessage(t("editor_err_decrypt"));
                setShouldRedirect(true); setIsErrorOpen(true);
            }
        }
    });

    const handleSubmit = async (e: Event) => {
        e.preventDefault();
        if (!title() || title().trim() === "" || !body() || body().trim() === "") {
            setErrorMessage(t("editor_err_empty")); setIsErrorOpen(true); return;
        }
        try {
            if (!params.id) {
                setErrorMessage(t("editor_err_no_id"));
                setShouldRedirect(true); setIsErrorOpen(true); return;
            }
            const key = vaultKey();
            if (!key) return;
            await pb.collection("entries").update(params.id, {
                title: await encryptText(title(), key),
                body: await encryptText(body(), key),
                author: currentUser()?.id
            });
            setShouldRedirect(true);
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
                            value={title()} onInput={(e) => setTitle(e.currentTarget.value)} disabled={entry.loading || !!entry.error} 
                        />
                        <button type="submit" class={styles.saveBtn} disabled={entry.loading || !!entry.error}>{t("editor_save")}</button>
                    </div>

                    <div class={styles.tabContainer}>
                        <button type="button" class={activeTab() === "edit" ? styles.activeTab : styles.tabBtn} onClick={() => setActiveTab("edit")}>{t("editor_write_tab")}</button>
                        <button type="button" class={activeTab() === "preview" ? styles.activeTab : styles.tabBtn} onClick={() => setActiveTab("preview")}>{t("editor_preview_tab")}</button>
                    </div>

                    <div class={styles.editorBody}>
                        <Show when={activeTab() === "edit"}>
                            <textarea placeholder={t("editor_body_placeholder")} value={body()} class={styles.bodyInput} onInput={(e) => setBody(e.currentTarget.value)} disabled={entry.loading || !!entry.error} />
                        </Show>
                        <Show when={activeTab() === "preview"}>
                            <div class={styles.previewPane} innerHTML={marked.parse(body() || t("editor_preview_empty")) as string} />
                        </Show>
                    </div>
                </form>
                <Modal isOpen={isErrorOpen()} onClose={() => { setIsErrorOpen(false); if (shouldRedirect()) navigate("/"); }} title={t("info")}>
                    <p>{errorMessage()}</p>
                </Modal>
            </div>
        </Show>
    );
}