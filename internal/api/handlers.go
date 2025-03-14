package api

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"
	"time"
	"week-planner/internal/config"
	"week-planner/internal/db"
	"week-planner/internal/jsonlog"

	"log/slog"

	"github.com/gorilla/mux"
)

// handleError handles an error by logging it and sending an appropriate HTTP response.
// If the error is an instance of *db.APIError, its WriteResponse method is used for a detailed response.
func handleError(w http.ResponseWriter, r *http.Request, err error) {
	jsonlog.LogCtx(r.Context(), slog.LevelError, err.Error(), "error", err)

	// If the error is of type APIError, use its method to respond
	apiErr, ok := err.(*db.APIError)
	if ok {
		apiErr.WriteResponse(w)
		return
	}

	// Send a standard 500 response with an error message
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusInternalServerError)
	json.NewEncoder(w).Encode(map[string]string{
		"error":   "Internal Server Error",
		"details": err.Error(),
	})
}

// taskToJSON converts the db.Task struct into a JSON-compatible map[string]interface{}.
// If DueDate is valid, it is formatted according to the specified format.
func taskToJSON(task db.Task) map[string]interface{} {
	dueDate := ""
	// If the due date is valid, format it as a string
	if task.DueDate.Valid {
		dueDate = task.DueDate.Time.Format(config.DateFormat)
	}
	return map[string]interface{}{
		"id":          task.ID,
		"title":       task.Title,
		"due_date":    dueDate,
		"completed":   task.Completed,
		"order":       task.TaskOrder,
		"color":       task.Color,
		"description": task.Description,
	}
}

// tasksToJSON converts a slice of db.Tasks into a slice of JSON-compatible maps.
func tasksToJSON(tasks db.Tasks) []map[string]interface{} {
	result := make([]map[string]interface{}, len(tasks))
	for i, task := range tasks {
		result[i] = taskToJSON(task)
	}
	return result
}

// GetTasksHandler handles HTTP requests for retrieving a list of tasks.
// It extracts date, start date, and end date parameters from the URL and returns the tasks list in JSON format.
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
	json.NewEncoder(w).Encode(tasksToJSON(tasks))
}

// GetInboxTitleHandler handles HTTP requests for retrieving the inbox title.
// It returns the title as a JSON object.
func GetInboxTitleHandler(w http.ResponseWriter, r *http.Request) {
	title, err := db.GetInboxTitle()
	if err != nil {
		handleError(w, r, err)
		return
	}
	json.NewEncoder(w).Encode(map[string]string{"inbox_title": title})
}

// UpdateInboxTitleHandler handles HTTP requests for updating the inbox title.
// It expects JSON with the new title and updates it in the database.
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

// CreateTaskHandler handles HTTP requests for creating a new task.
// It decodes the input JSON, checks for required fields, processes the due date, and creates the task in the database.
func CreateTaskHandler(w http.ResponseWriter, r *http.Request) {
	var taskInput struct {
		Title       string `json:"title"`
		DueDate     string `json:"due_date"`
		Order       int    `json:"order"`
		Color       string `json:"color"`
		Description string `json:"description"`
	}

	slog.Debug("Received request to create task")

	// Decode JSON from the request body
	err := json.NewDecoder(r.Body).Decode(&taskInput)
	if err != nil {
		slog.Debug("Error decoding request body", "error", err)
		handleError(w, r, db.NewAPIError(400, "Invalid JSON"))
		return
	}
	defer r.Body.Close()

	slog.Debug("Received task data", "task_data", taskInput)

	// Check required field title
	if taskInput.Title == "" {
		handleError(w, r, db.NewAPIError(400, "Title is required"))
		return
	}

	var dueDateNullTime db.NullTime
	// If a due date is provided, try to parse it
	if taskInput.DueDate != "" {
		parsedTime, err := time.Parse(config.DateFormat, taskInput.DueDate)
		if err != nil {
			slog.Debug("Error parsing due date", "error", err)
			handleError(w, r, db.NewAPIError(400, "Invalid date format"))
			return
		}
		dueDateNullTime = db.NullTime{Time: parsedTime, Valid: true}
	}

	// Form a task object to save
	task := db.Task{
		Title:       taskInput.Title,
		DueDate:     dueDateNullTime,
		TaskOrder:   taskInput.Order,
		Color:       taskInput.Color,
		Description: taskInput.Description,
	}

	createdTask, err := db.CreateTask(task)
	if err != nil {
		slog.Debug("Error creating task", "error", err)
		handleError(w, r, err)
		return
	}

	slog.Debug("Created task", "task", createdTask)

	// Send response with the created task
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(taskToJSON(createdTask))
}

// GetTaskHandler handles HTTP requests for retrieving a task by its ID.
// It extracts the ID from the URL, retrieves the task from the database, and returns it in JSON format.
func GetTaskHandler(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.Atoi(mux.Vars(r)["id"])
	task, err := db.GetTask(id)
	if err != nil {
		handleError(w, r, err)
		return
	}
	json.NewEncoder(w).Encode(taskToJSON(task))
}

// UpdateTaskHandler handles HTTP requests for updating task data.
// It extracts the task ID from the URL, decodes the updates from JSON, and updates the record in the database.
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
	w.WriteHeader(http.StatusOK)
}

