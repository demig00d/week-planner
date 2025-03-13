package db

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"week-planner/internal/config"

	"gorm.io/gorm"
)

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

func GetInboxTitle() (string, error) {
	type Setting struct {
		Value string
	}
	var setting Setting
	if err := GetDB().Model(&Setting{}).Select("value").Where("key = ?", "inbox_title").First(&setting).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return "📦 Inbox", nil
		}
		return "", fmt.Errorf("getInboxTitle: %w", err)
	}
	return setting.Value, nil
}

func UpdateInboxTitle(title string) error {
	type Setting struct{}
	result := GetDB().Model(&Setting{}).Where("key = ?", "inbox_title").Update("value", title)
	if result.Error != nil {
		return fmt.Errorf("updateInboxTitle: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func CreateTask(task Task) (Task, error) {
	if err := task.Validate(); err != nil {
		return Task{}, err
	}

	if err := GetDB().Create(&task).Error; err != nil {
		return Task{}, fmt.Errorf("createTask: %w", err)
	}
	return task, nil
}

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

func UpdateTask(id int, updates map[string]interface{}) error {
	if len(updates) == 0 {
		return NewAPIError(400, "No fields to update")
	}

	// Validation remains mostly the same, but adjust for gorm if needed.
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
			if _, ok := value.(bool); !ok && value != nil { // Expect boolean from JSON for completed
				if _, ok := value.(float64); !ok { // Or allow float64 if still sending numbers
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

func BulkUpdateTaskOrder(tasks []Task) error {
	return GetDB().Transaction(func(tx *gorm.DB) error {
		for _, task := range tasks {
			if err := tx.Model(&Task{}).Where("id = ?", task.ID).Update("task_order", task.TaskOrder).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

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

func SearchTasks(query string) (Tasks, error) {
	var tasks Tasks
	queryString := fmt.Sprintf(`
        SELECT tasks.*
        FROM tasks_fts
        JOIN tasks ON tasks_fts.rowid = tasks.id
        WHERE tasks_fts MATCH ?
        ORDER BY rank
    `)

	slog.Debug("Searching tasks with query", "query", query)

	if err := GetDB().Raw(queryString, query+"*").Scan(&tasks).Error; err != nil {
		return tasks, fmt.Errorf("searchTasks: %w", err)
	}
	return tasks, nil
}

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
