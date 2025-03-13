package jsonlog

import (
	"context"
	"log/slog"
	"os"
)

var logger *slog.Logger

func InitLogger(level slog.Level) {
	// Create a new JSON handler that writes to standard output,
	// using the provided log level.
	handler := slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: level,
	})

	// Create a new logger instance with the JSON handler.
	logger = slog.New(handler)

	// Set this logger as the default for the `slog` package.
	slog.SetDefault(logger)
}

// LogCtx logs a message with the given level and context.
// It uses a variadic parameter 'args' for key-value pairs.
func LogCtx(ctx context.Context, level slog.Level, msg string, args ...any) {
	// Check if the logger is initialized.
	if logger == nil {
		panic("jsonlog: logger not initialized") // Critical error: programmer mistake
	}

	// Log the message with the provided context, level, and arguments.
	logger.Log(ctx, level, msg, args...)
}
