// File: internal/api/handlers.go
package api

import (
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"
	"week-planner/internal/config"
	"week-planner/internal/db"
	"week-planner/internal/jsonlog"

	"github.com/gorilla/mux"
)

// handleError logs errors and sends appropriate HTTP responses.
func handleError(w http.ResponseWriter, r *http.Request, err error) {
	jsonlog.LogCtx(r.Context(), slog.LevelError, err.Error(), "error", err)

	// Check if it's a structured APIError.
	apiErr, ok := err.(*db.APIError)
	if ok {
		apiErr.WriteResponse(w)
		return
	}

	// Generic internal server error for other types of errors.
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusInternalServerError)
	json.NewEncoder(w).Encode(map[string]string{
		"error":   "Internal Server Error",
		"details": err.Error(), // Include original error in details (maybe only in debug mode).
	})
}

// taskToJSON converts a db.Task struct to a JSON-serializable map.
func taskToJSON(task db.Task) map[string]interface{} {
	dueDate := ""
	if task.DueDate.Valid {
		dueDate = task.DueDate.Time.Format(config.DateFormat)
	}
	return map[string]interface{}{
		"id":                  task.ID,
		"title":               task.Title,
		"due_date":            dueDate,
		"completed":           task.Completed,
		"order":               task.TaskOrder,
		"color":               task.Color,
		"description":         task.Description,
		"recurrence_rule":     task.RecurrenceRule,
		"recurrence_interval": task.RecurrenceInterval, // Include interval.
	}
}

// tasksToJSON converts a slice of db.Task structs to a slice of JSON maps.
func tasksToJSON(tasks db.Tasks) []map[string]interface{} {
	result := make([]map[string]interface{}, len(tasks))
	for i, task := range tasks {
		result[i] = taskToJSON(task)
	}
	return result
}

// GetTasksHandler handles requests to retrieve tasks based on query parameters.
func GetTasksHandler(w http.ResponseWriter, r *http.Request) {
	tasks, err := db.GetTasks(
		r.URL.Query().Get("date"),
		r.URL.Query().Get("start_date"),
		r.URL.Query().Get("end_date"),
	)
	if err != nil {
		handleError(w, r, err)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(tasksToJSON(tasks))
}

// GetInboxTitleHandler retrieves the current inbox title setting.
func GetInboxTitleHandler(w http.ResponseWriter, r *http.Request) {
	title, err := db.GetInboxTitle()
	if err != nil {
		handleError(w, r, err)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"inbox_title": title})
}

// UpdateInboxTitleHandler updates the inbox title setting.
func UpdateInboxTitleHandler(w http.ResponseWriter, r *http.Request) {
	var data map[string]string
	if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
		handleError(w, r, db.NewAPIError(400, "Invalid request body format"))
		return
	}
	defer r.Body.Close()

	newTitle, ok := data["inbox_title"]
	if !ok {
		handleError(w, r, db.NewAPIError(400, "Missing 'inbox_title' in request"))
		return
	}

	if err := db.UpdateInboxTitle(newTitle); err != nil {
		handleError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusOK)
}

