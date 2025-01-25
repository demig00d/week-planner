package main

import (
	"fmt"
	"log"
	"net/http"
	"os/exec"
	"runtime"

	"week-planner/internal/db"
	"week-planner/internal/server"
)

func openBrowser(url string) {
	var err error
	switch runtime.GOOS {
	case "linux":
		err = exec.Command("xdg-open", url).Start()
	case "windows":
		err = exec.Command("cmd", "/c", "start", url).Start()
	case "darwin":
		err = exec.Command("open", url).Start()
	default:
		err = fmt.Errorf("unsupported platform")
	}
	if err != nil {
		log.Println("Error opening browser:", err)
	}
}

func main() {
	db.InitDB()
	defer func() {
		if sqldb, err := db.GetDB().DB(); err == nil {
			sqldb.Close()
		}
	}()

	shutdownChan := make(chan bool)

	router := server.SetupRouter()

	serverAddr := "http://localhost:5000/"
	fmt.Println("Server running on :5000")

	srv := &http.Server{
		Addr:    ":5000",
		Handler: router,
	}
	go func() {
		if err := srv.ListenAndServe(); err != http.ErrServerClosed {
			log.Fatalf("HTTP server ListenAndServe: %v", err)
		}
		log.Println("HTTP server stopped")
		shutdownChan <- true
	}()

	go openBrowser(serverAddr)

	<-shutdownChan
}
