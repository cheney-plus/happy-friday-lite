package main

import (
	"net/http"
	"strings"

	"github.com/cheney/happy-friday-enterprise/platform"
	"github.com/go-chi/chi/v5"
)

func (a *App) adminAPI(r chi.Router) {
	r.Get("/members", a.listMembers)
	r.Post("/members", a.createMember)
	r.Patch("/members/{id}", a.updateMember)
	r.Post("/members/{id}/reset-password", a.resetMemberPassword)
	r.Get("/model-configs", a.listModelConfigs)
	r.Post("/model-configs", a.createModelConfig)
	r.Get("/model-configs/{id}", a.getModelConfig)
	r.Patch("/model-configs/{id}", a.updateModelConfig)
	r.Delete("/model-configs/{id}", a.deleteModelConfig)
}

type memberInput struct {
	Email       string `json:"email"`
	DisplayName string `json:"displayName"`
	Password    string `json:"password"`
	Role        string `json:"role"`
	Status      string `json:"status"`
}

func validRole(role string) bool {
	return role == "org_owner" || role == "org_admin" || role == "member"
}
func validStatus(status string) bool { return status == "active" || status == "disabled" }
func (a *App) listMembers(w http.ResponseWriter, r *http.Request) {
	p := principal(r)
	rows, err := a.db.QueryContext(r.Context(), `SELECT u.id, u.email, u.display_name, u.status, m.role, m.status, u.last_login_at, u.created_at FROM users u JOIN organization_members m ON m.user_id = u.id WHERE m.organization_id = ? ORDER BY u.created_at DESC`, p.OrganizationID)
	if err != nil {
		writeError(w, 500, "DATABASE_ERROR", "could not list members")
		return
	}
	defer rows.Close()
	values := make([]map[string]any, 0)
	for rows.Next() {
		var id, email, name, userStatus, role, memberStatus, created string
		var lastLogin any
		if err := rows.Scan(&id, &email, &name, &userStatus, &role, &memberStatus, &lastLogin, &created); err != nil {
			writeError(w, 500, "DATABASE_ERROR", "could not read members")
			return
		}
		values = append(values, map[string]any{"id": id, "email": email, "displayName": name, "status": userStatus, "membershipStatus": memberStatus, "role": role, "lastLoginAt": lastLogin, "createdAt": created})
	}
	writeData(w, 200, values)
}
func (a *App) createMember(w http.ResponseWriter, r *http.Request) {
	var input memberInput
	if err := decode(r, &input); err != nil {
		invalid(w, err)
		return
	}
	input.Email = strings.ToLower(strings.TrimSpace(input.Email))
	if input.Email == "" || strings.TrimSpace(input.DisplayName) == "" || !validRole(input.Role) {
		writeError(w, 400, "INVALID_REQUEST", "email, displayName and a valid role are required")
		return
	}
	hash, err := platform.HashPassword(input.Password)
	if err != nil {
		invalid(w, err)
		return
	}
	p := principal(r)
	n, id := now(), platform.NewID()
	tx, err := a.db.BeginTx(r.Context(), nil)
	if err != nil {
		writeError(w, 500, "DATABASE_ERROR", "could not create member")
		return
	}
	defer tx.Rollback()
	_, err = tx.ExecContext(r.Context(), `INSERT INTO users(id, email, display_name, password_hash, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'active', ?, ?)`, id, input.Email, input.DisplayName, hash, n, n)
	if err == nil {
		_, err = tx.ExecContext(r.Context(), `INSERT INTO organization_members(organization_id, user_id, role, status, created_at, updated_at) VALUES (?, ?, ?, 'active', ?, ?)`, p.OrganizationID, id, input.Role, n, n)
	}
	if err != nil || tx.Commit() != nil {
		writeError(w, 409, "MEMBER_EXISTS", "could not create member")
		return
	}
	writeData(w, 201, map[string]string{"id": id, "email": input.Email, "displayName": input.DisplayName, "role": input.Role})
}
func (a *App) updateMember(w http.ResponseWriter, r *http.Request) {
	var input memberInput
	if err := decode(r, &input); err != nil {
		invalid(w, err)
		return
	}
	if input.Role != "" && !validRole(input.Role) || input.Status != "" && !validStatus(input.Status) {
		writeError(w, 400, "INVALID_REQUEST", "invalid role or status")
		return
	}
	p, id := principal(r), chi.URLParam(r, "id")
	tx, err := a.db.BeginTx(r.Context(), nil)
	if err != nil {
		writeError(w, 500, "DATABASE_ERROR", "could not update member")
		return
	}
	defer tx.Rollback()
	if input.DisplayName != "" {
		_, err = tx.ExecContext(r.Context(), `UPDATE users SET display_name = ?, updated_at = ? WHERE id = ? AND EXISTS (SELECT 1 FROM organization_members WHERE organization_id = ? AND user_id = ?)`, input.DisplayName, now(), id, p.OrganizationID, id)
	}
	if err == nil && input.Status != "" {
		_, err = tx.ExecContext(r.Context(), `UPDATE users SET status = ?, updated_at = ? WHERE id = ? AND EXISTS (SELECT 1 FROM organization_members WHERE organization_id = ? AND user_id = ?)`, input.Status, now(), id, p.OrganizationID, id)
	}
	if err == nil && input.Role != "" {
		_, err = tx.ExecContext(r.Context(), `UPDATE organization_members SET role = ?, updated_at = ? WHERE organization_id = ? AND user_id = ?`, input.Role, now(), p.OrganizationID, id)
	}
	if err == nil && input.Status != "" {
		_, err = tx.ExecContext(r.Context(), `UPDATE organization_members SET status = ?, updated_at = ? WHERE organization_id = ? AND user_id = ?`, input.Status, now(), p.OrganizationID, id)
	}
	if err == nil && input.Status == "disabled" {
		_, err = tx.ExecContext(r.Context(), `UPDATE auth_refresh_tokens SET revoked_at = ? WHERE user_id = ? AND organization_id = ? AND revoked_at IS NULL`, now(), id, p.OrganizationID)
	}
	if err != nil {
		writeError(w, 500, "DATABASE_ERROR", "could not update member")
		return
	}
	affected, _ := tx.ExecContext(r.Context(), "SELECT 1")
	_ = affected
	if err = tx.Commit(); err != nil {
		writeError(w, 500, "DATABASE_ERROR", "could not update member")
		return
	}
	writeData(w, 200, map[string]string{"id": id})
}
func (a *App) resetMemberPassword(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Password string `json:"password"`
	}
	if err := decode(r, &input); err != nil {
		invalid(w, err)
		return
	}
	hash, err := platform.HashPassword(input.Password)
	if err != nil {
		invalid(w, err)
		return
	}
	p, id := principal(r), chi.URLParam(r, "id")
	result, err := a.db.ExecContext(r.Context(), `UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ? AND EXISTS (SELECT 1 FROM organization_members WHERE organization_id = ? AND user_id = ?)`, hash, now(), id, p.OrganizationID, id)
	if err != nil {
		writeError(w, 500, "DATABASE_ERROR", "could not reset password")
		return
	}
	changed, _ := result.RowsAffected()
	if changed == 0 {
		writeError(w, 404, "NOT_FOUND", "member not found")
		return
	}
	_, _ = a.db.ExecContext(r.Context(), `UPDATE auth_refresh_tokens SET revoked_at = ? WHERE user_id = ? AND organization_id = ? AND revoked_at IS NULL`, now(), id, p.OrganizationID)
	writeData(w, 200, map[string]bool{"reset": true})
}

