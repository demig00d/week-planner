package api

import (
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"strconv"
	"time"
	"week-planner/internal/config"
	"week-planner/internal/db"
	"week-planner/internal/jsonlog"

	"github.com/gorilla/mux"
)

// handleError handles errors, logging them and sending HTTP responses.
func handleError(w http.ResponseWriter, r *http.Request, err error) {
	jsonlog.LogCtx(r.Context(), slog.LevelError, err.Error(), "error", err)

	apiErr, ok := err.(*db.APIError)
	if ok {
		apiErr.WriteResponse(w)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusInternalServerError)
	json.NewEncoder(w).Encode(map[string]string{
		"error":   "Internal Server Error",
		"details": err.Error(),
	})
}

// taskToJSON converts db.Task to JSON.
func taskToJSON(task db.Task) map[string]interface{} {
	dueDate := ""
	if task.DueDate.Valid {
		dueDate = task.DueDate.Time.Format(config.DateFormat)
	}
	return map[string]interface{}{
		"id":              task.ID,
		"title":           task.Title,
		"due_date":        dueDate,
		"completed":       task.Completed,
		"order":           task.TaskOrder,
		"color":           task.Color,
		"description":     task.Description,
		"recurrence_rule": task.RecurrenceRule,
	}
}

// tasksToJSON converts []db.Tasks to JSON.
func tasksToJSON(tasks db.Tasks) []map[string]interface{} {
	result := make([]map[string]interface{}, len(tasks))
	for i, task := range tasks {
		result[i] = taskToJSON(task)
	}
	return result
}

// GetTasksHandler retrieves a list of tasks.
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

// GetInboxTitleHandler retrieves the inbox title.
func GetInboxTitleHandler(w http.ResponseWriter, r *http.Request) {
	title, err := db.GetInboxTitle()
	if err != nil {
		handleError(w, r, err)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"inbox_title": title})
}

// UpdateInboxTitleHandler updates the inbox title.
func UpdateInboxTitleHandler(w http.ResponseWriter, r *http.Request) {
	var data map[string]string
	if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
		handleError(w, r, db.NewAPIError(400, "Invalid request"))
		return
	}
	if err := db.UpdateInboxTitle(data["inbox_title"]); err != nil {
		handleError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusOK)
}

// CreateTaskHandler creates a new task.
func CreateTaskHandler(w http.ResponseWriter, r *http.Request) {
	var taskInput struct {
		Title          string `json:"title"`
		DueDate        string `json:"due_date"`
		Order          int    `json:"order"`
		Color          string `json:"color"`
		Description    string `json:"description"`
		RecurrenceRule string `json:"recurrence_rule"`
	}

	slog.Debug("Received request to create task")

	err := json.NewDecoder(r.Body).Decode(&taskInput)
	if err != nil {
		slog.Debug("Error decoding request body", "error", err)
		handleError(w, r, db.NewAPIError(400, "Invalid JSON"))
		return
	}
	defer r.Body.Close()

	slog.Debug("Received task data", "task_data", taskInput)

	if taskInput.Title == "" {
		handleError(w, r, db.NewAPIError(400, "Title is required"))
		return
	}

	var dueDateNullTime db.NullTime
	if taskInput.DueDate != "" {
		parsedTime, err := time.Parse(config.DateFormat, taskInput.DueDate)
		if err != nil {
			slog.Debug("Error parsing due date", "error", err)
			handleError(w, r, db.NewAPIError(400, "Invalid date format"))
			return
		}
		dueDateNullTime = db.NullTime{Time: parsedTime, Valid: true}
	}

	task := db.Task{
		Title:          taskInput.Title,
		DueDate:        dueDateNullTime,
		TaskOrder:      taskInput.Order,
		Color:          taskInput.Color,
		Description:    taskInput.Description,
		RecurrenceRule: taskInput.RecurrenceRule,
	}

	createdTask, err := db.CreateTask(task)
	if err != nil {
		slog.Debug("Error creating task", "error", err)
		handleError(w, r, err)
		return
	}

	slog.Debug("Created task", "task", createdTask)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(taskToJSON(createdTask))
}

