import { Show } from "solid-js";
import { currentUser } from "../lib/pocketbase";
import LoginForm from "../lib/LoginForm";
import ListEntry from "../lib/ListEntries";

function Home() {
    return (
        <Show when={currentUser()} fallback={<LoginForm />}>
            <ListEntry />

        </Show>
    )
}

export default Home;