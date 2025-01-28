package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"runtime"

	"week-planner/internal/config"
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

	config, err := config.NewConfig()
	if err != nil {
		log.Fatal(err)
	}

	db.InitDB()
	defer func() {
		if sqldb, err := db.GetDB().DB(); err == nil {
			sqldb.Close()
		}
	}()

	shutdownChan := make(chan bool)

	router := server.SetupRouter()

	serverAddr := fmt.Sprintf("http://%s:%d/", config.Host, config.Port)
	fmt.Printf("Server running on %s:%d\n", config.Host, config.Port)

	srv := &http.Server{
		Addr:    fmt.Sprintf(":%d", config.Port),
		Handler: router,
	}
	go func() {
		if err := srv.ListenAndServe(); err != http.ErrServerClosed {
			log.Fatalf("HTTP server ListenAndServe: %v", err)
		}
		log.Println("HTTP server stopped")
		shutdownChan <- true
	}()

	if len(os.Args) == 2 && os.Args[1] == "open" {
		go openBrowser(serverAddr)
	}

	<-shutdownChan
}
