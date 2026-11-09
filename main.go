package main

import (
	"log"
	"os"
	"path/filepath"
	"strings"

	"ganigeorgiev.com/pocketbase/pocketbase"
	"ganigeorgiev.com/pocketbase/pocketbase/apis"
	"ganigeorgiev.com/pocketbase/pocketbase/core"
	"ganigeorgiev.com/pocketbase/pocketbase/plugins/jsvm"
	"ganigeorgiev.com/pocketbase/pocketbase/plugins/migratecmd"
)

func main() {
	app := pocketbase.New()

	var publicDir string
	app.RootCmd.PersistentFlags().StringVar(
		&publicDir, "publicDir", defaultPublicDir(), "the directory to serve static files",
	)

	var indexFallback bool
	app.RootCmd.PersistentFlags().BoolVar(
		&indexFallback, "indexFallback", true,
		"fallback to index.html on missing static path (needed for SPA routing)",
	)

	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		se.Router.GET("/{path...}", apis.Static(os.DirFS(publicDir), indexFallback))
		return se.Next()
	})

	var hooksDir string
	app.RootCmd.PersistentFlags().StringVar(
		&hooksDir, "hooksDir", "", "the directory with the JS app hooks",
	)

	var migrationsDir string
	app.RootCmd.PersistentFlags().StringVar(
		&migrationsDir, "migrationsDir", "", "the directory with the user defined migrations",
	)

	// parse early so the values are available before registering the plugins
	app.RootCmd.ParseFlags(os.Args[1:])

	jsvm.MustRegister(app, jsvm.Config{
		MigrationsDir: migrationsDir,
		HooksDir:      hooksDir,
	})

	migratecmd.MustRegister(app, app.RootCmd, migratecmd.Config{
		TemplateLang: migratecmd.TemplateLangJS,
		Automigrate:  true,
		Dir:          migrationsDir,
	})

	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}

func defaultPublicDir() string {
	if strings.HasPrefix(os.Args[0], os.TempDir()) {
		return "./pb_public"
	}
	return filepath.Join(os.Args[0], "../pb_public")
}