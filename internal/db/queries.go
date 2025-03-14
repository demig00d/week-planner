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

	// Validate fields
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
				if _, ok := value.(float64); !ok {
					return NewAPIError(400, "Invalid completed status")
				}
			}
		case "color":
			if _, ok := value.(string); !ok {
				return NewAPIError(400, "Invalid color")
			}
		case "task_order":
			if _, ok := value.(float64); !ok {
				return NewAPIError(400, "Invalid task order")
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
// It constructs a query that uses a LIKE pattern for exact matches
// and an FTS5 MATCH expression for fuzzy searching.
// The escapeFTS5Query function is used to properly escape and/or quote the user input.
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

	// Escape special characters for the FTS5 query.
	escapedQuery, quoted := escapeFTS5Query(query)
	var fts5MatchQuery string
	if !quoted {
		// If the query is a bareword, append the prefix wildcard.
		fts5MatchQuery = escapedQuery + "*"
	} else {
		// If the query was quoted, use it literally.
		fts5MatchQuery = escapedQuery
	}

	// For the LIKE clause, simply use the original query with a trailing '%'.
	exactQuery := query + "%"

	args := []interface{}{
		exactQuery,
		fts5MatchQuery,
		limit, offset,
	}

	slog.Debug("Searching tasks with query", "query", query, "limit", limit, "offset", offset)

	if err := GetDB().Raw(queryString, args...).Scan(&tasks).Error; err != nil {
		return tasks, fmt.Errorf("searchTasks: %w", err)
	}
	return tasks, nil
}

// escapeFTS5Query escapes special characters in a query for use with SQLite FTS5.
// It doubles embedded double quotes and, for ASCII characters, allows only letters,
// digits, and underscore. If any disallowed ASCII character is found, the function
// wraps the entire query in double quotes and returns a flag indicating it was quoted.
// Non-ASCII characters are allowed as bareword characters.
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
		// Non-ASCII characters are allowed.
	}
	if isBareword {
		return escaped, false
	}
	return `"` + escaped + `"`, true
}

// NullTime is a nullable time type used for JSON marshalling/unmarshalling.
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
