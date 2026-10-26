/// <reference path="../pb_data/types.d.ts" />

// Serves the runtime config the frontend reads from window.__ENV__.
// It is generated per request from the container's environment and sent with
// "no-store", so neither the browser nor a proxy/CDN can serve a stale copy.
routerAdd("GET", "/env-config.js", (e) => {
    const disabled = $os.getenv("VITE_DISABLE_SIGNUPS") === "true"

    e.response.header().set("Content-Type", "application/javascript; charset=utf-8")
    e.response.header().set("Cache-Control", "no-store")

    return e.string(
        200,
        'window.__ENV__ = { VITE_DISABLE_SIGNUPS: "' + (disabled ? "true" : "false") + '" };\n'
    )
})