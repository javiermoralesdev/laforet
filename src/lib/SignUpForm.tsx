import { useNavigate } from "@solidjs/router";
import { createSignal } from "solid-js";
import { currentUser, pb } from "../lib/pocketbase";
import Modal from "../lib/Modal";
import { deriveKey, encryptText, setVaultKey } from "./crypto";
import styles from "./Auth.module.scss";

export default function SignUpForm() {
    const navigate = useNavigate();

    // In Vite, environment variables are always strings. 
    // We check if it explicitly equals "true".
    const signupsDisabled = import.meta.env.VITE_DISABLE_SIGNUPS === "true";

    const [name, setName] = createSignal("");
    const [email, setEmail] = createSignal("");
    const [password, setPassword] = createSignal("");
    const [passwordConfirm, setPasswordConfirm] = createSignal("");

    // Modal states (using the exact same structure as EditEntry)
    const [isModalOpen, setIsModalOpen] = createSignal(false);
    const [modalMessage, setModalMessage] = createSignal("");
    const [shouldRedirect, setShouldRedirect] = createSignal(false);

    const handleSubmit = async (e: Event) => {
        e.preventDefault();

        // 1. Basic empty field validation
        if (!email() || email().trim() === "" ||
            !password() || password().trim() === "" ||
            !passwordConfirm() || passwordConfirm().trim() === "") {
            setModalMessage("All fields are required.");
            setIsModalOpen(true);
            return;
        }

        // 2. Password match validation
        if (password() !== passwordConfirm()) {
            setModalMessage("Passwords do not match.");
            setIsModalOpen(true);
            return;
        }

        try {
            // 3. Create the user in PocketBase
            await pb.collection("users").create({
                email: email(),
                password: password(),
                passwordConfirm: passwordConfirm(),
                name: name()
            });
            await pb.collection("users").authWithPassword(email(), password());

            const key = await deriveKey(password(), currentUser()?.id || "");
            const encryptedCanary = await encryptText("success", key);
            await pb.collection("users").update(currentUser()?.id || "", {
                vaultCheck: encryptedCanary
            })
            setVaultKey(key);
            setShouldRedirect(true);
            setModalMessage("Account created successfully! You can now log in.");
            setIsModalOpen(true);

        } catch (_) {
            // Usually fails if the email is already registered or password is too short
            setModalMessage("There was an error creating your account. This email might already be registered.");
            setIsModalOpen(true);
        }
    };

    // If sign-ups are disabled, return early and only render the message
    if (signupsDisabled) {
        return (
            <div>
                <h1>Registration Closed</h1>
                <p>We are not accepting new sign-ups at this time. Please check back later!</p>
            </div>
        );
    }

    // Otherwise, render the form normally
    return (
        <div class={styles.authContainer}>
            <div class={styles.authCard}>
                <form onSubmit={handleSubmit}>
                    <h1>Sign Up</h1>
                    <input
                        type="text"
                        placeholder="Name"
                        value={name()}
                        onInput={(e) => setName(e.currentTarget.value)}
                    />
                    <input
                        type="email"
                        placeholder="Email"
                        value={email()}
                        onInput={(e) => setEmail(e.currentTarget.value)}
                    />
                    <input
                        type="password"
                        placeholder="Password"
                        value={password()}
                        onInput={(e) => setPassword(e.currentTarget.value)}
                    />
                    <input
                        type="password"
                        placeholder="Repeat Password"
                        value={passwordConfirm()}
                        onInput={(e) => setPasswordConfirm(e.currentTarget.value)}
                    />
                    <input class={styles.primaryBtn} type="submit" value="Registrarse" />
                </form>
                <Modal
                    isOpen={isModalOpen()}
                    onClose={() => {
                        setIsModalOpen(false);
                        if (shouldRedirect()) {
                            navigate("/"); // Send them to the login page after success
                        }
                    }}
                    title="Info"
                >
                    <p>{modalMessage()}</p>
                </Modal>
            </div>
        </div>
    );
}