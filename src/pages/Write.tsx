import { createSignal, Show } from "solid-js";
import { currentUser, pb } from "../lib/pocketbase";
import Modal from "../lib/Modal";
import { useNavigate } from "@solidjs/router";
import { encryptText, vaultKey } from "../lib/crypto";
import UnlockVault from "../lib/UnlockVault";
import styles from "./Editor.module.scss";


export default function Write() {
    const [title, setTitle] = createSignal("");
    const [body, setBody] = createSignal("");

    // 1. State for your custom modal
    const [isErrorOpen, setIsErrorOpen] = createSignal(false);
    const [errorMessage, setErrorMessage] = createSignal("");
    const [entrySaved, setEntrySaved] = createSignal(false);
    const navigate = useNavigate();

    const handleSubmit = async (e: Event) => {
        e.preventDefault();

        // 2. Instead of alert(), set the message and open the modal
        if (!title() || title().trim() === "" ||
            !body() || body().trim() === "") {
            setErrorMessage("The title and or body can't be empty");
            setIsErrorOpen(true);
            return; // Stop execution
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
            setErrorMessage("Sucessfully save the entry");
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
                    <h1>Create your entry</h1>
                    <input type="text" placeholder="Entry title"
                        onInput={(e) => setTitle(e.currentTarget.value)} class={styles.titleInput} />

                    <textarea name="" id="" placeholder="Speak your mind..." rows={10} onInput={(e) => setBody(e.currentTarget.value)}
                        class={styles.bodyInput}></textarea>

                    <div class={styles.footer}>
                        <input class={styles.saveBtn} type="submit" value="Agregar" />
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