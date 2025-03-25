package db

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
)

type Task struct {
	ID                 int      `gorm:"primaryKey;autoIncrement" json:"id"`
	Title              string   `gorm:"not null;index:idx_tasks_title_duedate" json:"title"`
	DueDate            NullTime `gorm:"type:date;index:idx_tasks_title_duedate" json:"due_date"`
	Completed          int      `gorm:"default:0" json:"completed"`
	TaskOrder          int      `json:"order"`
	Color              string   `gorm:"default:''" json:"color"`
	Description        string   `gorm:"description"`
	RecurrenceRule     string   `gorm:"default:''" json:"recurrence_rule"`    // e.g., "daily", "weekly", "monthly", "yearly"
	RecurrenceInterval int      `gorm:"default:1" json:"recurrence_interval"` // Interval (1, 2, 3...) defaults to 1
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
	if t.RecurrenceRule != "" && t.RecurrenceInterval <= 0 {
		t.RecurrenceInterval = 1 // Default to 1 if rule is set but interval is invalid
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
