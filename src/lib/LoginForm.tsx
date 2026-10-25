import { createSignal, Show } from "solid-js";
import { currentUser, pb } from "./pocketbase";
import Modal from "./Modal";
import { useNavigate } from "@solidjs/router";
import { deriveKey, setVaultKey } from "./crypto";
// 1. Import the styles
import styles from "./Auth.module.scss";

function LoginForm() {
    const signupsDisabled = import.meta.env.VITE_DISABLE_SIGNUPS === "true"; //
    const [email, setEmail] = createSignal(""); //
    const [password, setPassword] = createSignal(""); //[cite: 15]

    const [isErrorOpen, setIsErrorOpen] = createSignal(false); //[cite: 15]
    const [errorMessage, setErrorMessage] = createSignal(""); //[cite: 15]

    const navigate = useNavigate(); //[cite: 15]

    // 2. Refactor to accept an Event so it can handle the form submission
    const login = async (e: Event) => {
        e.preventDefault();
        try {
            await pb.collection("users").authWithPassword(email(), password()); //[cite: 15]
            const key = await deriveKey(password(), currentUser()?.id || ""); //[cite: 15]
            setVaultKey(key); //[cite: 15]
        } catch (error) {
            setErrorMessage("Error signing in. Incorrect email/password"); //[cite: 15]
            setIsErrorOpen(true); //[cite: 15]
        }
    }

    return (
        <div class={styles.authContainer}>
            <div class={styles.authCard}>
                <h2>Welcome Back</h2>

                {/* 3. Attach the handler to the form, not the button */}
                <form onSubmit={login}>
                    <input
                        type="email"
                        placeholder="Email"
                        value={email()} //[cite: 15]
                        onInput={(e) => setEmail(e.currentTarget.value)} //[cite: 15]
                    />
                    <input
                        type="password"
                        placeholder="Password"
                        value={password()} //[cite: 15]
                        onInput={(e) => setPassword(e.currentTarget.value)} //[cite: 15]
                    />

                    {/* 4. Use type="submit" so the "Enter" key works */}
                    <button type="submit" class={styles.primaryBtn}>
                        Login
                    </button>

                    <Show when={!signupsDisabled}>
                        {/* 5. type="button" prevents this from accidentally triggering the login logic */}
                        <button
                            type="button"
                            class={styles.textBtn}
                            onClick={() => navigate("/signup")}
                        >
                            Don't have an account? Sign Up
                        </button>
                    </Show>
                </form>
            </div>

            <Modal
                title="Info" //[cite: 15]
                isOpen={isErrorOpen()} //[cite: 15]
                onClose={() => setIsErrorOpen(false)} //[cite: 15]
            >
                <p>{errorMessage()}</p>
            </Modal>
        </div>
    );
}

export default LoginForm; //[cite: 15]