// CreateTaskHandler handles requests to create a new task.
func CreateTaskHandler(w http.ResponseWriter, r *http.Request) {
	// Define expected input structure.
	var taskInput struct {
		Title              string `json:"title"`
		DueDate            string `json:"due_date"` // Expect date as string YYYY-MM-DD.
		Order              int    `json:"order"`
		Color              string `json:"color"`
		Description        string `json:"description"`
		RecurrenceRule     string `json:"recurrence_rule"`
		RecurrenceInterval int    `json:"recurrence_interval"`
	}

	slog.DebugContext(r.Context(), "Received request to create task")

	err := json.NewDecoder(r.Body).Decode(&taskInput)
	if err != nil {
		slog.DebugContext(r.Context(), "Error decoding request body", "error", err)
		handleError(w, r, db.NewAPIError(400, "Invalid JSON format"))
		return
	}
	defer r.Body.Close()

	slog.DebugContext(r.Context(), "Received task data", "task_data", taskInput)

	if taskInput.Title == "" {
		handleError(w, r, db.NewAPIError(400, "Task title is required"))
		return
	}

	// Parse DueDate string into NullTime.
	var dueDateNullTime db.NullTime
	if taskInput.DueDate != "" {
		parsedTime, err := time.Parse(config.DateFormat, taskInput.DueDate)
		if err != nil {
			slog.DebugContext(r.Context(), "Error parsing due date", "error", err, "due_date", taskInput.DueDate)
			handleError(w, r, db.NewAPIError(400, "Invalid date format (expected YYYY-MM-DD)"))
			return
		}
		dueDateNullTime = db.NullTime{Time: parsedTime, Valid: true}
	}

	// Set default interval if not provided or invalid.
	recurrenceInterval := taskInput.RecurrenceInterval
	if taskInput.RecurrenceRule != "" && recurrenceInterval <= 0 {
		slog.DebugContext(r.Context(), "Invalid or missing recurrence interval for recurring task, defaulting to 1", "provided_interval", taskInput.RecurrenceInterval)
		recurrenceInterval = 1
	} else if taskInput.RecurrenceRule == "" {
		recurrenceInterval = 1 // Reset to default if rule is cleared.
	}

	// Prepare Task struct for database insertion.
	task := db.Task{
		Title:              taskInput.Title,
		DueDate:            dueDateNullTime,
		TaskOrder:          taskInput.Order,
		Color:              taskInput.Color,
		Description:        taskInput.Description,
		RecurrenceRule:     taskInput.RecurrenceRule,
		RecurrenceInterval: recurrenceInterval,
		// Completed defaults to 0 in the database.
	}

	createdTask, err := db.CreateTask(task)
	if err != nil {
		slog.ErrorContext(r.Context(), "Error creating task in database", "error", err)
		handleError(w, r, err) // Let handleError decide the response code.
		return
	}

	slog.DebugContext(r.Context(), "Successfully created task", "task", createdTask)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(taskToJSON(createdTask)) // Return the created task data.
}

// GetTaskHandler retrieves a specific task by its ID.
func GetTaskHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	idStr, ok := vars["id"]
	if !ok {
		handleError(w, r, db.NewAPIError(400, "Missing task ID in URL path"))
		return
	}
	id, err := strconv.Atoi(idStr)
	if err != nil {
		handleError(w, r, db.NewAPIError(400, "Invalid task ID format"))
		return
	}

	task, err := db.GetTask(id)
	if err != nil {
		handleError(w, r, err) // Handles 404 Not Found from db layer.
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(taskToJSON(task))
}

// UpdateTaskHandler handles partial updates to an existing task.
func UpdateTaskHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	idStr, ok := vars["id"]
	if !ok {
		handleError(w, r, db.NewAPIError(400, "Missing task ID in URL path"))
		return
	}
	id, err := strconv.Atoi(idStr)
	if err != nil {
		handleError(w, r, db.NewAPIError(400, "Invalid task ID format"))
		return
	}

	var updates map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&updates); err != nil {
		handleError(w, r, db.NewAPIError(400, "Invalid request body format"))
		return
	}
	defer r.Body.Close()

	slog.DebugContext(r.Context(), "Received updates for task", "task_id", id, "updates", updates)

	// Validate fields before attempting update. (Validation moved to db.UpdateTask)

	// Perform the update via the database layer (which includes validation).
	if err := db.UpdateTask(id, updates); err != nil {
		handleError(w, r, err) // Handles validation errors and not found.
		return
	}

	// --- Recurrence Handling on Completion ---
	// Check if the 'completed' field was part of the update and set to true/1.
	if completedVal, ok := updates["completed"]; ok {
		isCompleted := false
		if completedBool, isBool := completedVal.(bool); isBool && completedBool {
			isCompleted = true
		} else if completedFloat, isFloat := completedVal.(float64); isFloat && completedFloat == 1 {
			isCompleted = true
		}

		if isCompleted {
			slog.DebugContext(r.Context(), "Task marked as completed, checking for recurrence", "task_id", id)
			// Fetch the task *after* the update to get its current state (including recurrence rule).
			task, err := db.GetTask(id)
			if err != nil {
				// Log error but don't fail the entire update request just because recurrence failed.
				slog.ErrorContext(r.Context(), "Failed to fetch task after update for recurrence check", "task_id", id, "error", err)
			} else if task.RecurrenceRule != "" {
				slog.DebugContext(r.Context(), "Task is recurring, creating next instance", "task_id", id, "rule", task.RecurrenceRule, "interval", task.RecurrenceInterval)
				// Create the next recurring task instance.
				if err := createNextRecurringTask(task); err != nil {
					// Log error, but don't necessarily fail the original update response.
					slog.ErrorContext(r.Context(), "Error creating next recurring task instance", "task_id", id, "error", err)
					// Optionally, could return a specific error or warning to the client here.
					// handleError(w, r, fmt.Errorf("task updated, but failed to create next recurring instance: %w", err))
					// return
				}
			} else {
				slog.DebugContext(r.Context(), "Completed task is not recurring", "task_id", id)
			}
		}
	} else {
		slog.DebugContext(r.Context(), "Update did not include 'completed' field or was not set to true/1", "task_id", id)
	}

	// If all successful, return OK status.
	w.WriteHeader(http.StatusOK)
}