// GetTaskHandler retrieves a task by its ID.
func GetTaskHandler(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.Atoi(mux.Vars(r)["id"])
	task, err := db.GetTask(id)
	if err != nil {
		handleError(w, r, err)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(taskToJSON(task))
}

// UpdateTaskHandler handles updating task data.
func UpdateTaskHandler(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.Atoi(mux.Vars(r)["id"])
	var updates map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&updates); err != nil {
		handleError(w, r, db.NewAPIError(400, "Invalid request"))
		return
	}

	slog.Debug("Updates received in updateTaskHandler", "task_id", id, "updates", updates)

	if err := db.UpdateTask(id, updates); err != nil {
		handleError(w, r, err)
		return
	}

	if completedVal, ok := updates["completed"]; ok {
		slog.Debug("Completed update received", "task_id", id, "completed", completedVal)

		if completed, isBool := completedVal.(bool); isBool && completed { // Handle boolean
			slog.Debug("Task marked as completed (bool)", "task_id", id)
			task, err := db.GetTask(id)
			if err != nil {
				handleError(w, r, err)
				return
			}
			slog.Debug("Task retrieved", "task", task)
			if task.RecurrenceRule != "" {
				slog.Debug("Task is recurring. Calling createNextRecurringTask", "task_id", id)
				if err := createNextRecurringTask(task); err != nil {
					handleError(w, r, fmt.Errorf("error creating next recurring task: %w", err))
					return
				}
			} else {
				slog.Debug("Task is NOT recurring", "task_id", id)
			}
		} else if completedFloat, isFloat := completedVal.(float64); isFloat && completedFloat == 1 { // Handle float64
			slog.Debug("Task marked as completed (float64)", "task_id", id)
			task, err := db.GetTask(id)
			if err != nil {
				handleError(w, r, err)
				return
			}
			slog.Debug("Task retrieved", "task", task)
			if task.RecurrenceRule != "" {
				slog.Debug("Task is recurring. Calling createNextRecurringTask", "task_id", id)
				if err := createNextRecurringTask(task); err != nil {
					handleError(w, r, fmt.Errorf("error creating next recurring task: %w", err))
					return
				}
			} else {
				slog.Debug("Task is NOT recurring", "task_id", id)
			}

		} else {
			slog.Debug("Completed value is not boolean or 1", "task_id", id, "completed", completedVal)
		}
	} else {
		slog.Debug("No completed update received", "task_id", id)
	}

	w.WriteHeader(http.StatusOK)
}

func createNextRecurringTask(task db.Task) error {
	if !task.DueDate.Valid {
		return fmt.Errorf("recurring task without a due date cannot be processed")
	}

	nextDueDate := task.DueDate.Time
	switch task.RecurrenceRule {
	case "daily":
		nextDueDate = nextDueDate.AddDate(0, 0, 1)
	case "weekly":
		nextDueDate = nextDueDate.AddDate(0, 0, 7)
	default:
		return fmt.Errorf("unsupported recurrence rule: %s", task.RecurrenceRule)
	}

	newTask := db.Task{
		Title:          task.Title,
		Description:    task.Description,
		Color:          task.Color,
		RecurrenceRule: task.RecurrenceRule,
		DueDate:        db.NullTime{Time: nextDueDate, Valid: true},
		Completed:      0,
		TaskOrder:      0,
	}

	slog.Debug("Creating newTask in createNextRecurringTask",
		"newTask", newTask,
		"newDueDateFormatted", newTask.DueDate.Time.Format(config.DateFormat), // <---- ADDED LOG
	)

	createdTask, err := db.CreateTask(newTask)
	if err != nil {
		return fmt.Errorf("failed to create next task instance: %w", err)
	}
	slog.Debug("Successfully created newTask in createNextRecurringTask", "createdTask", createdTask)
	slog.Info("Created next recurring task", "task_id", newTask.ID, "title", newTask.Title, "due_date", newTask.DueDate.Time.Format(config.DateFormat), "rule", newTask.RecurrenceRule)
	return nil
}

// BulkUpdateTaskOrderHandler handles bulk updating task orders.
func BulkUpdateTaskOrderHandler(w http.ResponseWriter, r *http.Request) {
	var tasks db.Tasks
	if err := json.NewDecoder(r.Body).Decode(&tasks); err != nil {
		handleError(w, r, db.NewAPIError(400, "Invalid request"))
		return
	}
	if err := db.BulkUpdateTaskOrder(tasks); err != nil {
		handleError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusOK)
}

// DeleteTaskHandler deletes a task by its ID.
func DeleteTaskHandler(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil {
		handleError(w, r, db.NewAPIError(400, "Invalid task ID"))
		return
	}

	slog.Debug("Deleting task", "task_id", id)

	if err := db.DeleteTask(id); err != nil {
		handleError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusOK)
}

