import { Show } from "solid-js";
import { currentUser, pb } from "../lib/pocketbase";
import LoginForm from "../lib/LoginForm";
function logout() {
    alert("Sesión cerrada")
    pb.authStore.clear();
}

function Home() {
    return (
        <Show when={currentUser()} fallback={<LoginForm />}>
            <h1>Signed in as {currentUser()?.email}</h1>
            <button on:click={(_) => logout()}>Log out</button>

        </Show>
    )
}

export default Home;