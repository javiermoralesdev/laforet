/// <reference path="../pb_data/types.d.ts" />

// Block self-registration on the server when VITE_DISABLE_SIGNUPS=true.
// Superusers can still create users from the admin UI.
onRecordCreateRequest((e) => {
    if ($os.getenv("VITE_DISABLE_SIGNUPS") === "true" && !e.hasSuperuserAuth()) {
        throw new ForbiddenError("Signups are disabled.")
    }
    e.next()
}, "users")