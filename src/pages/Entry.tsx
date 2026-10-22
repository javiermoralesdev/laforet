import { useParams } from "@solidjs/router";
import { pb } from "../lib/pocketbase";
import { createResource, Show } from "solid-js";

// 1. Define the full interface including the 'body'
interface Entry {
    id: string;
    title: string;
    body: string;
    created: string;
    author: string;
}

async function fetchEntry(id: string): Promise<Entry> {
    return pb.collection("entries").getOne(id);
}

function Entry() {
    const params = useParams();
    const [entry] = createResource(() => params.id, fetchEntry);
    return (
        <div>
            <Show when={entry.loading}>
                <p>Loading entry...</p>
            </Show>

            <Show when={entry.error}>
                <p>Error loading entry: {entry.error.message}</p>
            </Show>

            {/* Use the callback pattern again to ensure 'entry' is fully loaded */}
            <Show when={entry()}>
                {(loadedEntry) => (
                    <article>
                        <h2>{loadedEntry().title}</h2>
                        <small>{new Date(loadedEntry().created).toLocaleString()}</small>

                        {/* The full body is now available */}
                        <p>{loadedEntry().body}</p>
                    </article>
                )}
            </Show>
        </div>
    )
}

export default Entry;