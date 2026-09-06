package main

import (
	"net/http"
	"strings"

	"github.com/cheney/happy-friday-enterprise/platform"
	"github.com/go-chi/chi/v5"
)

func (a *App) notebookRoutes() http.Handler {
	r := chi.NewRouter()
	r.Get("/", a.listNotebooks)
	r.Post("/", a.createNotebook)
	r.Get("/{id}", a.getNotebook)
	r.Patch("/{id}", a.updateNotebook)
	r.Delete("/{id}", a.deleteNotebook)
	return r
}

type notebookInput struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

func (a *App) listNotebooks(w http.ResponseWriter, r *http.Request) {
	p := principal(r)
	rows, err := a.db.QueryContext(r.Context(), `SELECT id,name,description,created_at,updated_at FROM notebooks WHERE organization_id=? AND user_id=? AND deleted_at IS NULL ORDER BY updated_at DESC`, p.OrganizationID, p.UserID)
	if err != nil {
		writeError(w, 500, "DATABASE_ERROR", "could not list notebooks")
		return
	}
	defer rows.Close()
	out := []map[string]string{}
	for rows.Next() {
		var id, name, desc, created, updated string
		if err := rows.Scan(&id, &name, &desc, &created, &updated); err != nil {
			writeError(w, 500, "DATABASE_ERROR", "could not read notebooks")
			return
		}
		out = append(out, map[string]string{"id": id, "name": name, "description": desc, "createdAt": created, "updatedAt": updated})
	}
	writeData(w, 200, out)
}
func (a *App) createNotebook(w http.ResponseWriter, r *http.Request) {
	var input notebookInput
	if err := decode(r, &input); err != nil {
		invalid(w, err)
		return
	}
	if input.Name == "" {
		input.Name = "新建笔记本"
	}
	p := principal(r)
	id, n := platform.NewID(), now()
	_, err := a.db.ExecContext(r.Context(), `INSERT INTO notebooks(id,organization_id,user_id,name,description,created_at,updated_at) VALUES(?,?,?,?,?,?,?)`, id, p.OrganizationID, p.UserID, input.Name, input.Description, n, n)
	if err != nil {
		writeError(w, 500, "DATABASE_ERROR", "could not create notebook")
		return
	}
	writeData(w, 201, map[string]string{"id": id, "name": input.Name, "description": input.Description, "createdAt": n, "updatedAt": n})
}
func (a *App) getNotebook(w http.ResponseWriter, r *http.Request) {
	p, id := principal(r), chi.URLParam(r, "id")
	var name, desc, created, updated string
	err := a.db.QueryRowContext(r.Context(), `SELECT name,description,created_at,updated_at FROM notebooks WHERE id=? AND organization_id=? AND user_id=? AND deleted_at IS NULL`, id, p.OrganizationID, p.UserID).Scan(&name, &desc, &created, &updated)
	if err != nil {
		invalid(w, err)
		return
	}
	writeData(w, 200, map[string]string{"id": id, "name": name, "description": desc, "createdAt": created, "updatedAt": updated})
}
func (a *App) updateNotebook(w http.ResponseWriter, r *http.Request) {
	var input notebookInput
	if err := decode(r, &input); err != nil {
		invalid(w, err)
		return
	}
	p, id := principal(r), chi.URLParam(r, "id")
	result, err := a.db.ExecContext(r.Context(), `UPDATE notebooks SET name=CASE WHEN ?='' THEN name ELSE ? END,description=?,updated_at=? WHERE id=? AND organization_id=? AND user_id=? AND deleted_at IS NULL`, input.Name, input.Name, input.Description, now(), id, p.OrganizationID, p.UserID)
	if err != nil {
		writeError(w, 500, "DATABASE_ERROR", "could not update notebook")
		return
	}
	count, _ := result.RowsAffected()
	if count == 0 {
		writeError(w, 404, "NOT_FOUND", "notebook not found")
		return
	}
	writeData(w, 200, map[string]string{"id": id})
}
func (a *App) deleteNotebook(w http.ResponseWriter, r *http.Request) {
	p, id := principal(r), chi.URLParam(r, "id")
	tx, err := a.db.BeginTx(r.Context(), nil)
	if err != nil {
		writeError(w, 500, "DATABASE_ERROR", "could not delete notebook")
		return
	}
	defer tx.Rollback()
	result, err := tx.ExecContext(r.Context(), `UPDATE notebooks SET deleted_at=?,updated_at=? WHERE id=? AND organization_id=? AND user_id=? AND deleted_at IS NULL`, now(), now(), id, p.OrganizationID, p.UserID)
	if err == nil {
		_, err = tx.ExecContext(r.Context(), `UPDATE notes SET notebook_id=NULL,updated_at=? WHERE notebook_id=? AND organization_id=? AND user_id=?`, now(), id, p.OrganizationID, p.UserID)
	}
	if err != nil || tx.Commit() != nil {
		writeError(w, 500, "DATABASE_ERROR", "could not delete notebook")
		return
	}
	count, _ := result.RowsAffected()
	if count == 0 {
		writeError(w, 404, "NOT_FOUND", "notebook not found")
		return
	}
	writeData(w, 200, map[string]bool{"deleted": true})
}

func (a *App) noteRoutes() http.Handler {
	r := chi.NewRouter()
	r.Get("/", a.listNotes)
	r.Post("/", a.createNote)
	r.Get("/search", a.searchNotes)
	r.Get("/{id}", a.getNote)
	r.Patch("/{id}", a.updateNote)
	r.Delete("/{id}", a.deleteNote)
	return r
}

type noteInput struct {
	NotebookID  *string `json:"notebookId"`
	Title       string  `json:"title"`
	Content     string  `json:"content"`
	ContentText string  `json:"contentText"`
}

