package db

import (
	"log/slog"
	"os"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

var db *gorm.DB

func GetDB() *gorm.DB {
	return db
}

func InitDB() {
	dbFile := "tasks.db"
	newDB := false
	if _, err := os.Stat(dbFile); os.IsNotExist(err) {
		slog.Info("tasks.db does not exist, creating database...")
		newDB = true
	} else {
		slog.Info("tasks.db exists, opening database...")
	}

	var err error
	db, err = gorm.Open(sqlite.Open(dbFile+"?_journal_mode=WAL"), &gorm.Config{})
	if err != nil {
		slog.Error("failed to connect to database", "error", err)
		panic(err)
	}

	if newDB {
		slog.Info("Running auto migration...")
		if err := db.AutoMigrate(&Task{}); err != nil {
			slog.Error("Failed to auto migrate database", "error", err)
			panic(err)
		}
		if err := db.Exec("CREATE VIRTUAL TABLE IF NOT EXISTS tasks_fts USING fts5(title, description, content='tasks', content_rowid='id')").Error; err != nil {
			slog.Error("Failed to create FTS table", "error", err)
			panic(err)
		}
		initTriggers()

		// Insert default setting
		type Setting struct {
			ID    int    `gorm:"primaryKey;autoIncrement"`
			Key   string `gorm:"unique;not null"`
			Value string
		}
		if err := db.AutoMigrate(&Setting{}); err != nil {
			slog.Error("Failed to auto migrate settings table", "error", err)
			panic(err)
		}
		var count int64
		db.Model(&Setting{}).Where("key = ?", "inbox_title").Count(&count)
		if count == 0 {
			if err := db.Create(&Setting{Key: "inbox_title", Value: "📦 Inbox"}).Error; err != nil {
				slog.Error("Failed to insert default setting", "error", err)
				panic(err)
			}
		}

		slog.Info("Database creation and migration completed.")
	} else {
		// Add index for existing databases
		err := db.Exec(`
            CREATE INDEX IF NOT EXISTS idx_tasks_title_duedate 
            ON tasks(title, due_date)
        `).Error
		if err != nil {
			slog.Error("Failed to create index", "error", err)
			panic(err)
		}
		slog.Info("Database opened successfully.")
	}
}

func initTriggers() {
	sqldb, _ := db.DB()

	// Trigger for INSERT
	_, err := sqldb.Exec(`
        CREATE TRIGGER IF NOT EXISTS tasks_ai AFTER INSERT ON tasks
        BEGIN
            INSERT INTO tasks_fts(rowid, title, description)
            VALUES (new.id, new.title, new.description);
        END;
    `)
	if err != nil {
		panic("Error creating INSERT trigger")
	}

	// Trigger for DELETE
	_, err = sqldb.Exec(`
        CREATE TRIGGER IF NOT EXISTS tasks_ad AFTER DELETE ON tasks
        BEGIN
            DELETE FROM tasks_fts WHERE rowid = old.id;
        END;
    `)
	if err != nil {
		panic("Error creating DELETE trigger")
	}

	// Trigger for UPDATE
	_, err = sqldb.Exec(`
        CREATE TRIGGER IF NOT EXISTS tasks_au AFTER UPDATE OF title, description ON tasks
        BEGIN
            INSERT INTO tasks_fts(tasks_fts, rowid, title, description)
            VALUES ('delete', old.id, NULL, NULL);
            INSERT INTO tasks_fts(rowid, title, description)
            VALUES (new.id, new.title, new.description);
        END;
    `)
	if err != nil {
		panic("Error creating UPDATE trigger")
	}

	slog.Info("Triggers initialized successfully.")
}