// SearchTasksHandler handles searching tasks.
func SearchTasksHandler(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("query")
	if query == "" {
		handleError(w, r, db.NewAPIError(400, "Query parameter required"))
		return
	}

	pageStr := r.URL.Query().Get("page")
	pageSizeStr := r.URL.Query().Get("pageSize")

	page := 1
	pageSize := 10

	if pageSizeStr != "" {
		ps, err := strconv.Atoi(pageSizeStr)
		if err != nil || ps <= 0 {
			handleError(w, r, db.NewAPIError(400, "Invalid pageSize parameter"))
			return
		}
		pageSize = ps
	}

	if pageStr != "" {
		p, err := strconv.Atoi(pageStr)
		if err != nil || p <= 0 {
			handleError(w, r, db.NewAPIError(400, "Invalid page parameter"))
			return
		}
		page = p
	}

	offset := (page - 1) * pageSize

	tasks, err := db.SearchTasks(query, pageSize, offset)
	if err != nil {
		handleError(w, r, err)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(tasksToJSON(tasks))
}

// ExportDbHandler exports the SQLite database file.
func ExportDbHandler(w http.ResponseWriter, r *http.Request) {
	dbPath := "tasks.db"

	dbFile, err := os.Open(dbPath)
	if err != nil {
		handleError(w, r, fmt.Errorf("exportDbHandler: could not open db file: %w", err))
		return
	}
	defer dbFile.Close()

	fileInfo, err := dbFile.Stat()
	if err != nil {
		handleError(w, r, fmt.Errorf("exportDbHandler: could not get file info: %w", err))
		return
	}

	w.Header().Set("Content-Disposition", "attachment; filename=tasks.db")
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Content-Length", strconv.Itoa(int(fileInfo.Size())))

	_, err = io.Copy(w, dbFile)
	if err != nil {
		handleError(w, r, fmt.Errorf("exportDbHandler: could not copy file to response: %w", err))
	}
}

// ImportDbHandler handles importing a new SQLite database file.
func ImportDbHandler(w http.ResponseWriter, r *http.Request) {
	err := r.ParseMultipartForm(10 << 20)
	if err != nil {
		handleError(w, r, db.NewAPIError(http.StatusBadRequest, fmt.Sprintf("importDbHandler: parse form failed: %v", err)))
		return
	}

	file, header, err := r.FormFile("database")
	if err != nil {
		handleError(w, r, db.NewAPIError(http.StatusBadRequest, "importDbHandler: invalid file upload"))
		return
	}
	defer file.Close()

	contentType := header.Header.Get("Content-Type")
	if contentType != "application/octet-stream" && contentType != "application/x-sqlite3" {
		slog.Warn("importDbHandler: Content-Type is not application/octet-stream or application/x-sqlite3", "content_type", contentType)
	}

	tempDBPath := "temp_tasks.db"
	tempFile, err := os.OpenFile(tempDBPath, os.O_RDWR|os.O_CREATE|os.O_TRUNC, 0600)
	if err != nil {
		handleError(w, r, fmt.Errorf("importDbHandler: could not create temp file: %w", err))
		return
	}
	defer os.Remove(tempDBPath)
	defer tempFile.Close()

	_, err = io.Copy(tempFile, file)
	if err != nil {
		handleError(w, r, fmt.Errorf("importDbHandler: could not copy uploaded file to temp file: %w", err))
		return
	}

	_, err = db.OpenTestDB(tempDBPath)
	if err != nil {
		handleError(w, r, db.NewAPIError(http.StatusBadRequest, "importDbHandler: invalid database file or corrupted database"))
		return
	}

	oldDBPath := "tasks.db"
	newDBPath := "tasks.db.new"

	err = os.Rename(oldDBPath, newDBPath)
	if err != nil {
		handleError(w, r, fmt.Errorf("importDbHandler: could not rename current db for backup: %w", err))
		return
	}
	defer os.Remove(newDBPath)

	err = os.Rename(tempDBPath, oldDBPath)
	if err != nil {
		os.Rename(newDBPath, oldDBPath)
		handleError(w, r, fmt.Errorf("importDbHandler: could not rename temp db to main db: %w, database potentially corrupted, backup restored", err))
		return
	}

	db.InitDB()

	w.WriteHeader(http.StatusOK)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Database imported successfully"})
}

// CheckRecurringTasksHandler creates new recurring task occurrences.
func CheckRecurringTasksHandler(w http.ResponseWriter, r *http.Request) {
	if err := db.CreateNextOccurrencesForUndoneRecurringTasks(); err != nil {
		handleError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusOK)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Recurring tasks checked and updated."})
}
