package db

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"log/slog"
	"strings"
	"time"
	"unicode"

	"week-planner/internal/config"

	"gorm.io/gorm"
)

// GetTasks retrieves tasks for a given date or date range.
func GetTasks(date string, startDate string, endDate string) (Tasks, error) {
	var tasks Tasks
	query := GetDB().Model(&Task{})

	if date == "inbox" {
		query = query.Where("due_date IS NULL")
	} else if startDate != "" && endDate != "" {
		_, err := time.Parse(config.DateFormat, startDate)
		if err != nil {
			return tasks, NewAPIError(400, "Invalid start date format")
		}
		_, err = time.Parse(config.DateFormat, endDate)
		if err != nil {
			return tasks, NewAPIError(400, "Invalid end date format")
		}
		query = query.Where("DATE(due_date) >= ? AND DATE(due_date) <= ?", startDate, endDate)
	} else if date != "" {
		// Validate date format
		_, err := time.Parse(config.DateFormat, date)
		if err != nil {
			return tasks, NewAPIError(400, "Invalid date format")
		}
		query = query.Where("DATE(due_date) = ?", date)
	}

	if err := query.Order("task_order").Find(&tasks).Error; err != nil {
		return nil, fmt.Errorf("getTasks: %w", err)
	}
	return tasks, nil
}

// GetInboxTitle returns the current inbox title.
func GetInboxTitle() (string, error) {
	type Setting struct {
		Value string
	}
	var setting Setting
	if err := GetDB().Model(&Setting{}).
		Select("value").
		Where("key = ?", "inbox_title").
		First(&setting).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return "📦 Inbox", nil
		}
		return "", fmt.Errorf("getInboxTitle: %w", err)
	}
	return setting.Value, nil
}