// createNextRecurringTask creates the next instance of a completed recurring task.
func createNextRecurringTask(task db.Task) error {
	// Pre-conditions: Task must have a valid due date and a recurrence rule.
	if !task.DueDate.Valid {
		return fmt.Errorf("cannot create next instance for recurring task ID %d without a due date", task.ID)
	}
	if task.RecurrenceRule == "" {
		// This case should ideally not be reached if called correctly after checking RecurrenceRule.
		slog.Warn("createNextRecurringTask called for non-recurring task", "task_id", task.ID)
		return nil // Not an error, just nothing to do.
	}

	// Calculate the next due date using the database helper function.
	nextDueDate, err := db.CalculateNextDueDate(task.DueDate.Time, task.RecurrenceRule, task.RecurrenceInterval)
	if err != nil {
		return fmt.Errorf("error calculating next due date for task %d: %w", task.ID, err)
	}

	// Create the new task struct for the next occurrence.
	newTask := db.Task{
		Title:              task.Title,                                  // Copy title.
		Description:        task.Description,                            // Copy description.
		Color:              task.Color,                                  // Copy color.
		RecurrenceRule:     task.RecurrenceRule,                         // Keep the rule.
		RecurrenceInterval: task.RecurrenceInterval,                     // Keep the interval.
		DueDate:            db.NullTime{Time: nextDueDate, Valid: true}, // Set calculated next date.
		Completed:          0,                                           // New instance is not completed.
		TaskOrder:          0,                                           // Reset order (or implement specific logic).
	}

	slog.Debug("Preparing to create next recurring task instance",
		"original_task_id", task.ID,
		"new_task_details", newTask,
		"new_due_date_formatted", newTask.DueDate.Time.Format(config.DateFormat),
	)

	// Create the new task in the database.
	createdTask, err := db.CreateTask(newTask)
	if err != nil {
		return fmt.Errorf("failed to create next recurring task instance in db: %w", err)
	}
	slog.Info("Successfully created next recurring task instance", "original_task_id", task.ID, "new_task_id", createdTask.ID, "new_due_date", createdTask.DueDate.Time.Format(config.DateFormat), "rule", createdTask.RecurrenceRule, "interval", createdTask.RecurrenceInterval)
	return nil
}

// BulkUpdateTaskOrderHandler updates the order for multiple tasks in one request.
func BulkUpdateTaskOrderHandler(w http.ResponseWriter, r *http.Request) {
	var tasks db.Tasks // Expect a slice of tasks, likely just with ID and Order.
	if err := json.NewDecoder(r.Body).Decode(&tasks); err != nil {
		handleError(w, r, db.NewAPIError(400, "Invalid request body format for bulk update"))
		return
	}
	defer r.Body.Close()

	if err := db.BulkUpdateTaskOrder(tasks); err != nil {
		handleError(w, r, err) // Handles potential transaction errors.
		return
	}
	w.WriteHeader(http.StatusOK)
}

// DeleteTaskHandler handles requests to delete a task by its ID.
func DeleteTaskHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	idStr, ok := vars["id"]
	if !ok {
		handleError(w, r, db.NewAPIError(400, "Missing task ID in URL path"))
		return
	}
	id, err := strconv.Atoi(idStr)
	if err != nil {
		handleError(w, r, db.NewAPIError(400, "Invalid task ID format"))
		return
	}

	slog.DebugContext(r.Context(), "Attempting to delete task", "task_id", id)

	if err := db.DeleteTask(id); err != nil {
		handleError(w, r, err) // Handles 404 Not Found from db layer.
		return
	}
	slog.InfoContext(r.Context(), "Successfully deleted task", "task_id", id)
	w.WriteHeader(http.StatusOK)
}

