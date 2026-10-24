import { createSignal, Show } from "solid-js";
import { currentUser, pb } from "./pocketbase";
import Modal from "./Modal";
import { useNavigate } from "@solidjs/router";
import { deriveKey, setVaultKey, vaultKey } from "./crypto";

function LoginForm() {
    const signupsDisabled = import.meta.env.VITE_DISABLE_SIGNUPS === "true";
    const [email, setEmail] = createSignal("");
    const [password, setPassword] = createSignal("");

    const [isErrorOpen, setIsErrorOpen] = createSignal(false);
    const [errorMessage, setErrorMessage] = createSignal("");

    const navigate = useNavigate();

    const login = async (email: string, password: string) => {
        try {
            await pb.collection("users").authWithPassword(email, password);
            console.log(vaultKey());
            const key = await deriveKey(password, currentUser()?.id || "");
            setVaultKey(key);
            console.log(vaultKey());
        } catch (e) {
            setErrorMessage("Error signing in. Incorrect email/password");
            setIsErrorOpen(true);
        }
    }

    return (
        <div>
            <form on:submit={(e) => {
                e.preventDefault(); // Stops the browser from refreshing the page
            }}>
                <input type="email" placeholder="Email" value={email()} onInput={(e) => setEmail(e.currentTarget.value)} />
                <input type="password" placeholder="Password" value={password()} onInput={(e) => setPassword(e.currentTarget.value)} />
                <button onclick={() => login(email(), password())}>Login</button>
                <Show when={!signupsDisabled}>
                    <button onclick={() => navigate("/signup")}>Don't have an account? Sign Up</button>
                </Show>
            </form>
            <Modal
                title="Info"
                isOpen={isErrorOpen()}
                onClose={() => setIsErrorOpen(false)}
            >
                <p>{errorMessage()}</p>
            </Modal>
        </div>
    );
}

export default LoginForm;