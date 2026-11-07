import { createResource, createSignal, For, Show } from "solid-js";
import { pb } from "../lib/pocketbase";
import { useNavigate } from "@solidjs/router";
import Modal from "../lib/Modal";
import { vaultKey, decryptText } from "../lib/crypto";
import UnlockVault from "../lib/UnlockVault";
import LanguageSwitcher from "./LanguageSwitcher";
import { useLocale } from "../i18n";
import styles from './ListEntries.module.scss';

interface EntrySummary {
    id: string;
    title: string;
    created: string;
}

function logOut() {
    pb.authStore.clear();
}

export default function ListEntry() {
    const { t } = useLocale();
    const navigate = useNavigate();

    // Moved the fetcher inside so it can use t() for fallback decryption error messages
    const [entries, { refetch }] = createResource(vaultKey, async (key) => {
        if (!key) return [];
        const rawEntries = await pb.collection("entries").getFullList<EntrySummary>({
            sort: "-created",
            fields: "id,title,created"
        });
        return await Promise.all(
            rawEntries.map(async (entry) => {
                try {
                    return { ...entry, title: await decryptText(entry.title, key) };
                } catch (err) {
                    return { ...entry, title: t("list_decryption_error") };
                }
            })
        );
    });

    const [modalMessage, setModalMessage] = createSignal("");
    const [isErrorOpen, setErrorOpen] = createSignal(false);
    const [entryToDelete, setEntryToDelete] = createSignal<EntrySummary | null>(null);

    function promptDelete(entry: EntrySummary) {
        setEntryToDelete(entry);
    }

    async function confirmDelete() {
        const target = entryToDelete();
        if (!target) return;
        setEntryToDelete(null);
        try {
            await pb.collection("entries").delete(target.id);
            refetch();
            setModalMessage(t("list_del_success"));
            setErrorOpen(true);
        } catch (err) {
            setModalMessage(t("error") + " " + (err instanceof Error ? err.message : String(err)));
            setErrorOpen(true);
        }
    }

    return (
        <Show when={vaultKey()} fallback={<UnlockVault />}>
            <div class={styles.dashboard}>
                <div class={styles.header}>
                    <h2>{t("list_title")}</h2>
                    <div class={styles.actions}>
                        <LanguageSwitcher />
                        <button class={styles.secondaryBtn} onClick={refetch}>
                            {t("list_refresh")}
                        </button>
                        <button class={styles.dangerBtn} onClick={logOut}>
                            {t("list_logout")}
                        </button>
                        <button class={styles.primaryBtn} onClick={() => navigate("/write")}>
                            {t("list_write")}
                        </button>
                    </div>
                </div>
                
                <Show when={entries.loading}>
                    <p>{t("list_loading")}</p>
                </Show>
                
                <Show when={entries.error}>
                    <p>{t("error")} {entries.error.message}</p>
                </Show>
                
                <ul class={styles.entryList}>
                    <For each={entries()} fallback={<p>{t("list_empty")}</p>}>
                        {(entry) => (
                            <li class={styles.entryCard}>
                                <div class={styles.entryInfo}>
                                    <h3><a href={"/entry/" + entry.id}>{entry.title}</a></h3>
                                    <small>{new Date(entry.created).toLocaleString()}</small>
                                </div>
                                <div class={styles.entryActions}>
                                    <button onClick={() => navigate("/edit/" + entry.id)}>
                                        {t("list_edit")}
                                    </button>
                                    <button class={styles.deleteBtn} onClick={() => promptDelete(entry)}>
                                        {t("list_remove")}
                                    </button>
                                </div>
                            </li>
                        )}
                    </For>
                </ul>

                {/* Delete Confirmation Modal */}
                <Modal 
                    isOpen={!!entryToDelete()} 
                    title={t("list_del_confirm_title")} 
                    onClose={() => setEntryToDelete(null)}
                    onConfirm={confirmDelete}
                    confirmText={t("list_remove")}
                    cancelText={t("modal_cancel")}
                    danger={true}
                >
                    <p>{t("list_del_confirm_msg")}</p>
                    <Show when={entryToDelete()?.title}>
                        <p style={{ "font-style": "italic", "color": "var(--text-muted)", "margin-top": "0.5rem" }}>
                            «{entryToDelete()!.title}»
                        </p>
                    </Show>
                </Modal>
                
                {/* Info / Feedback Modal */}
                <Modal isOpen={isErrorOpen()} title={t("info")} onClose={() => setErrorOpen(false)}>
                    <p>{modalMessage()}</p>
                </Modal>
            </div>
        </Show>
    );
}
