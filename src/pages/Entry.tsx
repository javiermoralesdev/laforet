import { useNavigate, useParams } from "@solidjs/router";
import { pb } from "../lib/pocketbase";
import { createEffect, createResource, createSignal, Match, Show, Switch } from "solid-js";
import { decryptText, vaultKey } from "../lib/crypto";
import UnlockVault from "../lib/UnlockVault";
import Modal from "../lib/Modal";
import { useLocale } from "../i18n";
import { marked } from "marked";
import styles from "./Reader.module.scss";

export interface EntryDetails {
    id: string;
    title: string;
    body: string;
    created: string;
    author: string;
}

async function fetchEntry(id: string): Promise<EntryDetails> {
    return pb.collection("entries").getOne(id);
}

export default function Entry() {
    const { t } = useLocale();
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
        if (!key) return;
        const data = entry();
        if (data) {
            try {
                setTitle(await decryptText(data.title, key));
                setBody(await decryptText(data.body, key));
            } catch (err) {
                setErrorMessage(t("reader_decryption_error"));
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
                        <p>{t("reader_loading")}</p>
                    </Match>
                    <Match when={entry.error}>
                        <p>{t("reader_error")} {entry.error.message}</p>
                    </Match>
                    <Match when={entry()}>
                        {(loadedEntry) => (
                            <article class={styles.readerContainer}>
                                <header class={styles.header}>
                                    <h2>{title()}</h2>
                                    <small>{new Date(loadedEntry().created).toLocaleString()}</small>
                                </header>
                                <div class={styles.body} innerHTML={marked.parse(body()) as string}></div>
                            </article>
                        )}
                    </Match>
                </Switch>
                <Modal isOpen={isErrorOpen()} title={t("info")} onClose={() => { setIsErrorOpen(false); if (shouldRedirect()) navigate("/"); }}>
                    <p>{errorMessage()}</p>
                </Modal>
            </div>
        </Show>
    );
}