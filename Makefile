APP_NAME=week_planner
BUILD_DIR=build
GO_BUILD_TAGS=sqlite_fts5

PLATFORMS = linux/amd64 linux/arm64 windows/amd64 windows/386 darwin/amd64 darwin/arm64

BUILD_TARGETS = $(foreach p, $(PLATFORMS), $(BUILD_DIR)/$(APP_NAME)-$(subst /,-,$(p)))

all: build-all

build-all: $(BUILD_DIR) $(BUILD_TARGETS)

$(BUILD_DIR):
	mkdir -p $@

$(BUILD_DIR)/$(APP_NAME)-%: $(BUILD_DIR)
	@platform=$* && \
	os=$$(echo $$platform | cut -d'-' -f1) && \
	arch=$$(echo $$platform | cut -d'-' -f2) && \
	output_name="$@" && \
	if [ "$$os" = "windows" ]; then output_name="$$output_name.exe"; fi && \
	echo "Building for $$os/$$arch..." && \
	GOOS=$$os GOARCH=$$arch go build -tags $(GO_BUILD_TAGS) -o "$$output_name" ./cmd/$(APP_NAME)/main.go && \
	echo "Built: $$output_name"

clean:
	rm -rf $(BUILD_DIR)

run: build-local
	./$(BUILD_DIR)/$(APP_NAME)-local

build-local: $(BUILD_DIR)
	go build -tags $(GO_BUILD_TAGS) -o $(BUILD_DIR)/$(APP_NAME)-local ./cmd/$(APP_NAME)/main.go

.PHONY: all build-all clean run build-local
