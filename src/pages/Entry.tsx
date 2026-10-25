import { useNavigate, useParams } from "@solidjs/router";
import { pb } from "../lib/pocketbase";
import { createEffect, createResource, createSignal, Match, Show, Switch } from "solid-js";
import { decryptText, vaultKey } from "../lib/crypto";
import UnlockVault from "../lib/UnlockVault";
import Modal from "../lib/Modal";
import styles from "./Reader.module.scss";

interface EntryDetails {
    id: string;
    title: string;
    body: string;
    created: string;
    author: string;
}

async function fetchEntry(id: string): Promise<EntryDetails> {
    return pb.collection("entries").getOne(id);
}

function Entry() {
    const params = useParams();
    const [entry] = createResource(() => params.id, fetchEntry);
    const [body, setBody] = createSignal("");
    const [title, setTitle] = createSignal("");
    const [shouldRedirect, setShouldRedirect] = createSignal(false);
    const navigate = useNavigate();


    const [isErrorOpen, setIsErrorOpen] = createSignal(false);
    const [errorMessage, setErrorMessage] = createSignal("");

    createEffect(async () => {
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

    return (
        <Show when={vaultKey()} fallback={<UnlockVault />}>
            <div>
                <Switch>
                    <Match when={entry.loading}>
                        <p>Loading entry...</p>
                    </Match>
                    <Match when={entry.error}>
                        {/*
                If it's a 404, the createEffect will instantly redirect the user.
                If it's a network error or 500, they will see this message.
              */}
                        <p>Could not load entry: {entry.error.message}</p>
                    </Match>
                    {/* This ONLY evaluates if loading is false AND error is false, preventing the crash */}
                    <Match when={entry()}>
                        {(loadedEntry) => (
                            <article class={styles.readerContainer}>
                                <header class={styles.header}>
                                    <h2>{title()}</h2>
                                    <small>{new Date(loadedEntry().created).toLocaleString()}</small>
                                </header>
                                <div class={styles.body}>
                                    {body()}
                                </div>
                            </article>
                        )}
                    </Match>
                </Switch>
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
    )
}

export default Entry;

export type { EntryDetails }