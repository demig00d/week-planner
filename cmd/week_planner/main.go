package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"runtime"
	"sync"
	"time"

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
	cfg, err := config.NewConfig()
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
	dateChangeChan := make(chan bool)
	var lastCheckDay string
	var mu sync.Mutex

	go func() {
		ticker := time.NewTicker(1 * time.Minute)
		defer ticker.Stop()

		for range ticker.C {
			now := time.Now()
			today := now.Format(config.DateFormat)

			mu.Lock()
			if today != lastCheckDay {
				log.Println("Date changed, sending date-change event")
				lastCheckDay = today
				dateChangeChan <- true
			}
			mu.Unlock()
		}
	}()

	router := server.SetupRouter(dateChangeChan)

	serverAddr := fmt.Sprintf("http://%s:%d/", cfg.Host, cfg.Port)
	fmt.Printf("Server running on %s:%d\n", cfg.Host, cfg.Port)

	srv := &http.Server{
		Addr:    fmt.Sprintf(":%d", cfg.Port),
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
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("Server Shutdown Failed:%+v", err)
	}
}
