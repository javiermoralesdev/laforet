import { createSignal } from "solid-js";
import { pb } from "./pocketbase";
import Modal from "./Modal";

function LoginForm() {
    const [email, setEmail] = createSignal("");
    const [password, setPassword] = createSignal("");

    const [isErrorOpen, setIsErrorOpen] = createSignal(false);
    const [errorMessage, setErrorMessage] = createSignal("");

    const login = async (email: string, password: string) => {
        try {
            await pb.collection("users").authWithPassword(email, password);
        } catch (e) {
            setErrorMessage("Error signing in. Incorrect email/password");
            setIsErrorOpen(true);
        }
    }

    return (
        <div>
            <form on:submit={(e) => {
                e.preventDefault(); // Stops the browser from refreshing the page
                login(email(), password());
            }}>
                <input type="email" placeholder="Email" value={email()} onInput={(e) => setEmail(e.currentTarget.value)} />
                <input type="password" placeholder="Password" value={password()} onInput={(e) => setPassword(e.currentTarget.value)} />
                <button>Login</button>
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