package main

import (
	"database/sql"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/cheney/happy-friday-enterprise/platform"
	"github.com/go-chi/chi/v5"
)

type App struct {
	db  *sql.DB
	cfg platform.Config
}

func NewApp(db *sql.DB, cfg platform.Config) *App { return &App{db: db, cfg: cfg} }

func (a *App) Router() http.Handler {
	r := chi.NewRouter()
	r.Use(cors)
	r.Get("/", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/admin/", http.StatusFound)
	})
	r.Get("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		writeData(w, http.StatusOK, map[string]string{"status": "ok"})
	})
	r.Get("/readyz", a.ready)
	r.Get("/openapi.json", openAPI)
	r.Route("/api/v1", func(r chi.Router) {
		r.Post("/auth/login", a.login)
		r.Post("/auth/refresh", a.refresh)
		r.Post("/auth/logout", a.logout)
		r.Group(func(r chi.Router) {
			r.Use(a.authenticate)
			r.Get("/me", a.me)
			r.Post("/auth/change-password", a.changePassword)
			r.Get("/model-configs/active", a.activeModels)
			r.Get("/preferences", a.getPreferences)
			r.Patch("/preferences", a.savePreferences)
			r.Mount("/conversations", a.conversationRoutes())
			r.Mount("/notebooks", a.notebookRoutes())
			r.Mount("/notes", a.noteRoutes())
			r.Mount("/schedule-events", a.scheduleRoutes())
			r.Mount("/automation", a.automationRoutes())
			r.Mount("/usage-records", a.usageRoutes())
			r.Route("/admin", func(r chi.Router) { r.Use(requireAdmin); a.adminAPI(r) })
		})
	})
	r.Get("/admin", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/admin/", http.StatusFound)
	})
	r.Mount("/admin", a.adminWebRoutes())
	return r
}

func cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (a *App) ready(w http.ResponseWriter, r *http.Request) {
	if err := a.db.PingContext(r.Context()); err != nil {
		writeError(w, http.StatusServiceUnavailable, "NOT_READY", "database unavailable")
		return
	}
	writeData(w, http.StatusOK, map[string]string{"status": "ready"})
}

func (a *App) authenticate(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		raw := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
		if raw == r.Header.Get("Authorization") || raw == "" {
			writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", "missing bearer token")
			return
		}
		principal, err := platform.ParseAccessToken(a.cfg.JWTSecret, raw)
		if err != nil || platform.ValidateMembership(r.Context(), a.db, principal) != nil {
			writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", "invalid or inactive session")
			return
		}
		next.ServeHTTP(w, r.WithContext(platform.WithPrincipal(r.Context(), principal)))
	})
}

func requireAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		principal, ok := platform.PrincipalFromContext(r.Context())
		if !ok || !platform.IsAdmin(principal) {
			writeError(w, http.StatusForbidden, "FORBIDDEN", "administrator access required")
			return
		}
		next.ServeHTTP(w, r)
	})
}
func principal(r *http.Request) platform.Principal {
	value, _ := platform.PrincipalFromContext(r.Context())
	return value
}
func now() string { return time.Now().UTC().Format(time.RFC3339Nano) }

func decode(r *http.Request, target any) error {
	defer r.Body.Close()
	decoder := json.NewDecoder(io.LimitReader(r.Body, 1<<20))
	decoder.DisallowUnknownFields()
	return decoder.Decode(target)
}
func writeData(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]any{"data": data, "requestId": platform.NewID()})
}
func writeError(w http.ResponseWriter, status int, code, message string) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]any{"error": map[string]string{"code": code, "message": message}, "requestId": platform.NewID()})
}
func nullable(value string) any {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	return value
}
func invalid(w http.ResponseWriter, err error) {
	if errors.Is(err, sql.ErrNoRows) {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "resource not found")
		return
	}
	writeError(w, http.StatusBadRequest, "INVALID_REQUEST", err.Error())
}
