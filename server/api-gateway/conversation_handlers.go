package main

import (
	"net/http"

	"github.com/cheney/happy-friday-enterprise/platform"
	"github.com/go-chi/chi/v5"
)

func (a *App) conversationRoutes() http.Handler {
	r := chi.NewRouter()
	r.Get("/", a.listConversations)
	r.Post("/", a.createConversation)
	r.Get("/{id}", a.getConversation)
	r.Patch("/{id}", a.updateConversation)
	r.Delete("/{id}", a.deleteConversation)
	r.Get("/{id}/messages", a.listMessages)
	r.Post("/{id}/messages", a.createMessage)
	r.Post("/{id}/rollback", a.rollbackConversation)
	r.Post("/cleanup", a.cleanupConversations)
	return r
}

type conversationInput struct {
	Title string `json:"title"`
	Kind  string `json:"kind"`
}

func (a *App) listConversations(w http.ResponseWriter, r *http.Request) {
	p := principal(r)
	rows, err := a.db.QueryContext(r.Context(), `SELECT id, title, kind, created_at, updated_at FROM conversations WHERE organization_id=? AND user_id=? AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 500`, p.OrganizationID, p.UserID)
	if err != nil {
		writeError(w, 500, "DATABASE_ERROR", "could not list conversations")
		return
	}
	defer rows.Close()
	values := []map[string]string{}
	for rows.Next() {
		var id, title, kind, created, updated string
		if err := rows.Scan(&id, &title, &kind, &created, &updated); err != nil {
			writeError(w, 500, "DATABASE_ERROR", "could not read conversations")
			return
		}
		values = append(values, map[string]string{"id": id, "title": title, "kind": kind, "createdAt": created, "updatedAt": updated})
	}
	writeData(w, 200, values)
}
func (a *App) createConversation(w http.ResponseWriter, r *http.Request) {
	var input conversationInput
	if err := decode(r, &input); err != nil {
		invalid(w, err)
		return
	}
	if input.Title == "" {
		input.Title = "新对话"
	}
	if input.Kind == "" {
		input.Kind = "chat"
	}
	p := principal(r)
	id, n := platform.NewID(), now()
	_, err := a.db.ExecContext(r.Context(), `INSERT INTO conversations(id,organization_id,user_id,title,kind,created_at,updated_at) VALUES(?,?,?,?,?,?,?)`, id, p.OrganizationID, p.UserID, input.Title, input.Kind, n, n)
	if err != nil {
		writeError(w, 500, "DATABASE_ERROR", "could not create conversation")
		return
	}
	writeData(w, 201, map[string]string{"id": id, "title": input.Title, "kind": input.Kind, "createdAt": n, "updatedAt": n})
}
func (a *App) getConversation(w http.ResponseWriter, r *http.Request) {
	p, id := principal(r), chi.URLParam(r, "id")
	var title, kind, created, updated string
	err := a.db.QueryRowContext(r.Context(), `SELECT title,kind,created_at,updated_at FROM conversations WHERE id=? AND organization_id=? AND user_id=? AND deleted_at IS NULL`, id, p.OrganizationID, p.UserID).Scan(&title, &kind, &created, &updated)
	if err != nil {
		invalid(w, err)
		return
	}
	writeData(w, 200, map[string]string{"id": id, "title": title, "kind": kind, "createdAt": created, "updatedAt": updated})
}
func (a *App) updateConversation(w http.ResponseWriter, r *http.Request) {
	var input conversationInput
	if err := decode(r, &input); err != nil {
		invalid(w, err)
		return
	}
	p, id := principal(r), chi.URLParam(r, "id")
	result, err := a.db.ExecContext(r.Context(), `UPDATE conversations SET title=CASE WHEN ?='' THEN title ELSE ? END, kind=CASE WHEN ?='' THEN kind ELSE ? END, updated_at=? WHERE id=? AND organization_id=? AND user_id=? AND deleted_at IS NULL`, input.Title, input.Title, input.Kind, input.Kind, now(), id, p.OrganizationID, p.UserID)
	if err != nil {
		writeError(w, 500, "DATABASE_ERROR", "could not update conversation")
		return
	}
	count, _ := result.RowsAffected()
	if count == 0 {
		writeError(w, 404, "NOT_FOUND", "conversation not found")
		return
	}
	writeData(w, 200, map[string]string{"id": id})
}
func (a *App) deleteConversation(w http.ResponseWriter, r *http.Request) {
	p, id := principal(r), chi.URLParam(r, "id")
	result, err := a.db.ExecContext(r.Context(), `UPDATE conversations SET deleted_at=?,updated_at=? WHERE id=? AND organization_id=? AND user_id=? AND deleted_at IS NULL`, now(), now(), id, p.OrganizationID, p.UserID)
	if err != nil {
		writeError(w, 500, "DATABASE_ERROR", "could not delete conversation")
		return
	}
	count, _ := result.RowsAffected()
	if count == 0 {
		writeError(w, 404, "NOT_FOUND", "conversation not found")
		return
	}
	writeData(w, 200, map[string]bool{"deleted": true})
}

