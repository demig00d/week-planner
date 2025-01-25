package db

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
)

type Task struct {
	ID          int      `gorm:"primaryKey;autoIncrement" json:"id"`
	Title       string   `gorm:"not null" json:"title"`
	DueDate     NullTime `gorm:"type:date" json:"due_date"`
	Completed   int      `gorm:"default:0" json:"completed"`
	TaskOrder   int      `json:"order"`
	Color       string   `gorm:"default:''" json:"color"`
	Description string   `json:"description"`
}

type Tasks []Task

type APIError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

type NullTime sql.NullTime

func (t *Task) Validate() error {
	if t.Title == "" {
		return NewAPIError(400, "Task title is required")
	}
	return nil
}

func NewAPIError(code int, message string) error {
	return &APIError{
		Code:    code,
		Message: message,
	}
}

func (e *APIError) Error() string {
	return fmt.Sprintf("APIError: %d - %s", e.Code, e.Message)
}

func (e *APIError) WriteResponse(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(e.Code)
	json.NewEncoder(w).Encode(e)
}
