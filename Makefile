APP_NAME = week_planner
BUILD_DIR = build
GO_BUILD_TAGS = sqlite_fts5

PLATFORMS = \
    linux-amd64 \
    linux-arm64 \
    windows-amd64 \
    windows-386 \
    darwin-amd64 \
    darwin-arm64

BUILD_TARGETS = $(addprefix $(BUILD_DIR)/$(APP_NAME)-, $(PLATFORMS))

build-all: $(BUILD_DIR) $(BUILD_TARGETS)

$(BUILD_DIR):
	mkdir -p $(BUILD_DIR)

# Cross-compilation targets
$(BUILD_DIR)/$(APP_NAME)-linux-amd64:
	GOOS=linux GOARCH=amd64 CGO_ENABLED=1 \
	CC="x86_64-linux-musl-gcc" CGO_LDFLAGS="-static" \
	go build -tags $(GO_BUILD_TAGS) -o $@ ./cmd/$(APP_NAME)/main.go

$(BUILD_DIR)/$(APP_NAME)-linux-arm64:
	GOOS=linux GOARCH=arm64 CGO_ENABLED=1 \
	CC="aarch64-linux-musl-gcc" CGO_LDFLAGS="-static" \
	go build -tags $(GO_BUILD_TAGS) -o $@ ./cmd/$(APP_NAME)/main.go

$(BUILD_DIR)/$(APP_NAME)-windows-amd64:
	GOOS=windows GOARCH=amd64 CGO_ENABLED=1 \
	CC="x86_64-w64-mingw32-gcc" \
	go build -tags $(GO_BUILD_TAGS) -o $@.exe ./cmd/$(APP_NAME)/main.go

$(BUILD_DIR)/$(APP_NAME)-windows-386:
	GOOS=windows GOARCH=386 CGO_ENABLED=1 \
	CC="i686-w64-mingw32-gcc" \
	go build -tags $(GO_BUILD_TAGS) -o $@.exe ./cmd/$(APP_NAME)/main.go

$(BUILD_DIR)/$(APP_NAME)-darwin-amd64:
	GOOS=darwin GOARCH=amd64 CGO_ENABLED=1 \
	CC="clang -target x86_64-apple-darwin -isysroot $(shell xcrun --show-sdk-path)" \
	CGO_CFLAGS="-mmacosx-version-min=10.15" CGO_LDFLAGS="-mmacosx-version-min=10.15" \
	go build -tags $(GO_BUILD_TAGS) -o $@ ./cmd/$(APP_NAME)/main.go

$(BUILD_DIR)/$(APP_NAME)-darwin-arm64:
	GOOS=darwin GOARCH=arm64 CGO_ENABLED=1 \
	CC="clang -target arm64-apple-darwin -isysroot $(shell xcrun --show-sdk-path)" \
	CGO_CFLAGS="-mmacosx-version-min=10.15" CGO_LDFLAGS="-mmacosx-version-min=10.15" \
	go build -tags $(GO_BUILD_TAGS) -o $@ ./cmd/$(APP_NAME)/main.go

# Local build for current platform
build-local: $(BUILD_DIR)
	go build -tags $(GO_BUILD_TAGS) -o $(BUILD_DIR)/$(APP_NAME)-local ./cmd/$(APP_NAME)/main.go

run: build-local
	./$(BUILD_DIR)/$(APP_NAME)-local

clean:
	rm -rf $(BUILD_DIR)

.PHONY: build-all clean build-local run
