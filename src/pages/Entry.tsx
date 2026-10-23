import { useParams } from "@solidjs/router";
import { pb } from "../lib/pocketbase";
import { createResource, Match, Switch } from "solid-js";

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
                        <article>
                            <h2>{loadedEntry().title}</h2>
                            <small>{new Date(loadedEntry().created).toLocaleString()}</small>
                            <p>{loadedEntry().body}</p>
                        </article>
                    )}
                </Match>

            </Switch>
        </div>
    )
}

export default Entry;