// BulkUpdateTaskOrderHandler handles HTTP requests for bulk updating task orders.
// It decodes a list of tasks from JSON and updates their order in the database.
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

// DeleteTaskHandler handles HTTP requests for deleting a task by its ID.
// It extracts the ID from the URL, deletes the task from the database, and returns the status of the operation.
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

// SearchTasksHandler handles HTTP requests for searching tasks.
// It extracts the "query" parameter from the URL, performs a search in the database, and returns the results in JSON format.
func SearchTasksHandler(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("query")
	if query == "" {
		handleError(w, r, db.NewAPIError(400, "Query parameter required"))
		return
	}

	// Pagination parameters from query string
	pageStr := r.URL.Query().Get("page")
	pageSizeStr := r.URL.Query().Get("pageSize")

	page := 1      // Default page number
	pageSize := 10 // Default page size

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
	json.NewEncoder(w).Encode(tasksToJSON(tasks))
}

// ExportDbHandler handles the export of the SQLite database file.
func ExportDbHandler(w http.ResponseWriter, r *http.Request) {
	dbPath := "tasks.db"

	// Open the database file
	dbFile, err := os.Open(dbPath)
	if err != nil {
		handleError(w, r, fmt.Errorf("exportDbHandler: could not open db file: %w", err))
		return
	}
	defer dbFile.Close()

	// Get file info to set headers
	fileInfo, err := dbFile.Stat()
	if err != nil {
		handleError(w, r, fmt.Errorf("exportDbHandler: could not get file info: %w", err))
		return
	}

	// Set headers for file download
	w.Header().Set("Content-Disposition", "attachment; filename=tasks.db")
	w.Header().Set("Content-Type", "application/octet-stream") // Generic binary file type
	w.Header().Set("Content-Length", strconv.Itoa(int(fileInfo.Size())))

	// Serve the file content
	_, err = io.Copy(w, dbFile)
	if err != nil {
		handleError(w, r, fmt.Errorf("exportDbHandler: could not copy file to response: %w", err))
	}
}

// ImportDbHandler handles the import of a new SQLite database file.
func ImportDbHandler(w http.ResponseWriter, r *http.Request) {
	// Parse multipart form, limit uploads to 10MB
	err := r.ParseMultipartForm(10 << 20)
	if err != nil {
		handleError(w, r, db.NewAPIError(http.StatusBadRequest, fmt.Sprintf("importDbHandler: parse form failed: %v", err)))
		return
	}

	// Get the file and file header from form data
	file, header, err := r.FormFile("database")
	if err != nil {
		handleError(w, r, db.NewAPIError(http.StatusBadRequest, "importDbHandler: invalid file upload"))
		return
	}
	defer file.Close()

	// Basic file type check (can be improved with more robust validation if needed)
	contentType := header.Header.Get("Content-Type")
	if contentType != "application/octet-stream" && contentType != "application/x-sqlite3" { // Common content types for sqlite db
		slog.Warn("importDbHandler: Content-Type is not application/octet-stream or application/x-sqlite3", "content_type", contentType)
		// Proceed anyway, but log a warning. For stricter validation, return an error here.
	}

	tempDBPath := "temp_tasks.db" // Temporary file to store uploaded DB
	tempFile, err := os.OpenFile(tempDBPath, os.O_RDWR|os.O_CREATE|os.O_TRUNC, 0600)
	if err != nil {
		handleError(w, r, fmt.Errorf("importDbHandler: could not create temp file: %w", err))
		return
	}
	defer os.Remove(tempDBPath) // Clean up temp file
	defer tempFile.Close()

	// Copy uploaded file to temp file
	_, err = io.Copy(tempFile, file)
	if err != nil {
		handleError(w, r, fmt.Errorf("importDbHandler: could not copy uploaded file to temp file: %w", err))
		return
	}

	// Basic validation: Try to open the uploaded DB to see if it's a valid SQLite file
	_, err = db.OpenTestDB(tempDBPath) // Using a test open function to avoid replacing the main DB directly yet
	if err != nil {
		handleError(w, r, db.NewAPIError(http.StatusBadRequest, "importDbHandler: invalid database file or corrupted database"))
		return
	}

	// Replace the current database with the new one
	oldDBPath := "tasks.db"
	newDBPath := "tasks.db.new" // Temporary name during replacement

	// Rename current DB to .old (backup)
	err = os.Rename(oldDBPath, newDBPath)
	if err != nil {
		handleError(w, r, fmt.Errorf("importDbHandler: could not rename current db for backup: %w", err))
		return
	}
	defer os.Remove(newDBPath) // Cleanup backup if rename fails later on

	// Rename uploaded DB (temp file) to the actual DB path
	err = os.Rename(tempDBPath, oldDBPath)
	if err != nil {
		// Try to restore from backup if rename fails
		os.Rename(newDBPath, oldDBPath) // Attempt restore
		handleError(w, r, fmt.Errorf("importDbHandler: could not rename temp db to main db: %w, database potentially corrupted, backup restored", err))
		return
	}

	// Re-initialize the database connection - important to use the new DB
	db.InitDB() // Re-initialize the DB connection

	w.WriteHeader(http.StatusOK)                      // Respond with success
	w.Write([]byte("Database imported successfully")) // Optional success message in body
}