type modelInput struct {
	Provider    string `json:"provider"`
	DisplayName string `json:"displayName"`
	BaseURL     string `json:"baseUrl"`
	ModelName   string `json:"modelName"`
	APIKey      string `json:"apiKey"`
	Enabled     *bool  `json:"enabled"`
}

func (a *App) listModelConfigs(w http.ResponseWriter, r *http.Request) {
	p := principal(r)
	rows, err := a.db.QueryContext(r.Context(), `SELECT id, provider, display_name, base_url, model_name, enabled, key_version, created_at, updated_at FROM model_configs WHERE organization_id = ? ORDER BY created_at DESC`, p.OrganizationID)
	if err != nil {
		writeError(w, 500, "DATABASE_ERROR", "could not list models")
		return
	}
	defer rows.Close()
	values := make([]map[string]any, 0)
	for rows.Next() {
		var id, provider, displayName, baseURL, modelName, created, updated string
		var enabled bool
		var version int
		if err := rows.Scan(&id, &provider, &displayName, &baseURL, &modelName, &enabled, &version, &created, &updated); err != nil {
			writeError(w, 500, "DATABASE_ERROR", "could not read models")
			return
		}
		values = append(values, map[string]any{"id": id, "provider": provider, "displayName": displayName, "baseUrl": baseURL, "modelName": modelName, "enabled": enabled, "keyVersion": version, "apiKeyMasked": "********", "createdAt": created, "updatedAt": updated})
	}
	writeData(w, 200, values)
}
func (a *App) createModelConfig(w http.ResponseWriter, r *http.Request) {
	var input modelInput
	if err := decode(r, &input); err != nil {
		invalid(w, err)
		return
	}
	if strings.TrimSpace(input.Provider) == "" || strings.TrimSpace(input.DisplayName) == "" || strings.TrimSpace(input.BaseURL) == "" || strings.TrimSpace(input.ModelName) == "" || input.APIKey == "" {
		writeError(w, 400, "INVALID_REQUEST", "provider, displayName, baseUrl, modelName and apiKey are required")
		return
	}
	encrypted, err := platform.Encrypt(a.cfg.MasterKey, []byte(input.APIKey))
	if err != nil {
		writeError(w, 500, "CRYPTO_ERROR", "could not save model credential")
		return
	}
	p, id, n := principal(r), platform.NewID(), now()
	enabled := true
	if input.Enabled != nil {
		enabled = *input.Enabled
	}
	tx, err := a.db.BeginTx(r.Context(), nil)
	if err != nil {
		writeError(w, 500, "DATABASE_ERROR", "could not create model")
		return
	}
	defer tx.Rollback()
	_, err = tx.ExecContext(r.Context(), `INSERT INTO model_configs(id, organization_id, provider, display_name, base_url, model_name, enabled, key_version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`, id, p.OrganizationID, input.Provider, input.DisplayName, input.BaseURL, input.ModelName, enabled, n, n)
	if err == nil {
		_, err = tx.ExecContext(r.Context(), `INSERT INTO model_credentials(model_config_id, ciphertext, nonce, key_version, updated_at) VALUES (?, ?, ?, 1, ?)`, id, encrypted.Ciphertext, encrypted.Nonce, n)
	}
	if err != nil || tx.Commit() != nil {
		writeError(w, 500, "DATABASE_ERROR", "could not create model")
		return
	}
	writeData(w, 201, map[string]any{"id": id, "apiKeyMasked": "********"})
}
func (a *App) getModelConfig(w http.ResponseWriter, r *http.Request) { a.getOneModel(w, r) }
func (a *App) getOneModel(w http.ResponseWriter, r *http.Request) {
	p, id := principal(r), chi.URLParam(r, "id")
	var provider, displayName, baseURL, modelName string
	var enabled bool
	var version int
	err := a.db.QueryRowContext(r.Context(), `SELECT provider, display_name, base_url, model_name, enabled, key_version FROM model_configs WHERE id = ? AND organization_id = ?`, id, p.OrganizationID).Scan(&provider, &displayName, &baseURL, &modelName, &enabled, &version)
	if err != nil {
		invalid(w, err)
		return
	}
	writeData(w, 200, map[string]any{"id": id, "provider": provider, "displayName": displayName, "baseUrl": baseURL, "modelName": modelName, "enabled": enabled, "keyVersion": version, "apiKeyMasked": "********"})
}
func (a *App) updateModelConfig(w http.ResponseWriter, r *http.Request) {
	var input modelInput
	if err := decode(r, &input); err != nil {
		invalid(w, err)
		return
	}
	p, id := principal(r), chi.URLParam(r, "id")
	tx, err := a.db.BeginTx(r.Context(), nil)
	if err != nil {
		writeError(w, 500, "DATABASE_ERROR", "could not update model")
		return
	}
	defer tx.Rollback()
	result, err := tx.ExecContext(r.Context(), `UPDATE model_configs SET provider = CASE WHEN ? = '' THEN provider ELSE ? END, display_name = CASE WHEN ? = '' THEN display_name ELSE ? END, base_url = CASE WHEN ? = '' THEN base_url ELSE ? END, model_name = CASE WHEN ? = '' THEN model_name ELSE ? END, enabled = COALESCE(?, enabled), updated_at = ? WHERE id = ? AND organization_id = ?`, input.Provider, input.Provider, input.DisplayName, input.DisplayName, input.BaseURL, input.BaseURL, input.ModelName, input.ModelName, input.Enabled, now(), id, p.OrganizationID)
	if err != nil {
		writeError(w, 500, "DATABASE_ERROR", "could not update model")
		return
	}
	count, _ := result.RowsAffected()
	if count == 0 {
		writeError(w, 404, "NOT_FOUND", "model not found")
		return
	}
	if input.APIKey != "" {
		encrypted, encryptionErr := platform.Encrypt(a.cfg.MasterKey, []byte(input.APIKey))
		if encryptionErr != nil {
			writeError(w, 500, "CRYPTO_ERROR", "could not update credential")
			return
		}
		if _, err = tx.ExecContext(r.Context(), `UPDATE model_configs SET key_version = key_version + 1 WHERE id = ?`, id); err == nil {
			_, err = tx.ExecContext(r.Context(), `INSERT INTO model_credentials(model_config_id, ciphertext, nonce, key_version, updated_at) VALUES (?, ?, ?, (SELECT key_version FROM model_configs WHERE id = ?), ?) ON CONFLICT(model_config_id) DO UPDATE SET ciphertext = excluded.ciphertext, nonce = excluded.nonce, key_version = excluded.key_version, updated_at = excluded.updated_at`, id, encrypted.Ciphertext, encrypted.Nonce, id, now())
		}
		if err != nil {
			writeError(w, 500, "DATABASE_ERROR", "could not update credential")
			return
		}
	}
	if err = tx.Commit(); err != nil {
		writeError(w, 500, "DATABASE_ERROR", "could not update model")
		return
	}
	writeData(w, 200, map[string]string{"id": id})
}
func (a *App) deleteModelConfig(w http.ResponseWriter, r *http.Request) {
	p, id := principal(r), chi.URLParam(r, "id")
	result, err := a.db.ExecContext(r.Context(), `DELETE FROM model_configs WHERE id = ? AND organization_id = ?`, id, p.OrganizationID)
	if err != nil {
		writeError(w, 500, "DATABASE_ERROR", "could not delete model")
		return
	}
	count, _ := result.RowsAffected()
	if count == 0 {
		writeError(w, 404, "NOT_FOUND", "model not found")
		return
	}
	writeData(w, 200, map[string]bool{"deleted": true})
}
func (a *App) activeModels(w http.ResponseWriter, r *http.Request) {
	p := principal(r)
	rows, err := a.db.QueryContext(r.Context(), `SELECT c.id, c.provider, c.display_name, c.base_url, c.model_name, d.ciphertext, d.nonce FROM model_configs c JOIN model_credentials d ON d.model_config_id = c.id WHERE c.organization_id = ? AND c.enabled = 1`, p.OrganizationID)
	if err != nil {
		writeError(w, 500, "DATABASE_ERROR", "could not load models")
		return
	}
	defer rows.Close()
	values := make([]map[string]string, 0)
	for rows.Next() {
		var id, provider, displayName, baseURL, modelName string
		var ciphertext, nonce []byte
		if err := rows.Scan(&id, &provider, &displayName, &baseURL, &modelName, &ciphertext, &nonce); err != nil {
			writeError(w, 500, "DATABASE_ERROR", "could not read models")
			return
		}
		key, err := platform.Decrypt(a.cfg.MasterKey, platform.EncryptedValue{Ciphertext: ciphertext, Nonce: nonce})
		if err != nil {
			writeError(w, 500, "CRYPTO_ERROR", "could not read model credential")
			return
		}
		values = append(values, map[string]string{"id": id, "provider": provider, "displayName": displayName, "baseUrl": baseURL, "modelName": modelName, "apiKey": string(key)})
	}
	w.Header().Set("Cache-Control", "no-store")
	writeData(w, 200, values)
}
