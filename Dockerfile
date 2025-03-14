# Build Stage
FROM golang:1.24 AS builder

# Set the working directory
WORKDIR /app

# Cache dependencies
COPY go.mod go.sum ./
RUN go mod download

# Copy the rest of the source code
COPY . .

# Build the binary with build tags and output to /app/app
RUN go build -tags="!sqlite_fts5 sqlite_fts5" -o /app/app ./cmd/week_planner/main.go

# Final Stage
FROM alpine:latest

WORKDIR /app

# Copy the compiled binary from the builder image
COPY --from=builder /app/app .

# Expose port 5000
EXPOSE 5000

# Run the application
CMD ["./app"]