// SearchTasksHandler performs fuzzy task search with pagination.
func SearchTasksHandler(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("query")
	if query == "" {
		handleError(w, r, db.NewAPIError(400, "Query parameter ('query') is required for search"))
		return
	}

	// Pagination parameters with defaults.
	page := 1
	pageSize := 10 // Default page size.

	if psStr := r.URL.Query().Get("pageSize"); psStr != "" {
		ps, err := strconv.Atoi(psStr)
		if err != nil || ps <= 0 || ps > 100 { // Add upper limit for safety.
			handleError(w, r, db.NewAPIError(400, "Invalid 'pageSize' parameter (must be > 0 and <= 100)"))
			return
		}
		pageSize = ps
	}

	if pStr := r.URL.Query().Get("page"); pStr != "" {
		p, err := strconv.Atoi(pStr)
		if err != nil || p <= 0 {
			handleError(w, r, db.NewAPIError(400, "Invalid 'page' parameter (must be > 0)"))
			return
		}
		page = p
	}

	// Calculate offset for database query.
	offset := (page - 1) * pageSize

	tasks, err := db.SearchTasks(query, pageSize, offset)
	if err != nil {
		handleError(w, r, err) // Handles potential database errors during search.
		return
	}

	// Return search results.
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(tasksToJSON(tasks))
}

// ExportDbHandler allows downloading the current SQLite database file.
func ExportDbHandler(w http.ResponseWriter, r *http.Request) {
	dbPath := "tasks.db" // Path to the database file.

	dbFile, err := os.Open(dbPath)
	if err != nil {
		if os.IsNotExist(err) {
			handleError(w, r, db.NewAPIError(http.StatusNotFound, "Database file not found"))
		} else {
			handleError(w, r, fmt.Errorf("exportDbHandler: could not open db file: %w", err))
		}
		return
	}
	defer dbFile.Close()

	fileInfo, err := dbFile.Stat()
	if err != nil {
		handleError(w, r, fmt.Errorf("exportDbHandler: could not get file info: %w", err))
		return
	}

	// Set headers for file download.
	w.Header().Set("Content-Disposition", "attachment; filename=tasks.db")   // Suggest filename.
	w.Header().Set("Content-Type", "application/octet-stream")               // Generic binary stream type.
	w.Header().Set("Content-Length", strconv.FormatInt(fileInfo.Size(), 10)) // Set file size.

	// Copy file content to response body.
	_, err = io.Copy(w, dbFile)
	if err != nil {
		// Log error, response might be partially written.
		slog.ErrorContext(r.Context(), "Error copying database file to response", "error", err)
		// Avoid calling handleError here as headers might be sent.
	}
}

