package api

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"time"
	"week-planner/internal/config"
	"week-planner/internal/db"

	"github.com/gorilla/mux"
)

func handleError(w http.ResponseWriter, err error) {
	log.Printf("Error: %v", err)

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

func taskToJSON(task db.Task) map[string]interface{} {
	dueDate := ""
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

func tasksToJSON(tasks db.Tasks) []map[string]interface{} {
	result := make([]map[string]interface{}, len(tasks))
	for i, task := range tasks {
		result[i] = taskToJSON(task)
	}
	return result
}

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

func GetInboxTitleHandler(w http.ResponseWriter, r *http.Request) {
	title, err := db.GetInboxTitle()
	if err != nil {
		handleError(w, err)
		return
	}
	json.NewEncoder(w).Encode(map[string]string{"inbox_title": title})
}

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

func CreateTaskHandler(w http.ResponseWriter, r *http.Request) {
	var taskInput struct {
		Title       string `json:"title"`
		DueDate     string `json:"due_date"`
		Order       int    `json:"order"`
		Color       string `json:"color"`
		Description string `json:"description"`
	}

	log.Println("Received request to create task")

	err := json.NewDecoder(r.Body).Decode(&taskInput)
	if err != nil {
		log.Printf("Error decoding request body: %v", err)
		handleError(w, db.NewAPIError(400, "Invalid JSON"))
		return
	}
	defer r.Body.Close()

	log.Printf("Received task data: %+v", taskInput)

	if taskInput.Title == "" {
		handleError(w, db.NewAPIError(400, "Title is required"))
		return
	}

	var dueDateNullTime db.NullTime
	if taskInput.DueDate != "" {
		parsedTime, err := time.Parse(config.DateFormat, taskInput.DueDate)
		if err != nil {
			log.Printf("Error parsing due date: %v", err)
			handleError(w, db.NewAPIError(400, "Invalid date format"))
			return
		}
		dueDateNullTime = db.NullTime{Time: parsedTime, Valid: true}
	}

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

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(taskToJSON(createdTask))
}

func GetTaskHandler(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.Atoi(mux.Vars(r)["id"])
	task, err := db.GetTask(id)
	if err != nil {
		handleError(w, err)
		return
	}
	json.NewEncoder(w).Encode(taskToJSON(task))
}

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

func DeleteTaskHandler(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.Atoi(mux.Vars(r)["id"])
	if err := db.DeleteTask(id); err != nil {
		handleError(w, err)
		return
	}
	w.WriteHeader(http.StatusOK)
}

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
