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

// GetTasks retrieves tasks based on filters (date, date range, or inbox).
func GetTasks(date string, startDate string, endDate string) (Tasks, error) {
	var tasks Tasks
	query := GetDB().Model(&Task{})

	if date == "inbox" {
		query = query.Where("due_date IS NULL")
	} else if startDate != "" && endDate != "" {
		// Validate date formats
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

	// If no specific filters match, it will fetch all tasks (useful for search).

	if err := query.Order("task_order").Find(&tasks).Error; err != nil {
		return nil, fmt.Errorf("getTasks: %w", err)
	}
	return tasks, nil
}

// GetInboxTitle returns the current inbox title from settings.
func GetInboxTitle() (string, error) {
	type Setting struct {
		Value string
	}
	var setting Setting
	// Use FirstOrCreate to handle the case where the setting doesn't exist yet.
	result := GetDB().Model(&Setting{}).
		Where("key = ?", "inbox_title").
		FirstOrCreate(&setting, Setting{Value: "📦 Inbox"}) // Provide default value.

	if result.Error != nil {
		return "", fmt.Errorf("getInboxTitle: %w", result.Error)
	}
	return setting.Value, nil
}

// UpdateInboxTitle updates the inbox title setting.
func UpdateInboxTitle(title string) error {
	type Setting struct {
		Key   string `gorm:"primaryKey"`
		Value string
	}
	// Use Updates which handles existing records.
	result := GetDB().Model(&Setting{}).
		Where("key = ?", "inbox_title").
		Update("value", title)
	if result.Error != nil {
		return fmt.Errorf("updateInboxTitle: %w", result.Error)
	}
	// Check if any row was affected, if not, it means the key didn't exist.
	if result.RowsAffected == 0 {
		// If no rows affected, it means the key didn't exist, so create it.
		createResult := GetDB().Create(&Setting{Key: "inbox_title", Value: title})
		if createResult.Error != nil {
			return fmt.Errorf("updateInboxTitle: failed to create setting: %w", createResult.Error)
		}
	}
	return nil
}

// CreateTask inserts a new task into the database.
func CreateTask(task Task) (Task, error) {
	if err := task.Validate(); err != nil {
		return Task{}, err
	}

	if err := GetDB().Create(&task).Error; err != nil {
		return Task{}, fmt.Errorf("createTask: %w", err)
	}
	return task, nil
}

// GetTask retrieves a single task by its ID.
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

// UpdateTask modifies fields of an existing task.
func UpdateTask(id int, updates map[string]interface{}) error {
	if len(updates) == 0 {
		return NewAPIError(400, "No fields to update")
	}

	// Validate fields before attempting update.
	for key, value := range updates {
		switch key {
		case "title":
			if title, ok := value.(string); !ok || title == "" {
				return NewAPIError(400, "Invalid title")
			}
		case "description":
			// Allow any string, including empty, or nil to clear.
			if _, ok := value.(string); !ok && value != nil {
				return NewAPIError(400, "Invalid description format (must be string or null)")
			}
		case "due_date":
			if value != nil {
				dateStr, ok := value.(string)
				if !ok {
					return NewAPIError(400, "Invalid due date format (not a string or null)")
				}
				// Allow empty string to clear the date.
				if dateStr != "" {
					_, err := time.Parse(config.DateFormat, dateStr)
					if err != nil {
						return NewAPIError(400, fmt.Sprintf("Invalid due date format: %s", err.Error()))
					}
				}
			} // Allow nil to clear the date.
		case "completed":
			// Allow boolean or float64 (from JSON number 0 or 1).
			if _, ok := value.(bool); !ok {
				if floatVal, ok := value.(float64); !ok || (floatVal != 0 && floatVal != 1) {
					return NewAPIError(400, "Invalid completed status (must be boolean, 0, or 1)")
				}
			}
		case "color":
			// Allow string or potentially nil/empty string to clear.
			if _, ok := value.(string); !ok && value != nil {
				return NewAPIError(400, "Invalid color format (must be string or null)")
			}
		case "task_order":
			// Order will be a number (float64 from JSON or int internally).
			if _, ok := value.(float64); !ok {
				if _, okInt := value.(int); !okInt {
					return NewAPIError(400, "Invalid task order format (must be a number)")
				}
			}
		case "recurrence_rule":
			rule, ok := value.(string)
			if !ok {
				return NewAPIError(400, "Invalid recurrence_rule format (must be string)")
			}
			// Allow empty string or specific valid rules.
			isValidRule := rule == "" || rule == "daily" || rule == "weekly" || rule == "monthly" || rule == "yearly"
			if !isValidRule {
				return NewAPIError(400, fmt.Sprintf("Invalid recurrence_rule value: %s", rule))
			}
		case "recurrence_interval":
			// Interval should be a number (float64 from JSON or int internally) and >= 1.
			valid := false
			if intervalFloat, ok := value.(float64); ok && intervalFloat >= 1 {
				valid = true
			} else if intervalInt, okInt := value.(int); okInt && intervalInt >= 1 {
				valid = true
			}
			if !valid {
				return NewAPIError(400, "Invalid recurrence_interval (must be a number >= 1)")
			}
		default:
			return NewAPIError(400, fmt.Sprintf("Unknown field for update: %s", key))
		}
	}

	// Perform the update.
	res := GetDB().Model(&Task{}).Where("id = ?", id).Updates(updates)
	if res.Error != nil {
		return fmt.Errorf("updateTask: %w", res.Error)
	}
	if res.RowsAffected == 0 {
		// Check if the task actually exists to differentiate not found from no change.
		var count int64
		GetDB().Model(&Task{}).Where("id = ?", id).Count(&count)
		if count == 0 {
			return NewAPIError(404, "Task not found for update")
		}
		// If task exists but no rows affected, it means the update didn't change anything.
		slog.Debug("Update task called but no changes detected", "task_id", id, "updates", updates)
	}
	return nil
}

// BulkUpdateTaskOrder updates the 'task_order' field for multiple tasks in a transaction.
func BulkUpdateTaskOrder(tasks []Task) error {
	if len(tasks) == 0 {
		return nil // Nothing to do.
	}
	return GetDB().Transaction(func(tx *gorm.DB) error {
		for _, task := range tasks {
			// Update only the task_order field.
			if err := tx.Model(&Task{}).
				Where("id = ?", task.ID).
				Update("task_order", task.TaskOrder).Error; err != nil {
				// Return the error to rollback the transaction.
				return fmt.Errorf("failed to update order for task %d: %w", task.ID, err)
			}
		}
		// If all updates succeed, commit the transaction.
		return nil
	})
}

// DeleteTask removes a task by its ID.
func DeleteTask(id int) error {
	result := GetDB().Delete(&Task{}, id)
	if result.Error != nil {
		return fmt.Errorf("deleteTask: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		// Task might have already been deleted.
		return NewAPIError(404, "Task not found for deletion")
	}
	return nil
}

// SearchTasks performs a fuzzy search using FTS5 with pagination and ranking.
func SearchTasks(query string, limit int, offset int) (Tasks, error) {
	var tasks Tasks

	// FTS5 query requires escaping special characters and potentially quoting.
	escapedQuery, quoted := escapeFTS5Query(query)
	var fts5MatchQuery string
	if !quoted {
		// Use prefix search for unquoted terms.
		fts5MatchQuery = escapedQuery + "*"
	} else {
		// Use exact phrase search for quoted terms.
		fts5MatchQuery = escapedQuery
	}

	// Query for exact title match for boosting.
	exactQuery := query + "%"

	// Build the raw SQL query with ranking logic.
	// Rank higher: exact title matches, tasks closer to today's date, FTS rank.
	queryString := `
        WITH RankedTasks AS (
            SELECT
                tasks.id,
                tasks.title,
                tasks.due_date,
                tasks.completed,
                tasks.task_order,
                tasks.color,
                tasks.description,
                tasks.recurrence_rule,
                tasks.recurrence_interval, -- Include interval
                rank -- FTS rank
            FROM tasks_fts
            JOIN tasks ON tasks_fts.rowid = tasks.id
            WHERE tasks_fts MATCH ?
        )
        SELECT
            rt.*,
            (CASE WHEN rt.title LIKE ? THEN 1 ELSE 0 END) AS exact_match_boost,
            ABS(JULIANDAY('now') - JULIANDAY(rt.due_date)) AS date_proximity -- Lower is better
        FROM RankedTasks rt
        ORDER BY
            exact_match_boost DESC, -- Prioritize exact title matches
            -- Prioritize tasks closer to today, giving higher score to smaller difference.
            -- Avoid division by zero for tasks due today (date_proximity = 0).
            (CASE WHEN date_proximity < 1 THEN 1000 ELSE 100.0 / (date_proximity + 1) END) DESC,
            rank DESC, -- Use FTS rank as a tie-breaker
            rt.due_date DESC -- Further tie-breaker by due date
        LIMIT ? OFFSET ?`

	// Arguments for the prepared statement.
	args := []interface{}{
		fts5MatchQuery,
		exactQuery,
		limit,
		offset,
	}

	slog.Debug("Searching tasks with FTS query", "fts_query", fts5MatchQuery, "exact_query", exactQuery, "limit", limit, "offset", offset)

	// Execute the raw query.
	if err := GetDB().Raw(queryString, args...).Scan(&tasks).Error; err != nil {
		// Check for specific SQLite errors like FTS5 syntax error if needed.
		return nil, fmt.Errorf("searchTasks raw query failed: %w", err)
	}

	return tasks, nil
}

// escapeFTS5Query escapes special characters for SQLite FTS5 MATCH queries.
// Returns the escaped string and a boolean indicating if quoting was necessary.
func escapeFTS5Query(query string) (string, bool) {
	// Replace double quotes with two double quotes for FTS5.
	escaped := strings.ReplaceAll(query, `"`, `""`)

	// Determine if the query needs quoting (contains non-alphanumeric chars other than _).
	needsQuoting := false
	for _, r := range escaped {
		// Allow ASCII letters, digits, and underscore in barewords.
		isAllowedBarewordChar := (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '_'
		// Also check for Unicode letters/digits if necessary, though FTS5 might tokenize differently.
		// Note: FTS5 tokenizers might handle Unicode differently. This is a basic check.
		isAllowedUnicode := unicode.IsLetter(r) || unicode.IsDigit(r)

		// If a character is not allowed in a bareword, it needs quoting.
		// This includes spaces, punctuation (except _), etc.
		if !(isAllowedBarewordChar || isAllowedUnicode) {
			needsQuoting = true
			break
		}
	}

	if needsQuoting {
		return `"` + escaped + `"`, true
	}
	// Return the (potentially quote-escaped) string as a bareword.
	return escaped, false
}

// CalculateNextDueDate calculates the next due date based on the current date,
// recurrence rule, and interval. Returns the calculated date and an error if
// the rule is invalid or unsupported.
func CalculateNextDueDate(currentDate time.Time, rule string, interval int) (time.Time, error) {
	if interval <= 0 {
		// Use a default interval of 1 if an invalid one is provided.
		slog.Warn("CalculateNextDueDate received invalid interval, defaulting to 1", "rule", rule, "interval", interval)
		interval = 1
	}

	nextDueDate := currentDate
	switch rule {
	case "daily":
		nextDueDate = nextDueDate.AddDate(0, 0, 1*interval)
	case "weekly":
		nextDueDate = nextDueDate.AddDate(0, 0, 7*interval)
	case "monthly":
		nextDueDate = nextDueDate.AddDate(0, 1*interval, 0) // Add N months. Handles month rollovers.
	case "yearly":
		nextDueDate = nextDueDate.AddDate(1*interval, 0, 0) // Add N years. Handles leap years correctly.
	case "":
		// Cannot calculate the *next* date for a non-recurring task.
		return time.Time{}, fmt.Errorf("cannot calculate next due date for an empty recurrence rule")
	default:
		return time.Time{}, fmt.Errorf("unsupported recurrence rule: %s", rule)
	}
	// Consider if the time part should be zeroed out (e.g., nextDueDate = nextDueDate.Truncate(24 * time.Hour))
	// This depends on whether recurrence should preserve the time of day. For simplicity, we don't truncate here.
	return nextDueDate, nil
}

// CreateNextOccurrencesForUndoneRecurringTasks finds recurring tasks due before today
// that are not completed, calculates their next due date *on or after* today,
// and creates new task instances for those future dates.
func CreateNextOccurrencesForUndoneRecurringTasks() error {
	today := time.Now().Truncate(24 * time.Hour) // Get start of today (00:00:00 UTC or local based on server).

	return GetDB().Transaction(func(tx *gorm.DB) error {
		var tasks []Task
		// Find recurring tasks that were due *before* today and are NOT completed.
		// DATE() function works well with SQLite for date comparisons.
		result := tx.Where("recurrence_rule != '' AND DATE(due_date) < DATE(?) AND completed = ?", today, 0).Find(&tasks)
		if result.Error != nil {
			return fmt.Errorf("failed to find undone recurring tasks: %w", result.Error)
		}

		slog.Debug("Found undone recurring tasks due before today", "count", len(tasks))

		for _, task := range tasks {
			if !task.DueDate.Valid {
				slog.Warn("Recurring task without a valid due date found", "task_id", task.ID)
				continue // Skip tasks without a valid due date.
			}
			if task.RecurrenceRule == "" {
				slog.Warn("Task found with empty recurrence rule despite query filter", "task_id", task.ID)
				continue // Should not happen based on query, but good practice to check.
			}

			currentDueDate := task.DueDate.Time
			var nextDueDate time.Time
			var err error

			// Calculate the first occurrence date that is *on or after* today.
			// Start calculation from the original due date of the found (past-due) task.
			calculatedDate := currentDueDate
			iterationCount := 0   // Safety counter
			maxIterations := 1000 // Prevent potential infinite loops

			for (calculatedDate.Before(today) || calculatedDate.Equal(today)) && iterationCount < maxIterations {
				calculatedDate, err = CalculateNextDueDate(calculatedDate, task.RecurrenceRule, task.RecurrenceInterval)
				if err != nil {
					slog.Error("Error calculating next due date for undone task", "task_id", task.ID, "rule", task.RecurrenceRule, "interval", task.RecurrenceInterval, "error", err)
					break // Stop processing this specific task if rule is bad or calculation fails.
				}
				// Safety check: ensure calculation progresses.
				if calculatedDate.Before(currentDueDate) || calculatedDate.Equal(currentDueDate) {
					slog.Error("Recurrence calculation did not advance date, potential loop", "task_id", task.ID, "rule", task.RecurrenceRule, "interval", task.RecurrenceInterval)
					err = fmt.Errorf("recurrence calculation did not advance date")
					break
				}
				iterationCount++
			}

			if err != nil { // If the loop broke because of an error.
				continue // Move to the next task in the outer loop.
			}
			if iterationCount >= maxIterations {
				slog.Error("Exceeded max iterations calculating next due date, potential infinite loop", "task_id", task.ID, "rule", task.RecurrenceRule, "interval", task.RecurrenceInterval)
				continue // Skip this task
			}

			// 'calculatedDate' now holds the first date that is on or after today.
			nextDueDate = calculatedDate

			slog.Debug("Calculated next occurrence date", "original_task_id", task.ID, "original_due_date", currentDueDate.Format(config.DateFormat), "next_due_date", nextDueDate.Format(config.DateFormat))

			// Create the new task occurrence for the calculated future date.
			newTask := Task{
				Title:              task.Title,
				Description:        task.Description, // Copy relevant fields.
				Color:              task.Color,
				RecurrenceRule:     task.RecurrenceRule,     // Keep the recurrence rule.
				RecurrenceInterval: task.RecurrenceInterval, // Keep the interval.
				DueDate:            NullTime{Time: nextDueDate, Valid: true},
				Completed:          0, // New occurrence is not completed.
				TaskOrder:          0, // Reset order, or implement specific logic if needed.
			}

			if err := tx.Create(&newTask).Error; err != nil {
				// Log error but continue processing other tasks; transaction handles rollback on failure.
				slog.Error("Failed to create next occurrence", "original_task_id", task.ID, "error", err)
				// To stop the whole process on first failure, uncomment the next line:
				// return fmt.Errorf("failed to create next occurrence for task ID %d: %w", task.ID, err)
			} else {
				slog.Info("Created next occurrence for undone recurring task", "original_task_id", task.ID, "new_task_id", newTask.ID, "new_due_date", newTask.DueDate.Time.Format(config.DateFormat))
			}
		}
		return nil // Commit transaction if loop completes without returning an error.
	})
}

// --- NullTime Implementation ---

// MarshalJSON implements the json.Marshaler interface for NullTime.
func (nt *NullTime) MarshalJSON() ([]byte, error) {
	if !nt.Valid {
		return []byte("null"), nil
	}
	// Ensure we marshal only the date part in the specified format.
	return json.Marshal(nt.Time.Format(config.DateFormat))
}

// UnmarshalJSON implements the json.Unmarshaler interface for NullTime.
func (nt *NullTime) UnmarshalJSON(b []byte) error {
	// Check for JSON null.
	if string(b) == "null" {
		nt.Valid = false
		return nil
	}
	// Unmarshal as a string.
	var dateStr string
	if err := json.Unmarshal(b, &dateStr); err != nil {
		return fmt.Errorf("NullTime should be a string or null, got %s: %w", string(b), err)
	}
	// Allow empty string to represent null/invalid.
	if dateStr == "" {
		nt.Valid = false
		return nil
	}
	// Parse the date string.
	parsedTime, err := time.Parse(config.DateFormat, dateStr)
	if err != nil {
		return fmt.Errorf("invalid date format for NullTime (%s): %w", dateStr, err)
	}
	nt.Time = parsedTime
	nt.Valid = true
	return nil
}

// Value implements the driver.Valuer interface for database serialization.
func (nt NullTime) Value() (driver.Value, error) {
	if !nt.Valid {
		return nil, nil
	}
	// Return the time value.
	return nt.Time, nil
}

// Scan implements the sql.Scanner interface for database deserialization.
func (nt *NullTime) Scan(value interface{}) error {
	if value == nil {
		nt.Time, nt.Valid = time.Time{}, false
		return nil
	}
	// GORM uses time.Time for SQLite DATE type.
	t, ok := value.(time.Time)
	if !ok {
		// Fallback: attempt to parse from string if it's stored differently.
		strVal, okStr := value.(string)
		if okStr {
			// Try parsing common formats. Use config.DateFormat first.
			parsedTime, err := time.Parse(config.DateFormat, strVal)
			if err == nil {
				nt.Time, nt.Valid = parsedTime, true
				return nil
			}
			// Try RFC3339 or other formats if needed.
			parsedTime, err = time.Parse(time.RFC3339, strVal) // Example fallback
			if err == nil {
				nt.Time, nt.Valid = parsedTime, true
				return nil
			}
		}
		return fmt.Errorf("unexpected type %T for NullTime Scan", value)
	}
	nt.Time, nt.Valid = t, true
	return nil
}
