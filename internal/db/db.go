package db

import (
	"log"
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
		log.Println("tasks.db does not exist, creating database...")
		newDB = true
	} else {
		log.Println("tasks.db exists, opening database...")
	}

	var err error
	db, err = gorm.Open(sqlite.Open(dbFile+"?_journal_mode=WAL&_sync=FULL"), &gorm.Config{})
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}

	if newDB {
		log.Println("Running auto migration...")
		if err := db.AutoMigrate(&Task{}); err != nil {
			log.Fatalf("Failed to auto migrate database: %v", err)
		}
		if err := db.Exec("CREATE VIRTUAL TABLE IF NOT EXISTS tasks_fts USING fts5(title, description, content='tasks', content_rowid='id')").Error; err != nil {
			log.Fatalf("Failed to create FTS table: %v", err)
		}
		initTriggers()

		// Insert default setting
		type Setting struct {
			ID    int    `gorm:"primaryKey;autoIncrement"`
			Key   string `gorm:"unique;not null"`
			Value string
		}
		if err := db.AutoMigrate(&Setting{}); err != nil {
			log.Fatalf("Failed to auto migrate settings table: %v", err)
		}
		var count int64
		db.Model(&Setting{}).Where("key = ?", "inbox_title").Count(&count)
		if count == 0 {
			if err := db.Create(&Setting{Key: "inbox_title", Value: "📦 Inbox"}).Error; err != nil {
				log.Fatalf("Failed to insert default setting: %v", err)
			}
		}

		log.Println("Database creation and migration completed.")
	} else {
		log.Println("Database opened successfully.")
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
		log.Fatalf("Error creating INSERT trigger: %v", err)
	}

	// Trigger for DELETE
	_, err = sqldb.Exec(`
        CREATE TRIGGER IF NOT EXISTS tasks_ad AFTER DELETE ON tasks
        BEGIN
            DELETE FROM tasks_fts WHERE rowid = old.id;
        END;
    `)
	if err != nil {
		log.Fatalf("Error creating DELETE trigger: %v", err)
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
		log.Fatalf("Error creating UPDATE trigger: %v", err)
	}

	log.Println("Triggers initialized successfully.")
}