// ImportDbHandler handles uploading and replacing the SQLite database file.
func ImportDbHandler(w http.ResponseWriter, r *http.Request) {
	// Limit upload size (e.g., 10 MB).
	err := r.ParseMultipartForm(10 << 20)
	if err != nil {
		handleError(w, r, db.NewAPIError(http.StatusBadRequest, fmt.Sprintf("Error parsing multipart form: %v. Max size 10MB.", err)))
		return
	}

	// Get the file from the form data. "database" is the expected field name.
	file, header, err := r.FormFile("database")
	if err != nil {
		handleError(w, r, db.NewAPIError(http.StatusBadRequest, "Invalid file upload request. Ensure 'database' field is present."))
		return
	}
	defer file.Close()

	// Basic validation of the uploaded file (optional but recommended).
	contentType := header.Header.Get("Content-Type")
	// Allow common SQLite MIME types, but don't strictly enforce.
	if contentType != "application/octet-stream" && contentType != "application/x-sqlite3" && contentType != "application/vnd.sqlite3" {
		slog.WarnContext(r.Context(), "Import: Unexpected Content-Type, proceeding anyway.", "content_type", contentType)
		// Consider adding more robust validation if needed (e.g., check file magic number).
	}
	if !strings.HasSuffix(strings.ToLower(header.Filename), ".db") {
		slog.WarnContext(r.Context(), "Import: Uploaded file does not have .db extension, proceeding anyway.", "filename", header.Filename)
	}

	// Create a temporary file to write the uploaded content safely.
	tempDBPath := "temp_tasks_import.db"
	tempFile, err := os.OpenFile(tempDBPath, os.O_RDWR|os.O_CREATE|os.O_TRUNC, 0600)
	if err != nil {
		handleError(w, r, fmt.Errorf("importDbHandler: could not create temp file '%s': %w", tempDBPath, err))
		return
	}
	// Ensure temp file is closed and removed even on errors.
	defer tempFile.Close()
	defer os.Remove(tempDBPath)

	// Copy uploaded file content to the temporary file.
	_, err = io.Copy(tempFile, file)
	if err != nil {
		handleError(w, r, fmt.Errorf("importDbHandler: could not copy uploaded file to temp file: %w", err))
		return
	}
	// Close immediately after copy to ensure data is flushed before validation.
	tempFile.Close()

	// Validate the temporary database file before replacing the current one.
	// OpenTestDB attempts to open and potentially migrate, which acts as validation.
	testDB, err := db.OpenTestDB(tempDBPath)
	if err != nil {
		handleError(w, r, db.NewAPIError(http.StatusBadRequest, fmt.Sprintf("Import failed: Uploaded file is not a valid database or is corrupted: %v", err)))
		return
	}
	// Close the test connection.
	if sqlTestDB, sqlErr := testDB.DB(); sqlErr == nil {
		sqlTestDB.Close()
	}

	// 1. Close the current active database connection safely.
	currentDB := db.GetDB() // Get the global *gorm.DB instance
	if sqlDB, dbErr := currentDB.DB(); dbErr == nil {
		slog.InfoContext(r.Context(), "Closing current database connection for import...")
		if closeErr := sqlDB.Close(); closeErr != nil {
			// Log error but proceed with caution, file might still be locked.
			slog.ErrorContext(r.Context(), "Error closing current database connection", "error", closeErr)
		}
	} else {
		slog.ErrorContext(r.Context(), "Could not get underlying sql.DB for closing", "error", dbErr)
		// Proceed, but file operations might fail.
	}

	// 2. Define file paths.
	currentDBPath := "tasks.db"
	backupDBPath := "tasks.db.bak" // Backup path.

	// 3. Rename current DB to backup path (overwrite existing backup if present).
	slog.InfoContext(r.Context(), "Backing up current database...", "from", currentDBPath, "to", backupDBPath)
	if err = os.Rename(currentDBPath, backupDBPath); err != nil {
		// If the current DB doesn't exist (e.g., first run), that's okay.
		if !os.IsNotExist(err) {
			// For other errors (e.g., permissions), fail the import.
			handleError(w, r, fmt.Errorf("importDbHandler: could not backup current database: %w", err))
			// Attempt to reopen original connection if possible (best effort)
			db.InitDB()
			return
		}
		slog.InfoContext(r.Context(), "Current database file not found, skipping backup.", "path", currentDBPath)
	}

	// 4. Rename temp DB (validated) to the main DB path.
	slog.InfoContext(r.Context(), "Replacing database with imported file...", "from", tempDBPath, "to", currentDBPath)
	err = os.Rename(tempDBPath, currentDBPath)
	if err != nil {
		// Attempt to restore backup if the final rename fails.
		slog.ErrorContext(r.Context(), "Failed to rename temporary DB to main DB path, attempting to restore backup.", "error", err)
		if restoreErr := os.Rename(backupDBPath, currentDBPath); restoreErr != nil {
			// Catastrophic failure: Could not restore backup. State is uncertain.
			slog.ErrorContext(r.Context(), "CRITICAL: Failed to restore database backup after import failure.", "backup_path", backupDBPath, "restore_error", restoreErr)
			handleError(w, r, fmt.Errorf("import failed: could not replace database file, AND failed to restore backup: %w", err))
		} else {
			// Backup restored successfully.
			slog.InfoContext(r.Context(), "Successfully restored database backup.")
			handleError(w, r, fmt.Errorf("import failed: could not replace database file, backup restored: %w", err))
		}
		// Reinitialize with the restored (or potentially original failed-to-backup) DB.
		db.InitDB()
		return
	}

	// 5. Reinitialize the database connection with the newly imported file.
	slog.InfoContext(r.Context(), "Reinitializing database connection with imported file...")
	db.InitDB() // This will open the new tasks.db file.

	// 6. Remove the backup file after successful import and reinitialization.
	if err = os.Remove(backupDBPath); err != nil && !os.IsNotExist(err) {
		// Log error if backup deletion fails, but don't fail the overall request.
		slog.WarnContext(r.Context(), "Failed to remove database backup file after successful import", "backup_path", backupDBPath, "error", err)
	}

	slog.InfoContext(r.Context(), "Database imported successfully.")
	w.WriteHeader(http.StatusOK)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Database imported successfully"})
}

// CheckRecurringTasksHandler triggers the process to create future occurrences
// for any past-due, uncompleted recurring tasks.
func CheckRecurringTasksHandler(w http.ResponseWriter, r *http.Request) {
	slog.InfoContext(r.Context(), "Checking for undone recurring tasks...")
	if err := db.CreateNextOccurrencesForUndoneRecurringTasks(); err != nil {
		handleError(w, r, err) // Pass db layer errors up.
		return
	}
	slog.InfoContext(r.Context(), "Recurring tasks check completed.")
	w.WriteHeader(http.StatusOK)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Recurring tasks checked and updated."})
}