// UpdateInboxTitle updates the inbox title.
func UpdateInboxTitle(title string) error {
	type Setting struct{}
	result := GetDB().Model(&Setting{}).
		Where("key = ?", "inbox_title").
		Update("value", title)
	if result.Error != nil {
		return fmt.Errorf("updateInboxTitle: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

// CreateTask creates a new task.
func CreateTask(task Task) (Task, error) {
	if err := task.Validate(); err != nil {
		return Task{}, err
	}

	if err := GetDB().Create(&task).Error; err != nil {
		return Task{}, fmt.Errorf("createTask: %w", err)
	}
	return task, nil
}

// GetTask retrieves a task by id.
func GetTask(id int) (Task, error) {
	var task Task
	if err := GetDB().First(&task, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return Task{}, NewAPIError(404, "Task not found")
		}
		return Task{}, fmt.Errorf("getTask: %w", err)
	}
	return task, nil
}

// UpdateTask updates the fields of a task.
func UpdateTask(id int, updates map[string]interface{}) error {
	if len(updates) == 0 {
		return NewAPIError(400, "No fields to update")
	}

	// Validate fields.  Make sure this list is exhaustive!
	for key, value := range updates {
		switch key {
		case "title":
			if title, ok := value.(string); !ok || title == "" {
				return NewAPIError(400, "Invalid title")
			}
		case "description":
			if _, ok := value.(string); !ok {
				return NewAPIError(400, "Invalid description")
			}
		case "due_date":
			if value != nil {
				if _, ok := value.(string); !ok {
					return NewAPIError(400, "Invalid due date format")
				}
				dateStr := value.(string)
				if dateStr != "" {
					_, err := time.Parse(config.DateFormat, dateStr)
					if err != nil {
						return NewAPIError(400, "Invalid due date format")
					}
				}
			}
		case "completed":
			if _, ok := value.(bool); !ok && value != nil {
				if _, ok := value.(float64); !ok { // JSON numbers are float64
					return NewAPIError(400, "Invalid completed status")
				}
			}
		case "color":
			if _, ok := value.(string); !ok {
				return NewAPIError(400, "Invalid color")
			}
		case "task_order":
			if _, ok := value.(float64); !ok { // Order will be a number (float64 from JSON)
				return NewAPIError(400, "Invalid task order")
			}
		case "recurrence_rule":
			if rule, ok := value.(string); !ok || (rule != "" && rule != "daily" && rule != "weekly") {
				return NewAPIError(400, "Invalid recurrence_rule value")
			}

		default:
			return NewAPIError(400, fmt.Sprintf("Unknown field: %s", key))
		}
	}

	res := GetDB().Model(&Task{}).Where("id = ?", id).Updates(updates)
	if res.Error != nil {
		return fmt.Errorf("updateTask: %w", res.Error)
	}
	if res.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

// BulkUpdateTaskOrder updates the order for multiple tasks.
func BulkUpdateTaskOrder(tasks []Task) error {
	return GetDB().Transaction(func(tx *gorm.DB) error {
		for _, task := range tasks {
			if err := tx.Model(&Task{}).
				Where("id = ?", task.ID).
				Update("task_order", task.TaskOrder).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

// DeleteTask removes a task by id.
func DeleteTask(id int) error {
	result := GetDB().Delete(&Task{}, id)
	if result.Error != nil {
		return fmt.Errorf("deleteTask: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

// SearchTasks performs a fuzzy search for tasks using FTS5.
func SearchTasks(query string, limit int, offset int) (Tasks, error) {
	var tasks Tasks
	queryString := `
        SELECT tasks.*,
            (CASE
                WHEN tasks.title LIKE ? THEN 1
                ELSE 0
             END) AS exact_match,
            ABS(JULIANDAY('now') - JULIANDAY(tasks.due_date)) AS days_diff
        FROM tasks_fts
        JOIN tasks ON tasks_fts.rowid = tasks.id
        WHERE tasks_fts MATCH ?
        ORDER BY exact_match DESC,
                 (100.0 / (days_diff + 1)) + (rank * 0.5) DESC,
                 days_diff ASC,
                 tasks.due_date DESC
        LIMIT ? OFFSET ?`

	escapedQuery, quoted := escapeFTS5Query(query)
	var fts5MatchQuery string
	if !quoted {
		fts5MatchQuery = escapedQuery + "*"
	} else {
		fts5MatchQuery = escapedQuery
	}

	exactQuery := query + "%"

	args := []interface{}{
		exactQuery,
		fts5MatchQuery,
		limit,
		offset,
	}

	slog.Debug("Searching tasks with query", "query", query, "limit", limit, "offset", offset)

	if err := GetDB().Raw(queryString, args...).Scan(&tasks).Error; err != nil {
		return tasks, fmt.Errorf("searchTasks: %w", err)
	}
	return tasks, nil
}

// escapeFTS5Query escapes special characters in a query for use with SQLite FTS5.
func escapeFTS5Query(query string) (string, bool) {
	escaped := strings.ReplaceAll(query, `"`, `""`)
	isBareword := true
	for _, r := range escaped {
		if r < 128 {
			if !(unicode.IsLetter(r) || unicode.IsDigit(r) || r == '_') {
				isBareword = false
				break
			}
		}
	}
	if isBareword {
		return escaped, false
	}
	return `"` + escaped + `"`, true
}

// NullTime is a nullable time type.
func (nt *NullTime) MarshalJSON() ([]byte, error) {
	if !nt.Valid {
		return []byte("null"), nil
	}
	return json.Marshal(nt.Time.Format(config.DateFormat))
}

func (nt *NullTime) UnmarshalJSON(b []byte) error {
	if string(b) == "null" {
		nt.Valid = false
		return nil
	}
	var dateStr string
	if err := json.Unmarshal(b, &dateStr); err != nil {
		return err
	}
	parsedTime, err := time.Parse(config.DateFormat, dateStr)
	if err != nil {
		return err
	}
	nt.Time = parsedTime
	nt.Valid = true
	return nil
}

func (nt NullTime) Value() (driver.Value, error) {
	if !nt.Valid {
		return nil, nil
	}
	return nt.Time, nil
}

func (nt *NullTime) Scan(value interface{}) error {
	if value == nil {
		nt.Time, nt.Valid = time.Time{}, false
		return nil
	}
	t, ok := value.(time.Time)
	if !ok {
		return fmt.Errorf("unexpected type %T for NullTime", value)
	}
	nt.Time, nt.Valid = t, true
	return nil
}

// CreateNextOccurrencesForUndoneRecurringTasks creates new occurrences for undone recurring tasks.
func CreateNextOccurrencesForUndoneRecurringTasks() error {
	today := time.Now().Truncate(24 * time.Hour) // Get start of today

	return GetDB().Transaction(func(tx *gorm.DB) error {
		var tasks []Task
		// Find recurring tasks that were due before today and are NOT completed.
		result := tx.Where("recurrence_rule != '' AND due_date < ? AND completed = ?", today, 0).Find(&tasks)
		if result.Error != nil {
			return fmt.Errorf("failed to find undone recurring tasks: %w", result.Error)
		}

		slog.Debug("Found undone recurring tasks", "count", len(tasks))

		for _, task := range tasks {
			if !task.DueDate.Valid {
				slog.Warn("Recurring task without a due date found", "task_id", task.ID)
				continue // Skip tasks without a due date
			}

			nextDueDate := task.DueDate.Time // Start with original due date
			// Keep incrementing until we get a future due date
			for nextDueDate.Before(today) || nextDueDate.Equal(today) {
				switch task.RecurrenceRule {
				case "daily":
					nextDueDate = nextDueDate.AddDate(0, 0, 1)
				case "weekly":
					nextDueDate = nextDueDate.AddDate(0, 0, 7)
				default:
					slog.Warn("Unsupported recurrence rule", "rule", task.RecurrenceRule, "task_id", task.ID)
					continue // Skip unsupported rules
				}
			}

			slog.Debug("Creating new occurrence", "original_task_id", task.ID, "next_due_date", nextDueDate)

			// Create the new task occurrence
			newTask := Task{
				Title:          task.Title,
				Description:    task.Description,
				Color:          task.Color,
				RecurrenceRule: task.RecurrenceRule,
				DueDate:        NullTime{Time: nextDueDate, Valid: true},
				Completed:      0,
				TaskOrder:      0,
			}

			if err := tx.Create(&newTask).Error; err != nil {
				return fmt.Errorf("failed to create next occurrence for task ID %d: %w", task.ID, err)
			}
			slog.Info("Created next occurrence for undone recurring task", "original_task_id", task.ID, "new_task_id", newTask.ID, "new_due_date", newTask.DueDate.Time.Format(config.DateFormat))
		}
		return nil
	})
}
