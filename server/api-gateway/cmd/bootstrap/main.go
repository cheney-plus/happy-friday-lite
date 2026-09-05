package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/cheney/happy-friday-enterprise/platform"
)

func main() {
	organization := flag.String("organization", "", "organization name")
	email := flag.String("email", "", "owner email")
	displayName := flag.String("name", "", "owner display name")
	password := flag.String("password", "", "owner password")
	flag.Parse()
	if strings.TrimSpace(*organization) == "" || strings.TrimSpace(*email) == "" || strings.TrimSpace(*displayName) == "" || strings.TrimSpace(*password) == "" {
		log.Fatal("organization, email, name and password are required")
	}
	cfg, err := platform.LoadConfig()
	if err != nil {
		log.Fatal(err)
	}
	db, err := platform.OpenDatabase(cfg.DatabasePath)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()
	hash, err := platform.HashPassword(*password)
	if err != nil {
		log.Fatal(err)
	}
	orgID, userID, timestamp := platform.NewID(), platform.NewID(), now()
	tx, err := db.BeginTx(context.Background(), nil)
	if err != nil {
		log.Fatal(err)
	}
	defer tx.Rollback()
	if _, err = tx.Exec(`INSERT INTO organizations(id, name, created_at) VALUES (?, ?, ?)`, orgID, strings.TrimSpace(*organization), timestamp); err != nil {
		log.Fatal(err)
	}
	if _, err = tx.Exec(`INSERT INTO users(id, email, display_name, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`, userID, strings.ToLower(strings.TrimSpace(*email)), strings.TrimSpace(*displayName), hash, timestamp, timestamp); err != nil {
		log.Fatal(err)
	}
	if _, err = tx.Exec(`INSERT INTO organization_members(organization_id, user_id, role, created_at, updated_at) VALUES (?, ?, 'org_owner', ?, ?)`, orgID, userID, timestamp, timestamp); err != nil {
		log.Fatal(err)
	}
	if err = tx.Commit(); err != nil {
		log.Fatal(err)
	}
	fmt.Printf("Created organization %s and owner %s\n", orgID, userID)
}

func now() string { return time.Now().UTC().Format(time.RFC3339Nano) }
