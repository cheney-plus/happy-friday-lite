package main

import (
	"log"
	"net/http"

	"github.com/cheney/happy-friday-enterprise/platform"
)

func main() {
	cfg, err := platform.LoadConfig()
	if err != nil {
		log.Fatal(err)
	}
	db, err := platform.OpenDatabase(cfg.DatabasePath)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()
	app := NewApp(db, cfg)
	log.Printf("enterprise server listening on %s", cfg.Address)
	if err := http.ListenAndServe(cfg.Address, app.Router()); err != nil {
		log.Fatal(err)
	}
}
