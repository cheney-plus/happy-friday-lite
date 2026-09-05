package main

import (
	"encoding/json"
	"net/http"
)

func openAPI(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(map[string]any{"openapi": "3.1.0", "info": map[string]string{"title": "Happy Friday Enterprise API", "version": "v1"}, "paths": map[string]any{"/api/v1/auth/login": map[string]any{"post": map[string]string{"summary": "Employee login"}}, "/api/v1/model-configs/active": map[string]any{"get": map[string]string{"summary": "Active shared model configuration"}}, "/api/v1/conversations": map[string]any{"get": map[string]string{"summary": "List user conversations"}, "post": map[string]string{"summary": "Create user conversation"}}, "/api/v1/notes": map[string]any{"get": map[string]string{"summary": "List user notes"}, "post": map[string]string{"summary": "Create user note"}}, "/api/v1/schedule-events": map[string]any{"get": map[string]string{"summary": "List user events"}, "post": map[string]string{"summary": "Create user event"}}}})
}
