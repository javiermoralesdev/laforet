import { useNavigate, useParams } from "@solidjs/router";
import { createEffect, createResource, createSignal, Show } from "solid-js";
import { currentUser, pb } from "../lib/pocketbase";
import Modal from "../lib/Modal";
import type { EntryDetails } from "./Entry";
import { decryptText, encryptText, vaultKey } from "../lib/crypto";
import UnlockVault from "../lib/UnlockVault";
import styles from './Editor.module.scss';
// 1. Importa marked para el parseo de Markdown
import { marked } from "marked";

async function fetchEntry(id: string): Promise<EntryDetails> {
    return pb.collection("entries").getOne(id);
}

export default function EditEntry() {
    const params = useParams();
    const [body, setBody] = createSignal("");
    const [title, setTitle] = createSignal("");
    
    // 2. Estado para controlar la pestaña activa ("edit" o "preview")
    const [activeTab, setActiveTab] = createSignal<"edit" | "preview">("edit");

    const [isErrorOpen, setIsErrorOpen] = createSignal(false);
    const [errorMessage, setErrorMessage] = createSignal("");
    const [shouldRedirect, setShouldRedirect] = createSignal(false);
    const navigate = useNavigate();

    const [entry] = createResource(() => params.id, fetchEntry);

    createEffect(async () => {
        if (!params.id) {
            setErrorMessage("No entry ID provided in the URL.");
            setShouldRedirect(true);
            setIsErrorOpen(true);
            return;
        }

        if (entry.error) {
            setErrorMessage("Failed to load the entry. It may have been deleted.");
            setShouldRedirect(true);
            setIsErrorOpen(true);
            return;
        }

        const key = vaultKey();
        if (!key) {
            return;
        }

        const data = entry();
        if (data) {
            try {
                const plainTitle = await decryptText(data.title, key);
                const plainBody = await decryptText(data.body, key);

                setTitle(plainTitle);
                setBody(plainBody);
            } catch (err) {
                setErrorMessage("Failed to decrypt entry. Wrong vault password?");
                setShouldRedirect(true);
                setIsErrorOpen(true);
            }
        }
    });

    const handleSubmit = async (e: Event) => {
        e.preventDefault();

        if (!title() || title().trim() === "" ||
            !body() || body().trim() === "") {
            setErrorMessage("The title and/or body can't be empty");
            setIsErrorOpen(true);
            return;
        }

        try {
            if (!params.id) {
                setErrorMessage("No entry ID provided.");
                setShouldRedirect(true);
                setIsErrorOpen(true);
                return;
            }

            const key = vaultKey();
            if (!key) return;

            const encryptedTitle = await encryptText(title(), key);
            const encryptedBody = await encryptText(body(), key);

            await pb.collection("entries").update(params.id, {
                title: encryptedTitle,
                body: encryptedBody,
                author: currentUser()?.id
            });

            setShouldRedirect(true);
            setErrorMessage("Successfully saved the entry");
            setIsErrorOpen(true);

        } catch (_) {
            setErrorMessage("There was an error saving the entry");
            setIsErrorOpen(true);
        }
    };

    return (
        <Show when={vaultKey()} fallback={<UnlockVault />}>
            <div class={styles.editorContainer}>
                <form onSubmit={handleSubmit} class={styles.editorForm}>
                    {/* Header: Título y Botón de Guardar */}
                    <div class={styles.header}>
                        <input
                            type="text"
                            class={styles.titleInput}
                            placeholder="Entry title"
                            value={title()}
                            onInput={(e) => setTitle(e.currentTarget.value)}
                            disabled={entry.loading || !!entry.error}
                        />
                        <button 
                            type="submit" 
                            class={styles.saveBtn} 
                            disabled={entry.loading || !!entry.error}
                        >
                            Guardar
                        </button>
                    </div>

                    {/* Contenedor de Pestañas (Tabs) */}
                    <div class={styles.tabContainer}>
                        <button 
                            type="button" 
                            class={activeTab() === "edit" ? styles.activeTab : styles.tabBtn}
                            onClick={() => setActiveTab("edit")}
                        >
                            Write
                        </button>
                        <button 
                            type="button" 
                            class={activeTab() === "preview" ? styles.activeTab : styles.tabBtn}
                            onClick={() => setActiveTab("preview")}
                        >
                            Preview
                        </button>
                    </div>

                    {/* Área Principal (Editor o Preview) */}
                    <div class={styles.editorBody}>
                        <Show when={activeTab() === "edit"}>
                            <textarea
                                placeholder="Speak your mind in Markdown..."
                                value={body()}
                                class={styles.bodyInput}
                                onInput={(e) => setBody(e.currentTarget.value)}
                                disabled={entry.loading || !!entry.error}
                            />
                        </Show>
                        
                        <Show when={activeTab() === "preview"}>
                            <div 
                                class={styles.previewPane} 
                                innerHTML={marked.parse(body() || "*Nothing to preview yet...*") as string}
                            />
                        </Show>
                    </div>
                </form>

                <Modal
                    isOpen={isErrorOpen()}
                    onClose={() => {
                        setIsErrorOpen(false);
                        if (shouldRedirect()) {
                            navigate("/");
                        }
                    }}
                    title="Info"
                >
                    <p>{errorMessage()}</p>
                </Modal>
            </div>
        </Show>
    );
}