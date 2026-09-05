package main

import (
	"database/sql"
	"net/http"
	"strings"
	"time"

	"github.com/cheney/happy-friday-enterprise/platform"
)

type loginInput struct {
	Email      string `json:"email"`
	Password   string `json:"password"`
	DeviceName string `json:"deviceName"`
}

func (a *App) login(w http.ResponseWriter, r *http.Request) {
	var input loginInput
	if err := decode(r, &input); err != nil {
		invalid(w, err)
		return
	}
	input.Email = strings.TrimSpace(strings.ToLower(input.Email))
	var userID, passwordHash, userStatus, organizationID, role, memberStatus string
	err := a.db.QueryRowContext(r.Context(), `SELECT u.id, u.password_hash, u.status, m.organization_id, m.role, m.status FROM users u JOIN organization_members m ON m.user_id = u.id WHERE u.email = ? LIMIT 1`, input.Email).Scan(&userID, &passwordHash, &userStatus, &organizationID, &role, &memberStatus)
	if err != nil || userStatus != "active" || memberStatus != "active" || !platform.CheckPassword(passwordHash, input.Password) {
		writeError(w, http.StatusUnauthorized, "INVALID_CREDENTIALS", "invalid email or password")
		return
	}
	principal := platform.Principal{OrganizationID: organizationID, UserID: userID, Role: role}
	access, err := platform.IssueAccessToken(a.cfg.JWTSecret, principal, a.cfg.AccessTTL)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "TOKEN_ERROR", "could not create token")
		return
	}
	refresh, tokenHash, err := platform.NewRefreshToken()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "TOKEN_ERROR", "could not create token")
		return
	}
	n := now()
	_, err = a.db.ExecContext(r.Context(), `INSERT INTO auth_refresh_tokens (id, user_id, organization_id, token_hash, device_name, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`, platform.NewID(), userID, organizationID, tokenHash, input.DeviceName, time.Now().UTC().Add(a.cfg.RefreshTTL).Format(time.RFC3339Nano), n)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "DATABASE_ERROR", "could not create session")
		return
	}
	_, _ = a.db.ExecContext(r.Context(), "UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?", n, n, userID)
	writeData(w, http.StatusOK, map[string]any{"accessToken": access, "refreshToken": refresh, "expiresIn": int(a.cfg.AccessTTL.Seconds())})
}

type refreshInput struct {
	RefreshToken string `json:"refreshToken"`
	DeviceName   string `json:"deviceName"`
}

func (a *App) refresh(w http.ResponseWriter, r *http.Request) {
	var input refreshInput
	if err := decode(r, &input); err != nil {
		invalid(w, err)
		return
	}
	if input.RefreshToken == "" {
		writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", "missing refresh token")
		return
	}
	tx, err := a.db.BeginTx(r.Context(), nil)
	if err != nil {
		writeError(w, 500, "DATABASE_ERROR", "could not refresh session")
		return
	}
	defer tx.Rollback()
	var tokenID, userID, organizationID, role, expiresAt, revokedAt, userStatus, memberStatus string
	err = tx.QueryRowContext(r.Context(), `SELECT t.id, t.user_id, t.organization_id, m.role, t.expires_at, COALESCE(t.revoked_at, ''), u.status, m.status FROM auth_refresh_tokens t JOIN users u ON u.id = t.user_id JOIN organization_members m ON m.user_id = t.user_id AND m.organization_id = t.organization_id WHERE t.token_hash = ?`, platform.HashRefreshToken(input.RefreshToken)).Scan(&tokenID, &userID, &organizationID, &role, &expiresAt, &revokedAt, &userStatus, &memberStatus)
	if err != nil || revokedAt != "" || userStatus != "active" || memberStatus != "active" {
		writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", "invalid refresh token")
		return
	}
	expires, err := time.Parse(time.RFC3339Nano, expiresAt)
	if err != nil || !expires.After(time.Now().UTC()) {
		writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", "expired refresh token")
		return
	}
	newRaw, newHash, err := platform.NewRefreshToken()
	if err != nil {
		writeError(w, 500, "TOKEN_ERROR", "could not create token")
		return
	}
	if _, err = tx.ExecContext(r.Context(), "UPDATE auth_refresh_tokens SET revoked_at = ? WHERE id = ?", now(), tokenID); err != nil {
		writeError(w, 500, "DATABASE_ERROR", "could not refresh session")
		return
	}
	if _, err = tx.ExecContext(r.Context(), `INSERT INTO auth_refresh_tokens (id, user_id, organization_id, token_hash, device_name, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`, platform.NewID(), userID, organizationID, newHash, input.DeviceName, time.Now().UTC().Add(a.cfg.RefreshTTL).Format(time.RFC3339Nano), now()); err != nil {
		writeError(w, 500, "DATABASE_ERROR", "could not refresh session")
		return
	}
	if err = tx.Commit(); err != nil {
		writeError(w, 500, "DATABASE_ERROR", "could not refresh session")
		return
	}
	access, err := platform.IssueAccessToken(a.cfg.JWTSecret, platform.Principal{OrganizationID: organizationID, UserID: userID, Role: role}, a.cfg.AccessTTL)
	if err != nil {
		writeError(w, 500, "TOKEN_ERROR", "could not create token")
		return
	}
	writeData(w, http.StatusOK, map[string]any{"accessToken": access, "refreshToken": newRaw, "expiresIn": int(a.cfg.AccessTTL.Seconds())})
}

