package server

import (
	"embed"
	"github.com/gorilla/mux"
	"io/fs"
	"log"
	"net/http"
	"time"
	"week-planner/internal/api"
)

//go:embed static/*
var staticFS embed.FS

func SetupRouter(dateChangeChan chan bool) *mux.Router {
	router := mux.NewRouter()

	// Logging Middleware
	router.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			startTime := time.Now()

			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS, PUT, DELETE")
			w.Header().Set("Access-Control-Allow-Headers", "Accept, Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization")

			if r.Method == "OPTIONS" {
				return
			}

			log.Printf("Incoming Request: Method=%s, URL=%s, Timestamp=%s", r.Method, r.URL.Path, startTime.Format(time.RFC3339))

			next.ServeHTTP(w, r)
		})
	})

	router.HandleFunc("/api/tasks", api.GetTasksHandler).Methods("GET", "OPTIONS")
	router.HandleFunc("/api/inbox_title", api.GetInboxTitleHandler).Methods("GET", "OPTIONS")
	router.HandleFunc("/api/inbox_title", api.UpdateInboxTitleHandler).Methods("PUT", "OPTIONS")
	router.HandleFunc("/api/tasks", api.CreateTaskHandler).Methods("POST", "OPTIONS")
	router.HandleFunc("/api/tasks/{id}", api.GetTaskHandler).Methods("GET", "OPTIONS")
	router.HandleFunc("/api/tasks/{id}", api.UpdateTaskHandler).Methods("PUT", "OPTIONS")
	router.HandleFunc("/api/tasks/bulk_update_order", api.BulkUpdateTaskOrderHandler).Methods("POST", "OPTIONS")
	router.HandleFunc("/api/tasks/{id}", api.DeleteTaskHandler).Methods("DELETE", "OPTIONS")
	router.HandleFunc("/api/search_tasks", api.SearchTasksHandler).Methods("GET", "OPTIONS")

	// SSE Endpoint - Pass dateChangeChan
	router.HandleFunc("/api/events", api.DateChangeEventsHandler(dateChangeChan)).Methods("GET")

	fsys, err := fs.Sub(staticFS, "static")
	if err != nil {
		panic(err)
	}

	router.PathPrefix("/").Handler(http.FileServer(http.FS(fsys)))

	return router
}
