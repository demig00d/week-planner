package main

import (
	"context"
	"fmt"
	"log"
	"log/slog"
	"net/http"
	"os"
	"os/exec"
	"runtime"
	"time"

	"week-planner/internal/config"
	"week-planner/internal/db"
	"week-planner/internal/jsonlog"
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
		slog.Error("Error opening browser", "error", err)
	}
}

func main() {
	cfg, err := config.NewConfig()
	if err != nil {
		log.Fatal(err)
	}

	jsonlog.InitLogger(cfg.GetLogLevel())

	db.InitDB()
	defer func() {
		if sqldb, err := db.GetDB().DB(); err == nil {
			sqldb.Close()
		}
	}()

	shutdownChan := make(chan bool)

	router := server.SetupRouter()

	serverAddr := fmt.Sprintf("http://%s:%d/", cfg.Host, cfg.Port)
	slog.Info(fmt.Sprintf("Server running on %s:%d", cfg.Host, cfg.Port))

	srv := &http.Server{
		Addr:    fmt.Sprintf(":%d", cfg.Port),
		Handler: router,
	}
	go func() {
		if err := srv.ListenAndServe(); err != http.ErrServerClosed {
			slog.Error("HTTP server ListenAndServe", "error", err)
		}
		slog.Info("HTTP server stopped")
		shutdownChan <- true
	}()

	skipOpen := false
	for _, arg := range os.Args {
		if arg == "skip-open" {
			skipOpen = true
			break
		}
	}

	if !skipOpen && len(os.Args) >= 2 && os.Args[1] == "open" {
		go openBrowser(serverAddr)
	}

	<-shutdownChan
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		slog.Error("Server Shutdown Failed", "error", err)
	}
}
