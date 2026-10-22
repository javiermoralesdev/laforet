import PocketBase from "pocketbase"
import { createSignal } from "solid-js";

export const pb = new PocketBase(import.meta.env.VITE_PB_HOST);

export const [currentUser, setCurrentUser] = createSignal(pb.authStore.record);

pb.authStore.onChange((_) => {
    setCurrentUser(pb.authStore.record);
});