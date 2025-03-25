package db

import (
	"fmt"
	"log/slog"
	"os"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

var db *gorm.DB

func GetDB() *gorm.DB {
	return db
}

// OpenTestDB opens a database connection for testing purposes without replacing the global db instance.
func OpenTestDB(dbFile string) (*gorm.DB, error) {
	testDB, err := gorm.Open(sqlite.Open(dbFile+"?_journal_mode=WAL"), &gorm.Config{})
	if err != nil {
		return nil, err
	}
	// Run migrations specifically for the test DB if needed, or rely on caller
	// For consistency, let's also run AutoMigrate here for tests.
	// This ensures test DBs always have the latest schema.
	if err := testDB.AutoMigrate(&Task{}); err != nil {
		slog.Error("Failed to auto migrate test database", "error", err)
		sqlDB, _ := testDB.DB()
		sqlDB.Close()
		return nil, err
	}
	// Add setting table migration for tests too
	type Setting struct {
		ID    int    `gorm:"primaryKey;autoIncrement"`
		Key   string `gorm:"unique;not null"`
		Value string
	}
	if err := testDB.AutoMigrate(&Setting{}); err != nil {
		slog.Error("Failed to auto migrate settings table in test db", "error", err)
		sqlDB, _ := testDB.DB()
		sqlDB.Close()
		return nil, err
	}

	return testDB, nil
}

func InitDB() {
	dbFile := "tasks.db"
	dbExists := false
	if _, err := os.Stat(dbFile); err == nil {
		slog.Info("tasks.db exists, opening database...")
		dbExists = true
	} else if os.IsNotExist(err) {
		slog.Info("tasks.db does not exist, creating database...")
		dbExists = false
	} else {
		// Other error (permissions, etc.)
		slog.Error("Error checking for database file", "error", err)
		panic(fmt.Errorf("error checking for database file %s: %w", dbFile, err))
	}

	var err error
	// Always open connection first
	newGormDB, err := gorm.Open(sqlite.Open(dbFile+"?_journal_mode=WAL"), &gorm.Config{})
	if err != nil {
		slog.Error("failed to connect to database", "error", err)
		panic(fmt.Errorf("failed to connect database %s: %w", dbFile, err))
	}
	db = newGormDB // Update the global db variable

	// --- Table Schemas ---
	type Setting struct {
		ID    int    `gorm:"primaryKey;autoIncrement"`
		Key   string `gorm:"unique;not null"`
		Value string
	}

	// Run AutoMigrate regardless - it's idempotent and handles new tables/columns gracefully.
	// It will add the new columns if they don't exist in an existing DB.
	slog.Info("Running auto migration...")
	if err := db.AutoMigrate(&Task{}, &Setting{}); err != nil {
		slog.Error("Failed to auto migrate database", "error", err)
		sqlDB, _ := db.DB()
		sqlDB.Close() // Attempt to close before panic
		panic(fmt.Errorf("failed to auto migrate: %w", err))
	}
	slog.Info("Auto migration completed.")

	// --- Specific Logic for New vs Existing DB ---
	if !dbExists {
		// --- NEW DATABASE Initialization ---
		slog.Info("Initializing FTS and Triggers for new database...")
		// Create FTS table only if it doesn't exist (AutoMigrate doesn't handle VIRTUAL tables)
		if err := db.Exec("CREATE VIRTUAL TABLE IF NOT EXISTS tasks_fts USING fts5(title, description, content='tasks', content_rowid='id')").Error; err != nil {
			slog.Error("Failed to create FTS table", "error", err)
			sqlDB, _ := db.DB()
			sqlDB.Close()
			panic(fmt.Errorf("failed to create FTS table: %w", err))
		}
		initTriggers() // Initialize triggers for FTS

		// Insert default setting if missing (AutoMigrate creates the table, but not the row)
		var count int64
		db.Model(&Setting{}).Where("key = ?", "inbox_title").Count(&count)
		if count == 0 {
			slog.Info("Inserting default inbox_title setting...")
			if err := db.Create(&Setting{Key: "inbox_title", Value: "📦 Inbox"}).Error; err != nil {
				slog.Error("Failed to insert default setting", "error", err)
				sqlDB, _ := db.DB()
				sqlDB.Close()
				panic(fmt.Errorf("failed to insert default setting: %w", err))
			}
		}

		// Create index (should be handled by AutoMigrate based on GORM tags, but explicit doesn't hurt)
		ensureIndices()

		slog.Info("New database creation and initialization completed.")

	} else {
		// --- EXISTING DATABASE Checks ---
		slog.Info("Performing checks on existing database...")

		// 1. Ensure FTS table and triggers exist (might be missing if upgrading from a *very* old version)
		var ftsTableCount int
		// Check if tasks_fts exists in sqlite_master
		err := db.Raw("SELECT count(*) FROM sqlite_master WHERE type='table' AND name='tasks_fts'").Scan(&ftsTableCount).Error
		if err != nil {
			slog.Error("Failed to check for FTS table existence", "error", err)
			// Decide how critical this is. Maybe log warning and continue? Or panic?
			// Let's panic for safety, as search will fail without FTS.
			sqlDB, _ := db.DB()
			sqlDB.Close()
			panic(fmt.Errorf("failed to check FTS table existence: %w", err))
		}

		if ftsTableCount == 0 {
			slog.Warn("FTS table 'tasks_fts' not found in existing database. Attempting to create...")
			if err := db.Exec("CREATE VIRTUAL TABLE tasks_fts USING fts5(title, description, content='tasks', content_rowid='id')").Error; err != nil {
				slog.Error("Failed to create missing FTS table", "error", err)
				// Panic if FTS creation fails
				sqlDB, _ := db.DB()
				sqlDB.Close()
				panic(fmt.Errorf("failed to create missing FTS table: %w", err))
			}
			slog.Info("Missing FTS table created. Re-indexing existing tasks...")
			// Populate FTS table with existing data
			if err := db.Exec("INSERT INTO tasks_fts (rowid, title, description) SELECT id, title, description FROM tasks").Error; err != nil {
				slog.Error("Failed to populate FTS table from existing tasks", "error", err)
				// Panic if population fails
				sqlDB, _ := db.DB()
				sqlDB.Close()
				panic(fmt.Errorf("failed to populate FTS table: %w", err))
			}
			slog.Info("FTS table populated.")
			initTriggers() // Ensure triggers are also created
		} else {
			// FTS table exists, ensure triggers are there too (less critical, might only affect future changes)
			initTriggers() // Idempotent check/creation
		}

		// 2. Ensure indices exist
		ensureIndices()

		// 3. Check for default settings (e.g., inbox_title)
		var settingCount int64
		db.Model(&Setting{}).Where("key = ?", "inbox_title").Count(&settingCount)
		if settingCount == 0 {
			slog.Warn("Default setting 'inbox_title' not found. Attempting to insert...")
			if err := db.Create(&Setting{Key: "inbox_title", Value: "📦 Inbox"}).Error; err != nil {
				slog.Error("Failed to insert missing default setting 'inbox_title'", "error", err)
				// Log and continue, app might function partially without it.
			} else {
				slog.Info("Inserted missing default setting 'inbox_title'.")
			}
		}

		slog.Info("Existing database checks completed.")
	}

	slog.Info("Database initialization successful.")
}

// ensureIndices creates necessary indices if they don't exist.
func ensureIndices() {
	// Index for title/due_date (covered by GORM tag and AutoMigrate, but explicit check)
	indexName := "idx_tasks_title_duedate"
	var indexCount int
	err := db.Raw("SELECT count(*) FROM sqlite_master WHERE type='index' AND name=?", indexName).Scan(&indexCount).Error
	if err != nil {
		slog.Error("Failed to check for index existence", "index", indexName, "error", err)
		// Log and continue, performance might be affected.
		return
	}

	if indexCount == 0 {
		slog.Info("Index not found, creating...", "index", indexName)
		err := db.Exec(fmt.Sprintf("CREATE INDEX %s ON tasks(title, due_date)", indexName)).Error
		if err != nil {
			slog.Error("Failed to create index", "index", indexName, "error", err)
			// Log and continue
		} else {
			slog.Info("Index created successfully", "index", indexName)
		}
	} else {
		slog.Debug("Index already exists", "index", indexName)
	}
}

// initTriggers ensures FTS triggers exist.
func initTriggers() {
	// Use `CREATE TRIGGER IF NOT EXISTS` for idempotency
	triggers := map[string]string{
		"tasks_ai": `
            CREATE TRIGGER IF NOT EXISTS tasks_ai AFTER INSERT ON tasks
            BEGIN
                INSERT INTO tasks_fts(rowid, title, description)
                VALUES (new.id, new.title, new.description);
            END;`,
		"tasks_ad": `
            CREATE TRIGGER IF NOT EXISTS tasks_ad AFTER DELETE ON tasks
            BEGIN
                DELETE FROM tasks_fts WHERE rowid = old.id;
            END;`,
		"tasks_au": `
            CREATE TRIGGER IF NOT EXISTS tasks_au AFTER UPDATE OF title, description ON tasks
            BEGIN
                -- Use the recommended UPDATE syntax for FTS5 external content tables
                UPDATE tasks_fts SET title = new.title, description = new.description WHERE rowid = old.id;
            END;`,
	}

	for name, sql := range triggers {
		if err := db.Exec(sql).Error; err != nil {
			// Panicking might be too aggressive if only one trigger fails. Log error.
			slog.Error("Failed to create/verify trigger", "trigger_name", name, "error", err)
		}
	}

	slog.Debug("FTS Triggers checked/initialized.")
}
