import { useNavigate, useParams } from "@solidjs/router";
import { createEffect, createResource, createSignal, Show } from "solid-js";
import { currentUser, pb } from "../lib/pocketbase";
import Modal from "../lib/Modal";
import type { EntryDetails } from "./Entry";
import { decryptText, encryptText, vaultKey } from "../lib/crypto";
import UnlockVault from "../lib/UnlockVault";

async function fetchEntry(id: string): Promise<EntryDetails> {
    return pb.collection("entries").getOne(id);
}

export default function EditEntry() {
    const params = useParams();
    const [body, setBody] = createSignal("");
    const [title, setTitle] = createSignal("");

    const [isErrorOpen, setIsErrorOpen] = createSignal(false);
    const [errorMessage, setErrorMessage] = createSignal("");
    const [shouldRedirect, setShouldRedirect] = createSignal(false);
    const navigate = useNavigate();

    const [entry] = createResource(() => params.id, fetchEntry);


    // Watch for successful loads, missing params, and fetch errors
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
                // Decrypt the data before setting it to the state
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

            // 1. Get the key
            const key = vaultKey();
            if (!key) return;

            // 2. Encrypt the signals
            const encryptedTitle = await encryptText(title(), key);
            const encryptedBody = await encryptText(body(), key);

            // 3. Save the encrypted data
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
            <div>
                <form onSubmit={handleSubmit}>
                    <h1>Edit your entry</h1>
                    <input
                        type="text"
                        placeholder="Title"
                        value={title()}
                        onInput={(e) => setTitle(e.currentTarget.value)}
                        disabled={entry.loading || !!entry.error}
                    />
                    <textarea
                        name=""
                        id=""
                        placeholder="Speak your mind..."
                        rows={25}
                        value={body()}
                        onInput={(e) => setBody(e.currentTarget.value)}
                        disabled={entry.loading || !!entry.error}
                    ></textarea>
                    <input
                        type="submit"
                        value="Guardar"
                        disabled={entry.loading || !!entry.error}
                    />
                </form>
                <Modal
                    isOpen={isErrorOpen()}
                    onClose={() => {
                        setIsErrorOpen(false);
                        // This now handles both save success and load failure
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