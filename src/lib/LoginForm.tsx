import { createSignal } from "solid-js";
import { pb } from "./pocketbase";

async function login(email: string, password: string) {
    //alert("I logged in with " + email + " and " + password);
    try {
        await pb.collection("users").authWithPassword(email, password);
    } catch (_) {
        alert("Error: incorrect username or password");
    }
}

function LoginForm() {
    const [email, setEmail] = createSignal("");
    const [password, setPassword] = createSignal("");

    return (
        <form on:submit={(e) => {
            e.preventDefault(); // Stops the browser from refreshing the page
            login(email(), password());
        }}>
            <input type="email" placeholder="Email" value={email()} onInput={(e) => setEmail(e.currentTarget.value)} />
            <input type="password" placeholder="Password" value={password()} onInput={(e) => setPassword(e.currentTarget.value)} />
            <button>Login</button>
        </form>
    );
}

export default LoginForm;