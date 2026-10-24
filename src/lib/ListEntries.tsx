import { createResource, createSignal, For, Show } from "solid-js";
import { pb } from "./pocketbase";
import { useNavigate } from "@solidjs/router";
import Modal from "./Modal";

interface EntrySummary {
    id: string;
    title: string;
    created: string;
}

async function fetchEntries() {
    return await pb.collection("entries").getFullList<EntrySummary>({
        sort: "-created",
        fields: "id,title,created" // Comma-separated list of exactly what I need
    });
}

function logOut() {
    pb.authStore.clear();
}

function ListEntry() {
    const [entries, { refetch }] = createResource(fetchEntries);
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
        <div>
            <h2>My Diary Entries</h2>
            <button onClick={refetch}>Refresh</button>
            <button onClick={logOut}>Log Out</button>
            <button onClick={(_) => navigate("/write")}>Write Entry</button>

            {/* Handle Loading State */}
            <Show when={entries.loading}>
                <p>Loading your thoughts...</p>
            </Show>

            {/* Handle Error State */}
            <Show when={entries.error}>
                <p>Error: {entries.error.message}</p>
            </Show>

            {/* 4. Render the list using <For> */}
            <ul>
                <For
                    each={entries()}
                    fallback={<p>No entries yet. Start writing!</p>}
                >
                    {(entry) => (
                        <li>
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
    );
}

export default ListEntry;