# Build Stage
FROM golang:1.24 AS builder

WORKDIR /app

# Enable CGO since SQLite access requires it
ENV CGO_ENABLED=1

# Install SQLite development libraries and build tools in the builder stage.
RUN apt-get update && apt-get install -y \
    libsqlite3-dev \
    build-essential \
  && rm -rf /var/lib/apt/lists/*

# Copy go.mod and go.sum first for caching
COPY go.mod go.sum ./
RUN go mod download

# Copy the rest of the source code.
COPY . .

# Build the executable
RUN go build -tags="!sqlite_fts5 sqlite_fts5" -o /app/app ./cmd/week_planner/main.go

# Final Stage
# Use Debian to get a recent glibc version.
FROM debian:bookworm-slim

WORKDIR /app

# Install the SQLite runtime library
RUN apt-get update && apt-get install -y libsqlite3-0 && rm -rf /var/lib/apt/lists/*

# Copy the compiled binary from the builder stage
COPY --from=builder /app/app .

# Ensure the binary is executable
RUN chmod +x /app/app

EXPOSE 5000

# Start your application
CMD ["./app"]