func (a *App) listNotes(w http.ResponseWriter, r *http.Request) {
	p := principal(r)
	query := `SELECT id,notebook_id,title,content,content_text,created_at,updated_at FROM notes WHERE organization_id=? AND user_id=? AND deleted_at IS NULL`
	args := []any{p.OrganizationID, p.UserID}
	if notebook := r.URL.Query().Get("notebookId"); notebook != "" {
		query += ` AND notebook_id=?`
		args = append(args, notebook)
	}
	query += ` ORDER BY updated_at DESC LIMIT 500`
	rows, err := a.db.QueryContext(r.Context(), query, args...)
	if err != nil {
		writeError(w, 500, "DATABASE_ERROR", "could not list notes")
		return
	}
	defer rows.Close()
	writeNotes(w, rows)
}
func writeNotes(w http.ResponseWriter, rows interface {
	Next() bool
	Scan(...any) error
	Close() error
}) {
	out := []map[string]any{}
	for rows.Next() {
		var id, title, content, text, created, updated string
		var notebook any
		if err := rows.Scan(&id, &notebook, &title, &content, &text, &created, &updated); err != nil {
			writeError(w, 500, "DATABASE_ERROR", "could not read notes")
			return
		}
		out = append(out, map[string]any{"id": id, "notebookId": notebook, "title": title, "content": content, "contentText": text, "createdAt": created, "updatedAt": updated})
	}
	writeData(w, 200, out)
}
func (a *App) createNote(w http.ResponseWriter, r *http.Request) {
	var input noteInput
	if err := decode(r, &input); err != nil {
		invalid(w, err)
		return
	}
	if input.Title == "" {
		input.Title = "新建笔记"
	}
	p := principal(r)
	id, n := platform.NewID(), now()
	_, err := a.db.ExecContext(r.Context(), `INSERT INTO notes(id,organization_id,user_id,notebook_id,title,content,content_text,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)`, id, p.OrganizationID, p.UserID, input.NotebookID, input.Title, input.Content, input.ContentText, n, n)
	if err != nil {
		writeError(w, 500, "DATABASE_ERROR", "could not create note")
		return
	}
	writeData(w, 201, map[string]any{"id": id, "notebookId": input.NotebookID, "title": input.Title, "content": input.Content, "contentText": input.ContentText, "createdAt": n, "updatedAt": n})
}
func (a *App) getNote(w http.ResponseWriter, r *http.Request) {
	p, id := principal(r), chi.URLParam(r, "id")
	var noteID, title, content, text, created, updated string
	var notebook any
	err := a.db.QueryRowContext(r.Context(), `SELECT id,notebook_id,title,content,content_text,created_at,updated_at FROM notes WHERE id=? AND organization_id=? AND user_id=? AND deleted_at IS NULL`, id, p.OrganizationID, p.UserID).Scan(&noteID, &notebook, &title, &content, &text, &created, &updated)
	if err != nil {
		invalid(w, err)
		return
	}
	writeData(w, 200, map[string]any{"id": noteID, "notebookId": notebook, "title": title, "content": content, "contentText": text, "createdAt": created, "updatedAt": updated})
}
func (a *App) updateNote(w http.ResponseWriter, r *http.Request) {
	var input noteInput
	if err := decode(r, &input); err != nil {
		invalid(w, err)
		return
	}
	p, id := principal(r), chi.URLParam(r, "id")
	result, err := a.db.ExecContext(r.Context(), `UPDATE notes SET notebook_id=?,title=CASE WHEN ?='' THEN title ELSE ? END,content=?,content_text=?,updated_at=? WHERE id=? AND organization_id=? AND user_id=? AND deleted_at IS NULL`, input.NotebookID, input.Title, input.Title, input.Content, input.ContentText, now(), id, p.OrganizationID, p.UserID)
	if err != nil {
		writeError(w, 500, "DATABASE_ERROR", "could not update note")
		return
	}
	count, _ := result.RowsAffected()
	if count == 0 {
		writeError(w, 404, "NOT_FOUND", "note not found")
		return
	}
	writeData(w, 200, map[string]string{"id": id})
}
func (a *App) deleteNote(w http.ResponseWriter, r *http.Request) {
	p, id := principal(r), chi.URLParam(r, "id")
	result, err := a.db.ExecContext(r.Context(), `UPDATE notes SET deleted_at=?,updated_at=? WHERE id=? AND organization_id=? AND user_id=? AND deleted_at IS NULL`, now(), now(), id, p.OrganizationID, p.UserID)
	if err != nil {
		writeError(w, 500, "DATABASE_ERROR", "could not delete note")
		return
	}
	count, _ := result.RowsAffected()
	if count == 0 {
		writeError(w, 404, "NOT_FOUND", "note not found")
		return
	}
	writeData(w, 200, map[string]bool{"deleted": true})
}
func (a *App) searchNotes(w http.ResponseWriter, r *http.Request) {
	p := principal(r)
	term := strings.TrimSpace(r.URL.Query().Get("q"))
	if term == "" {
		writeError(w, 400, "INVALID_REQUEST", "q is required")
		return
	}
	rows, err := a.db.QueryContext(r.Context(), `SELECT n.id,n.notebook_id,n.title,n.content,n.content_text,n.created_at,n.updated_at FROM notes_fts f JOIN notes n ON n.id=f.note_id WHERE notes_fts MATCH ? AND f.organization_id=? AND f.user_id=? AND n.deleted_at IS NULL ORDER BY rank LIMIT 100`, term, p.OrganizationID, p.UserID)
	if err != nil {
		writeError(w, 400, "INVALID_REQUEST", "invalid full text query")
		return
	}
	defer rows.Close()
	writeNotes(w, rows)
}
