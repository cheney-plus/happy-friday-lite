package main

import (
	"net/http"

	"github.com/cheney/happy-friday-enterprise/platform"
	"github.com/go-chi/chi/v5"
)

func (a *App) scheduleRoutes() http.Handler {
	r := chi.NewRouter()
	r.Get("/", a.listSchedule)
	r.Post("/", a.createSchedule)
	r.Patch("/{id}", a.updateSchedule)
	r.Delete("/{id}", a.deleteSchedule)
	return r
}

type scheduleInput struct {
	Title       string `json:"title"`
	StartDate   string `json:"startDate"`
	EndDate     string `json:"endDate"`
	StartTime   string `json:"startTime"`
	EndTime     string `json:"endTime"`
	AllDay      bool   `json:"allDay"`
	Description string `json:"description"`
	Color       string `json:"color"`
	Reminder    bool   `json:"reminder"`
	Completed   bool   `json:"completed"`
	Priority    string `json:"priority"`
}

func (a *App) listSchedule(w http.ResponseWriter, r *http.Request) {
	p := principal(r)
	start, end := r.URL.Query().Get("startDate"), r.URL.Query().Get("endDate")
	q := `SELECT id,title,start_date,end_date,start_time,end_time,all_day,description,color,reminder,completed,priority,created_at,updated_at FROM schedule_events WHERE organization_id=? AND user_id=? AND deleted_at IS NULL`
	args := []any{p.OrganizationID, p.UserID}
	if start != "" && end != "" {
		q += ` AND start_date<=? AND end_date>=?`
		args = append(args, end, start)
	}
	q += ` ORDER BY start_date,start_time LIMIT 500`
	rows, err := a.db.QueryContext(r.Context(), q, args...)
	if err != nil {
		writeError(w, 500, "DATABASE_ERROR", "could not list events")
		return
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var id, title, sd, ed, st, et, desc, color, priority, created, updated string
		var all, rem, done bool
		if err := rows.Scan(&id, &title, &sd, &ed, &st, &et, &all, &desc, &color, &rem, &done, &priority, &created, &updated); err != nil {
			writeError(w, 500, "DATABASE_ERROR", "could not read events")
			return
		}
		out = append(out, map[string]any{"id": id, "title": title, "start": sd, "end": ed, "startTime": st, "endTime": et, "allDay": all, "description": desc, "color": color, "reminder": rem, "completed": done, "priority": priority, "createdAt": created, "updatedAt": updated})
	}
	writeData(w, 200, out)
}
func (a *App) createSchedule(w http.ResponseWriter, r *http.Request) {
	var in scheduleInput
	if err := decode(r, &in); err != nil {
		invalid(w, err)
		return
	}
	if in.StartDate == "" || in.EndDate == "" {
		writeError(w, 400, "INVALID_REQUEST", "startDate and endDate are required")
		return
	}
	if in.Color == "" {
		in.Color = "#60a5fa"
	}
	if in.Priority == "" {
		in.Priority = "important"
	}
	p := principal(r)
	id, n := platform.NewID(), now()
	_, err := a.db.ExecContext(r.Context(), `INSERT INTO schedule_events(id,organization_id,user_id,title,start_date,end_date,start_time,end_time,all_day,description,color,reminder,completed,priority,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, id, p.OrganizationID, p.UserID, in.Title, in.StartDate, in.EndDate, in.StartTime, in.EndTime, in.AllDay, in.Description, in.Color, in.Reminder, in.Completed, in.Priority, n, n)
	if err != nil {
		writeError(w, 500, "DATABASE_ERROR", "could not create event")
		return
	}
	writeData(w, 201, map[string]string{"id": id})
}
func (a *App) updateSchedule(w http.ResponseWriter, r *http.Request) {
	var in scheduleInput
	if err := decode(r, &in); err != nil {
		invalid(w, err)
		return
	}
	p, id := principal(r), chi.URLParam(r, "id")
	result, err := a.db.ExecContext(r.Context(), `UPDATE schedule_events SET title=?,start_date=CASE WHEN ?='' THEN start_date ELSE ? END,end_date=CASE WHEN ?='' THEN end_date ELSE ? END,start_time=?,end_time=?,all_day=?,description=?,color=CASE WHEN ?='' THEN color ELSE ? END,reminder=?,completed=?,priority=CASE WHEN ?='' THEN priority ELSE ? END,updated_at=? WHERE id=? AND organization_id=? AND user_id=? AND deleted_at IS NULL`, in.Title, in.StartDate, in.StartDate, in.EndDate, in.EndDate, in.StartTime, in.EndTime, in.AllDay, in.Description, in.Color, in.Color, in.Reminder, in.Completed, in.Priority, in.Priority, now(), id, p.OrganizationID, p.UserID)
	if err != nil {
		writeError(w, 500, "DATABASE_ERROR", "could not update event")
		return
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		writeError(w, 404, "NOT_FOUND", "event not found")
		return
	}
	writeData(w, 200, map[string]string{"id": id})
}
func (a *App) deleteSchedule(w http.ResponseWriter, r *http.Request) {
	p, id := principal(r), chi.URLParam(r, "id")
	result, err := a.db.ExecContext(r.Context(), `UPDATE schedule_events SET deleted_at=?,updated_at=? WHERE id=? AND organization_id=? AND user_id=? AND deleted_at IS NULL`, now(), now(), id, p.OrganizationID, p.UserID)
	if err != nil {
		writeError(w, 500, "DATABASE_ERROR", "could not delete event")
		return
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		writeError(w, 404, "NOT_FOUND", "event not found")
		return
	}
	writeData(w, 200, map[string]bool{"deleted": true})
}

func (a *App) automationRoutes() http.Handler {
	r := chi.NewRouter()
	r.Get("/tasks", a.listTasks)
	r.Post("/tasks", a.createTask)
	r.Patch("/tasks/{id}", a.updateTask)
	r.Delete("/tasks/{id}", a.deleteTask)
	r.Get("/runs", a.listRuns)
	r.Post("/runs", a.createRun)
	r.Delete("/runs/{id}", a.deleteRun)
	return r
}

type taskInput struct {
	Name           string  `json:"name"`
	Instruction    string  `json:"instruction"`
	ModelConfigID  *string `json:"modelConfigId"`
	TriggerType    string  `json:"triggerType"`
	TriggerConfig  string  `json:"triggerConfig"`
	CronExpression *string `json:"cronExpression"`
	Enabled        bool    `json:"enabled"`
	NextRunAt      *string `json:"nextRunAt"`
}

func (a *App) listTasks(w http.ResponseWriter, r *http.Request) {
	p := principal(r)
	rows, err := a.db.QueryContext(r.Context(), `SELECT id,name,instruction,model_config_id,trigger_type,trigger_config,cron_expression,enabled,last_run_at,next_run_at,created_at,updated_at FROM automation_tasks WHERE organization_id=? AND user_id=? AND deleted_at IS NULL ORDER BY updated_at DESC`, p.OrganizationID, p.UserID)
	if err != nil {
		writeError(w, 500, "DATABASE_ERROR", "could not list tasks")
		return
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var id, name, instruction, kind, config, created, updated string
		var model, cron, last, next any
		var enabled bool
		if err := rows.Scan(&id, &name, &instruction, &model, &kind, &config, &cron, &enabled, &last, &next, &created, &updated); err != nil {
			writeError(w, 500, "DATABASE_ERROR", "could not read tasks")
			return
		}
		out = append(out, map[string]any{"id": id, "name": name, "instruction": instruction, "modelConfigId": model, "triggerType": kind, "triggerConfig": config, "cronExpression": cron, "enabled": enabled, "lastRunAt": last, "nextRunAt": next, "createdAt": created, "updatedAt": updated})
	}
	writeData(w, 200, out)
}
func (a *App) createTask(w http.ResponseWriter, r *http.Request) {
	var in taskInput
	if err := decode(r, &in); err != nil {
		invalid(w, err)
		return
	}
	if in.Name == "" || in.Instruction == "" || in.TriggerType == "" {
		writeError(w, 400, "INVALID_REQUEST", "name, instruction and triggerType are required")
		return
	}
	if in.TriggerConfig == "" {
		in.TriggerConfig = "{}"
	}
	p := principal(r)
	id, n := platform.NewID(), now()
	_, err := a.db.ExecContext(r.Context(), `INSERT INTO automation_tasks(id,organization_id,user_id,name,instruction,model_config_id,trigger_type,trigger_config,cron_expression,enabled,next_run_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`, id, p.OrganizationID, p.UserID, in.Name, in.Instruction, in.ModelConfigID, in.TriggerType, in.TriggerConfig, in.CronExpression, in.Enabled, in.NextRunAt, n, n)
	if err != nil {
		writeError(w, 500, "DATABASE_ERROR", "could not create task")
		return
	}
	writeData(w, 201, map[string]string{"id": id})
}
func (a *App) updateTask(w http.ResponseWriter, r *http.Request) {
	var in taskInput
	if err := decode(r, &in); err != nil {
		invalid(w, err)
		return
	}
	p, id := principal(r), chi.URLParam(r, "id")
	result, err := a.db.ExecContext(r.Context(), `UPDATE automation_tasks SET name=CASE WHEN ?='' THEN name ELSE ? END,instruction=CASE WHEN ?='' THEN instruction ELSE ? END,model_config_id=?,trigger_type=CASE WHEN ?='' THEN trigger_type ELSE ? END,trigger_config=CASE WHEN ?='' THEN trigger_config ELSE ? END,cron_expression=?,enabled=?,next_run_at=?,updated_at=? WHERE id=? AND organization_id=? AND user_id=? AND deleted_at IS NULL`, in.Name, in.Name, in.Instruction, in.Instruction, in.ModelConfigID, in.TriggerType, in.TriggerType, in.TriggerConfig, in.TriggerConfig, in.CronExpression, in.Enabled, in.NextRunAt, now(), id, p.OrganizationID, p.UserID)
	if err != nil {
		writeError(w, 500, "DATABASE_ERROR", "could not update task")
		return
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		writeError(w, 404, "NOT_FOUND", "task not found")
		return
	}
	writeData(w, 200, map[string]string{"id": id})
}
func (a *App) deleteTask(w http.ResponseWriter, r *http.Request) {
	p, id := principal(r), chi.URLParam(r, "id")
	result, err := a.db.ExecContext(r.Context(), `UPDATE automation_tasks SET deleted_at=?,updated_at=? WHERE id=? AND organization_id=? AND user_id=? AND deleted_at IS NULL`, now(), now(), id, p.OrganizationID, p.UserID)
	if err != nil {
		writeError(w, 500, "DATABASE_ERROR", "could not delete task")
		return
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		writeError(w, 404, "NOT_FOUND", "task not found")
		return
	}
	writeData(w, 200, map[string]bool{"deleted": true})
}

type runInput struct {
	TaskID         string  `json:"taskId"`
	ConversationID *string `json:"conversationId"`
	Trigger        string  `json:"trigger"`
	Status         string  `json:"status"`
	StartedAt      string  `json:"startedAt"`
	CompletedAt    *string `json:"completedAt"`
	DurationMS     *int    `json:"durationMs"`
	Output         string  `json:"output"`
	Error          string  `json:"error"`
}

func (a *App) listRuns(w http.ResponseWriter, r *http.Request) {
	p := principal(r)
	rows, err := a.db.QueryContext(r.Context(), `SELECT id,task_id,conversation_id,trigger,status,started_at,completed_at,duration_ms,output,error FROM automation_runs WHERE organization_id=? AND user_id=? ORDER BY started_at DESC LIMIT 500`, p.OrganizationID, p.UserID)
	if err != nil {
		writeError(w, 500, "DATABASE_ERROR", "could not list runs")
		return
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var id, task, trigger, status, started, output, e string
		var convo, completed, duration any
		if err := rows.Scan(&id, &task, &convo, &trigger, &status, &started, &completed, &duration, &output, &e); err != nil {
			writeError(w, 500, "DATABASE_ERROR", "could not read runs")
			return
		}
		out = append(out, map[string]any{"id": id, "taskId": task, "conversationId": convo, "trigger": trigger, "status": status, "startedAt": started, "completedAt": completed, "durationMs": duration, "output": output, "error": e})
	}
	writeData(w, 200, out)
}
func (a *App) createRun(w http.ResponseWriter, r *http.Request) {
	var in runInput
	if err := decode(r, &in); err != nil {
		invalid(w, err)
		return
	}
	if in.TaskID == "" || in.Trigger == "" || in.Status == "" {
		writeError(w, 400, "INVALID_REQUEST", "taskId, trigger and status are required")
		return
	}
	if in.StartedAt == "" {
		in.StartedAt = now()
	}
	p := principal(r)
	id := platform.NewID()
	result, err := a.db.ExecContext(r.Context(), `INSERT INTO automation_runs(id,organization_id,user_id,task_id,conversation_id,trigger,status,started_at,completed_at,duration_ms,output,error) SELECT ?,?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM automation_tasks WHERE id=? AND organization_id=? AND user_id=? AND deleted_at IS NULL)`, id, p.OrganizationID, p.UserID, in.TaskID, in.ConversationID, in.Trigger, in.Status, in.StartedAt, in.CompletedAt, in.DurationMS, in.Output, in.Error, in.TaskID, p.OrganizationID, p.UserID)
	if err != nil {
		writeError(w, 500, "DATABASE_ERROR", "could not create run")
		return
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		writeError(w, 404, "NOT_FOUND", "task not found")
		return
	}
	writeData(w, 201, map[string]string{"id": id})
}
func (a *App) deleteRun(w http.ResponseWriter, r *http.Request) {
	p, id := principal(r), chi.URLParam(r, "id")
	result, err := a.db.ExecContext(r.Context(), `DELETE FROM automation_runs WHERE id=? AND organization_id=? AND user_id=?`, id, p.OrganizationID, p.UserID)
	if err != nil {
		writeError(w, 500, "DATABASE_ERROR", "could not delete run")
		return
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		writeError(w, 404, "NOT_FOUND", "run not found")
		return
	}
	writeData(w, 200, map[string]bool{"deleted": true})
}
