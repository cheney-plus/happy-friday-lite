package main

import (
	"net/http"
	"time"

	"github.com/cheney/happy-friday-enterprise/platform"
	"github.com/go-chi/chi/v5"
)

type preferencesInput struct {
	Language       string `json:"language"`
	Theme          string `json:"theme"`
	SystemPrompt   string `json:"systemPrompt"`
	SidebarModules string `json:"sidebarModules"`
}

func (a *App) getPreferences(w http.ResponseWriter, r *http.Request) {
	p := principal(r)
	var language, theme, prompt, modules, updated string
	err := a.db.QueryRowContext(r.Context(), `SELECT language, theme, system_prompt, sidebar_modules, updated_at FROM user_preferences WHERE organization_id = ? AND user_id = ?`, p.OrganizationID, p.UserID).Scan(&language, &theme, &prompt, &modules, &updated)
	if err != nil {
		if err.Error() != "sql: no rows in result set" {
			invalid(w, err)
			return
		}
		writeData(w, 200, map[string]string{"language": "zh-CN", "theme": "light", "systemPrompt": "", "sidebarModules": "{}"})
		return
	}
	writeData(w, 200, map[string]string{"language": language, "theme": theme, "systemPrompt": prompt, "sidebarModules": modules, "updatedAt": updated})
}
func (a *App) savePreferences(w http.ResponseWriter, r *http.Request) {
	var input preferencesInput
	if err := decode(r, &input); err != nil {
		invalid(w, err)
		return
	}
	p := principal(r)
	if input.Language == "" {
		input.Language = "zh-CN"
	}
	if input.Theme == "" {
		input.Theme = "light"
	}
	if input.SidebarModules == "" {
		input.SidebarModules = "{}"
	}
	n := now()
	_, err := a.db.ExecContext(r.Context(), `INSERT INTO user_preferences(organization_id, user_id, language, theme, system_prompt, sidebar_modules, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(organization_id, user_id) DO UPDATE SET language=excluded.language, theme=excluded.theme, system_prompt=excluded.system_prompt, sidebar_modules=excluded.sidebar_modules, updated_at=excluded.updated_at`, p.OrganizationID, p.UserID, input.Language, input.Theme, input.SystemPrompt, input.SidebarModules, n)
	if err != nil {
		writeError(w, 500, "DATABASE_ERROR", "could not save preferences")
		return
	}
	writeData(w, 200, map[string]string{"updatedAt": n})
}

func (a *App) usageRoutes() http.Handler {
	r := chi.NewRouter()
	r.Get("/", a.listUsage)
	r.Post("/", a.createUsage)
	r.Delete("/", a.clearUsage)
	r.Get("/summary", a.usageSummary)
	return r
}

type usageInput struct {
	ModelConfigID    string `json:"modelConfigId"`
	ModelName        string `json:"modelName"`
	Provider         string `json:"provider"`
	PromptTokens     int    `json:"promptTokens"`
	CompletionTokens int    `json:"completionTokens"`
	TotalTokens      int    `json:"totalTokens"`
	ReasoningTokens  int    `json:"reasoningTokens"`
	Source           string `json:"source"`
	OccurredAt       string `json:"occurredAt"`
}

func (a *App) createUsage(w http.ResponseWriter, r *http.Request) {
	var input usageInput
	if err := decode(r, &input); err != nil {
		invalid(w, err)
		return
	}
	if input.TotalTokens < 0 || input.PromptTokens < 0 || input.CompletionTokens < 0 || input.ReasoningTokens < 0 {
		writeError(w, 400, "INVALID_REQUEST", "token counts cannot be negative")
		return
	}
	p := principal(r)
	when := time.Now().UTC().Format(time.RFC3339Nano)
	if input.OccurredAt != "" {
		parsed, err := time.Parse(time.RFC3339Nano, input.OccurredAt)
		if err != nil {
			invalid(w, err)
			return
		}
		when = parsed.UTC().Format(time.RFC3339Nano)
	}
	if input.Source == "" {
		input.Source = "chat"
	}
	id := platform.NewID()
	_, err := a.db.ExecContext(r.Context(), `INSERT INTO llm_usage_records(id, organization_id, user_id, model_config_id, model_name, provider, prompt_tokens, completion_tokens, total_tokens, reasoning_tokens, source, occurred_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, id, p.OrganizationID, p.UserID, nullable(input.ModelConfigID), input.ModelName, input.Provider, input.PromptTokens, input.CompletionTokens, input.TotalTokens, input.ReasoningTokens, input.Source, when)
	if err != nil {
		writeError(w, 500, "DATABASE_ERROR", "could not store usage record")
		return
	}
	writeData(w, 201, map[string]string{"id": id})
}

func (a *App) clearUsage(w http.ResponseWriter, r *http.Request) {
	p := principal(r)
	if _, err := a.db.ExecContext(r.Context(), `DELETE FROM llm_usage_records WHERE organization_id = ? AND user_id = ?`, p.OrganizationID, p.UserID); err != nil {
		writeError(w, 500, "DATABASE_ERROR", "could not clear usage records")
		return
	}
	writeData(w, http.StatusOK, map[string]bool{"cleared": true})
}
func (a *App) listUsage(w http.ResponseWriter, r *http.Request) {
	p := principal(r)
	rows, err := a.db.QueryContext(r.Context(), `SELECT id, model_config_id, model_name, provider, prompt_tokens, completion_tokens, total_tokens, reasoning_tokens, source, occurred_at FROM llm_usage_records WHERE organization_id = ? AND user_id = ? ORDER BY occurred_at DESC LIMIT 500`, p.OrganizationID, p.UserID)
	if err != nil {
		writeError(w, 500, "DATABASE_ERROR", "could not list usage records")
		return
	}
	defer rows.Close()
	values := []map[string]any{}
	for rows.Next() {
		var id, modelName, provider, source, occurred string
		var configID any
		var prompt, completion, total, reasoning int
		if err := rows.Scan(&id, &configID, &modelName, &provider, &prompt, &completion, &total, &reasoning, &source, &occurred); err != nil {
			writeError(w, 500, "DATABASE_ERROR", "could not read usage records")
			return
		}
		values = append(values, map[string]any{"id": id, "modelConfigId": configID, "modelName": modelName, "provider": provider, "promptTokens": prompt, "completionTokens": completion, "totalTokens": total, "reasoningTokens": reasoning, "source": source, "occurredAt": occurred})
	}
	writeData(w, 200, values)
}
func (a *App) usageSummary(w http.ResponseWriter, r *http.Request) {
	p := principal(r)
	var prompt, completion, total, reasoning, requests int
	err := a.db.QueryRowContext(r.Context(), `SELECT COALESCE(SUM(prompt_tokens),0), COALESCE(SUM(completion_tokens),0), COALESCE(SUM(total_tokens),0), COALESCE(SUM(reasoning_tokens),0), COUNT(*) FROM llm_usage_records WHERE organization_id = ? AND user_id = ?`, p.OrganizationID, p.UserID).Scan(&prompt, &completion, &total, &reasoning, &requests)
	if err != nil {
		writeError(w, 500, "DATABASE_ERROR", "could not summarize usage")
		return
	}
	writeData(w, 200, map[string]int{"promptTokens": prompt, "completionTokens": completion, "totalTokens": total, "reasoningTokens": reasoning, "requests": requests})
}
