import { createResource, For, Show } from "solid-js";
import { pb } from "./pocketbase";
import { useNavigate } from "@solidjs/router";

interface EntrySummary {
    id: string;
    title: string;
    created: string;
}

async function fetchEntries() {
    return await pb.collection("entries").getFullList<EntrySummary>({
        sort: "-created",
        fields: "id,title,created" // Comma-separated list of exactly what you need
    });
}

function logOut() {
    pb.authStore.clear();
}

function ListEntry() {
    const [entries, { refetch }] = createResource(fetchEntries);
    const navigate = useNavigate();
    return (
        <div>
            <h2>My Diary Entries</h2>
            <button onClick={refetch}>Refresh</button>
            <button onClick={logOut}>Log Out</button>
            <button onClick={ (_) => navigate("/write")}>Write Entry</button>

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
                    fallback={<li>No entries yet. Start writing!</li>}
                >
                    {(entry) => (
                        <li>
                            <h3><a href={"/entry/" + entry.id}>{entry.title}</a></h3>
                            <small>{new Date(entry.created).toLocaleString()}</small>
                        </li>
                    )}
                </For>
            </ul>
        </div>
    );
}

export default ListEntry;