func (a *App) logout(w http.ResponseWriter, r *http.Request) {
	var input refreshInput
	if err := decode(r, &input); err != nil {
		invalid(w, err)
		return
	}
	if input.RefreshToken != "" {
		_, _ = a.db.ExecContext(r.Context(), "UPDATE auth_refresh_tokens SET revoked_at = ? WHERE token_hash = ?", now(), platform.HashRefreshToken(input.RefreshToken))
	}
	writeData(w, http.StatusOK, map[string]bool{"loggedOut": true})
}
func (a *App) me(w http.ResponseWriter, r *http.Request) {
	p := principal(r)
	var email, displayName string
	err := a.db.QueryRowContext(r.Context(), `SELECT email, display_name FROM users WHERE id = ?`, p.UserID).Scan(&email, &displayName)
	if err != nil {
		invalid(w, err)
		return
	}
	writeData(w, http.StatusOK, map[string]string{"id": p.UserID, "organizationId": p.OrganizationID, "role": p.Role, "email": email, "displayName": displayName})
}

type passwordInput struct {
	CurrentPassword string `json:"currentPassword"`
	NewPassword     string `json:"newPassword"`
}

func (a *App) changePassword(w http.ResponseWriter, r *http.Request) {
	var input passwordInput
	if err := decode(r, &input); err != nil {
		invalid(w, err)
		return
	}
	p := principal(r)
	var old string
	if err := a.db.QueryRowContext(r.Context(), "SELECT password_hash FROM users WHERE id = ?", p.UserID).Scan(&old); err != nil || !platform.CheckPassword(old, input.CurrentPassword) {
		writeError(w, http.StatusUnauthorized, "INVALID_CREDENTIALS", "current password is incorrect")
		return
	}
	hash, err := platform.HashPassword(input.NewPassword)
	if err != nil {
		invalid(w, err)
		return
	}
	tx, err := a.db.BeginTx(r.Context(), nil)
	if err != nil {
		writeError(w, 500, "DATABASE_ERROR", "could not change password")
		return
	}
	defer tx.Rollback()
	_, err = tx.ExecContext(r.Context(), "UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?", hash, now(), p.UserID)
	if err == nil {
		_, err = tx.ExecContext(r.Context(), "UPDATE auth_refresh_tokens SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL", now(), p.UserID)
	}
	if err != nil || tx.Commit() != nil {
		writeError(w, 500, "DATABASE_ERROR", "could not change password")
		return
	}
	writeData(w, http.StatusOK, map[string]bool{"changed": true})
}

func scanNullString(value sql.NullString) any {
	if value.Valid {
		return value.String
	}
	return nil
}
