package api

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"time"
	"week-planner/internal/config"
	"week-planner/internal/db"

	"github.com/gorilla/mux"
)

// handleError handles an error by logging it and sending an appropriate HTTP response.
// If the error is an instance of *db.APIError, its WriteResponse method is used for a detailed response.
func handleError(w http.ResponseWriter, err error) {
	log.Printf("Error: %v", err)

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
		handleError(w, err)
		return
	}
	json.NewEncoder(w).Encode(tasksToJSON(tasks))
}

// GetInboxTitleHandler handles HTTP requests for retrieving the inbox title.
// It returns the title as a JSON object.
func GetInboxTitleHandler(w http.ResponseWriter, r *http.Request) {
	title, err := db.GetInboxTitle()
	if err != nil {
		handleError(w, err)
		return
	}
	json.NewEncoder(w).Encode(map[string]string{"inbox_title": title})
}

// UpdateInboxTitleHandler handles HTTP requests for updating the inbox title.
// It expects JSON with the new title and updates it in the database.
func UpdateInboxTitleHandler(w http.ResponseWriter, r *http.Request) {
	var data map[string]string
	if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
		handleError(w, db.NewAPIError(400, "Invalid request"))
		return
	}
	if err := db.UpdateInboxTitle(data["inbox_title"]); err != nil {
		handleError(w, err)
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

	log.Println("Received request to create task")

	// Decode JSON from the request body
	err := json.NewDecoder(r.Body).Decode(&taskInput)
	if err != nil {
		log.Printf("Error decoding request body: %v", err)
		handleError(w, db.NewAPIError(400, "Invalid JSON"))
		return
	}
	defer r.Body.Close()

	log.Printf("Received task data: %+v", taskInput)

	// Check required field title
	if taskInput.Title == "" {
		handleError(w, db.NewAPIError(400, "Title is required"))
		return
	}

	var dueDateNullTime db.NullTime
	// If a due date is provided, try to parse it
	if taskInput.DueDate != "" {
		parsedTime, err := time.Parse(config.DateFormat, taskInput.DueDate)
		if err != nil {
			log.Printf("Error parsing due date: %v", err)
			handleError(w, db.NewAPIError(400, "Invalid date format"))
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
		log.Printf("Error creating task: %v", err)
		handleError(w, err)
		return
	}

	log.Printf("Created task: %+v", createdTask)

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
		handleError(w, err)
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
		handleError(w, db.NewAPIError(400, "Invalid request"))
		return
	}

	log.Printf("Updates received in updateTaskHandler: %+v", updates)

	if err := db.UpdateTask(id, updates); err != nil {
		handleError(w, err)
		return
	}
	w.WriteHeader(http.StatusOK)
}

// BulkUpdateTaskOrderHandler handles HTTP requests for bulk updating task orders.
// It decodes a list of tasks from JSON and updates their order in the database.
func BulkUpdateTaskOrderHandler(w http.ResponseWriter, r *http.Request) {
	var tasks db.Tasks
	if err := json.NewDecoder(r.Body).Decode(&tasks); err != nil {
		handleError(w, db.NewAPIError(400, "Invalid request"))
		return
	}
	if err := db.BulkUpdateTaskOrder(tasks); err != nil {
		handleError(w, err)
		return
	}
	w.WriteHeader(http.StatusOK)
}

// DeleteTaskHandler handles HTTP requests for deleting a task by its ID.
// It extracts the ID from the URL, deletes the task from the database, and returns the status of the operation.
func DeleteTaskHandler(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.Atoi(mux.Vars(r)["id"])
	if err := db.DeleteTask(id); err != nil {
		handleError(w, err)
		return
	}
	w.WriteHeader(http.StatusOK)
}

// SearchTasksHandler handles HTTP requests for searching tasks.
// It extracts the "query" parameter from the URL, performs a search in the database, and returns the results in JSON format.
func SearchTasksHandler(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("query")
	if query == "" {
		handleError(w, db.NewAPIError(400, "Query parameter required"))
		return
	}

	tasks, err := db.SearchTasks(query)
	if err != nil {
		handleError(w, err)
		return
	}
	json.NewEncoder(w).Encode(tasksToJSON(tasks))
}

// DateChangeEventsHandler returns an HTTP handler for server-sent events (SSE),
// which sends notifications to clients when the date changes.
// When a client connects, the necessary headers for SSE are set, and the dateChangeChan channel is monitored.
func DateChangeEventsHandler(dateChangeChan chan bool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {

		// Set headers for SSE
		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")
		w.Header().Set("Access-Control-Allow-Origin", "*")

		// Check if ResponseWriter supports the Flusher interface for streaming
		flusher, ok := w.(http.Flusher)
		if !ok {
			http.Error(w, "Streaming unsupported!", http.StatusInternalServerError)
			return
		}

		// Create a channel for the client to receive events
		clientChan := make(chan string)
		go func() {
			for msg := range clientChan {
				// Send message to the client
				fmt.Fprintf(w, "data: %s\n\n", msg)
				flusher.Flush() // Ensure the data is sent immediately
			}
		}()

		log.Println("SSE client connected")

		// Listen for date change events or client disconnection
		for {
			select {
			case <-dateChangeChan:
				// Notify the client about a date change event
				clientChan <- "date-change"
			case <-r.Context().Done():
				// Handle client disconnection
				log.Println("SSE client disconnected")
				close(clientChan)
				return
			}
		}
	}
}