type messageInput struct {
	Role     string `json:"role"`
	Content  string `json:"content"`
	Metadata string `json:"metadata"`
}

func (a *App) listMessages(w http.ResponseWriter, r *http.Request) {
	p, id := principal(r), chi.URLParam(r, "id")
	rows, err := a.db.QueryContext(r.Context(), `SELECT m.id,m.role,m.content,m.metadata,m.created_at FROM conversation_messages m JOIN conversations c ON c.id=m.conversation_id WHERE m.conversation_id=? AND m.organization_id=? AND c.user_id=? AND c.deleted_at IS NULL ORDER BY m.created_at ASC`, id, p.OrganizationID, p.UserID)
	if err != nil {
		writeError(w, 500, "DATABASE_ERROR", "could not list messages")
		return
	}
	defer rows.Close()
	values := []map[string]any{}
	for rows.Next() {
		var mid, role, content, created string
		var metadata any
		if err := rows.Scan(&mid, &role, &content, &metadata, &created); err != nil {
			writeError(w, 500, "DATABASE_ERROR", "could not read messages")
			return
		}
		values = append(values, map[string]any{"id": mid, "sessionId": id, "role": role, "content": content, "metadata": metadata, "createdAt": created})
	}
	writeData(w, 200, values)
}
func (a *App) createMessage(w http.ResponseWriter, r *http.Request) {
	var input messageInput
	if err := decode(r, &input); err != nil {
		invalid(w, err)
		return
	}
	if input.Role == "" {
		writeError(w, 400, "INVALID_REQUEST", "role is required")
		return
	}
	p, cid := principal(r), chi.URLParam(r, "id")
	id, n := platform.NewID(), now()
	result, err := a.db.ExecContext(r.Context(), `INSERT INTO conversation_messages(id,organization_id,conversation_id,role,content,metadata,created_at) SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM conversations WHERE id=? AND organization_id=? AND user_id=? AND deleted_at IS NULL)`, id, p.OrganizationID, cid, input.Role, input.Content, nullable(input.Metadata), n, cid, p.OrganizationID, p.UserID)
	if err != nil {
		writeError(w, 500, "DATABASE_ERROR", "could not create message")
		return
	}
	count, _ := result.RowsAffected()
	if count == 0 {
		writeError(w, 404, "NOT_FOUND", "conversation not found")
		return
	}
	_, _ = a.db.ExecContext(r.Context(), `UPDATE conversations SET updated_at=? WHERE id=? AND organization_id=? AND user_id=?`, n, cid, p.OrganizationID, p.UserID)
	writeData(w, 201, map[string]string{"id": id, "createdAt": n})
}
func (a *App) rollbackConversation(w http.ResponseWriter, r *http.Request) {
	var input struct {
		MessageID string `json:"messageId"`
	}
	if err := decode(r, &input); err != nil {
		invalid(w, err)
		return
	}
	if input.MessageID == "" {
		writeError(w, 400, "INVALID_REQUEST", "messageId is required")
		return
	}
	p, cid := principal(r), chi.URLParam(r, "id")
	result, err := a.db.ExecContext(r.Context(), `DELETE FROM conversation_messages WHERE conversation_id=? AND organization_id=? AND created_at >= (SELECT created_at FROM conversation_messages WHERE id=? AND conversation_id=?) AND EXISTS(SELECT 1 FROM conversations WHERE id=? AND organization_id=? AND user_id=? AND deleted_at IS NULL)`, cid, p.OrganizationID, input.MessageID, cid, cid, p.OrganizationID, p.UserID)
	if err != nil {
		writeError(w, 500, "DATABASE_ERROR", "could not roll back conversation")
		return
	}
	count, _ := result.RowsAffected()
	_, _ = a.db.ExecContext(r.Context(), `UPDATE conversations SET updated_at=? WHERE id=? AND organization_id=? AND user_id=?`, now(), cid, p.OrganizationID, p.UserID)
	writeData(w, 200, map[string]int64{"deleted": count})
}
func (a *App) cleanupConversations(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Before string `json:"before"`
	}
	if err := decode(r, &input); err != nil {
		invalid(w, err)
		return
	}
	if input.Before == "" {
		writeError(w, 400, "INVALID_REQUEST", "before is required")
		return
	}
	p := principal(r)
	result, err := a.db.ExecContext(r.Context(), `UPDATE conversations SET deleted_at=?,updated_at=? WHERE organization_id=? AND user_id=? AND updated_at<? AND deleted_at IS NULL`, now(), now(), p.OrganizationID, p.UserID, input.Before)
	if err != nil {
		writeError(w, 500, "DATABASE_ERROR", "could not clean conversations")
		return
	}
	count, _ := result.RowsAffected()
	writeData(w, 200, map[string]int64{"count": count})
}
