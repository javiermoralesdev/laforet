import { createResource, createSignal, For, Show } from "solid-js";
import { pb } from "./pocketbase";
import { useNavigate } from "@solidjs/router";
import Modal from "./Modal";
// Asegúrate de importar decryptText desde tu archivo crypto
import { vaultKey, decryptText } from "./crypto";
import UnlockVault from "./UnlockVault";

interface EntrySummary {
    id: string;
    title: string;
    created: string;
}

// 1. Modificar fetchEntries para recibir la clave criptográfica
async function fetchEntries(key: CryptoKey | null) {
    if (!key) return []; // Si no hay clave, no intenta cargar ni desencriptar

    const rawEntries = await pb.collection("entries").getFullList<EntrySummary>({
        sort: "-created",
        fields: "id,title,created" // Comma-separated list of exactly what I need
    });

    // 2. Desencriptar los títulos de todas las entradas concurrentemente
    const decryptedEntries = await Promise.all(
        rawEntries.map(async (entry) => {
            try {
                const plainTitle = await decryptText(entry.title, key);
                return { ...entry, title: plainTitle };
            } catch (err) {
                // Si falla (ej. entradas antiguas en texto plano), muestra un error seguro
                return { ...entry, title: "🔒 [Error al desencriptar]" };
            }
        })
    );

    return decryptedEntries;
}

function logOut() {
    pb.authStore.clear();
}

function ListEntry() {
    // 3. Pasar vaultKey como origen reactivo al recurso
    const [entries, { refetch }] = createResource(vaultKey, fetchEntries);
    const navigate = useNavigate();

    const [modalMessage, setModalMessage] = createSignal("");
    const [isErrorOpen, setErrorOpen] = createSignal(false);

    async function removeEntry(entryID: string) {
        await pb.collection("entries").delete(entryID);
        refetch();
        setModalMessage("Entry successfully deleted");
        setErrorOpen(true);
    }

    return (
        <Show when={vaultKey()} fallback={<UnlockVault />}>
            <div>
                <h2>My Diary Entries</h2>
                <button onClick={refetch}>Refresh</button>
                <button onClick={logOut}>Log Out</button>
                <button onClick={(_) => navigate("/write")}>Write Entry</button>
                {/* Handle Loading State  */}
                <Show when={entries.loading}>
                    <p>Loading your thoughts...</p>
                </Show>
                {/* Handle Error State  */}
                <Show when={entries.error}>
                    <p>Error: {entries.error.message}</p>
                </Show>
                {/* 4. Render the list using <For>  */}
                <ul>
                    <For
                        each={entries()}
                        fallback={<p>No entries yet. Start writing!</p>}
                    >
                        {(entry) => (
                            <li>
                                {/* El título ya está desencriptado gracias al fetcher */}
                                <h3><a href={"/entry/" + entry.id}>{entry.title}</a></h3>
                                <small>{new Date(entry.created).toLocaleString()}</small>
                                <button onClick={() => navigate("/edit/" + entry.id)}>Edit</button>
                                <button onClick={() => removeEntry(entry.id)}>Remove</button>
                            </li>
                        )}
                    </For>
                </ul>
                <Modal
                    isOpen={isErrorOpen()}
                    title="Info"
                    onClose={() => setErrorOpen(false)}
                >
                    <p>{modalMessage()}</p>
                </Modal>
            </div>
        </Show>
    );
}

export default ListEntry;