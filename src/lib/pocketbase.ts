import PocketBase from "pocketbase";
import { createSignal } from "solid-js";
import { setVaultKey } from "./crypto";

export const pb = new PocketBase(import.meta.env.VITE_PB_HOST);

export const [currentUser, setCurrentUser] = createSignal(pb.authStore.record);

pb.authStore.onChange((_) => {
    setCurrentUser(pb.authStore.record);
    if (!pb.authStore.isValid) {
        setVaultKey(null);
    }
});

export function logOut() {
    pb.authStore.clear();
    setVaultKey(null);
}
