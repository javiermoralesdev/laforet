import { createSignal, Show } from "solid-js";
import { currentUser, pb } from "../lib/pocketbase";
import Modal from "../lib/Modal";
import { useNavigate } from "@solidjs/router";
import { encryptText, vaultKey } from "../lib/crypto";
import UnlockVault from "../lib/UnlockVault";
import styles from "./Editor.module.scss";
// 1. Importar marked para renderizar el Markdown
import { marked } from "marked";

export default function Write() {
    const [title, setTitle] = createSignal("");
    const [body, setBody] = createSignal("");

    const [isErrorOpen, setIsErrorOpen] = createSignal(false);
    const [errorMessage, setErrorMessage] = createSignal("");
    const [entrySaved, setEntrySaved] = createSignal(false);
    const navigate = useNavigate();

    // Estado para controlar la pestaña activa ("edit" o "preview")
    const [activeTab, setActiveTab] = createSignal<"edit" | "preview">("edit");

    const handleSubmit = async (e: Event) => {
        e.preventDefault();

        if (!title() || title().trim() === "" ||
            !body() || body().trim() === "") {
            setErrorMessage("The title and or body can't be empty");
            setIsErrorOpen(true);
            return;
        }
        try {
            const key = vaultKey();
            const encryptedTitle = await encryptText(title(), key!);
            const encryptedBody = await encryptText(body(), key!);
            
            await pb.collection("entries").create({
                title: encryptedTitle,
                body: encryptedBody,
                author: currentUser()?.id
            });
            
            setEntrySaved(true);
            setErrorMessage("Successfully saved the entry");
            setIsErrorOpen(true);

        } catch (_) {
            setErrorMessage("There was an error saving or encrypting the entry");
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
                        />
                        <button type="submit" class={styles.saveBtn}>
                            Save
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
                        if (entrySaved()) {
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