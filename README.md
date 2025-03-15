# Week Planner

Simple, time-free planner with week view & to-do list. It's a single executable application with portable tasks stored locally in a `tasks.db` file (SQLite), available for download [here](https://github.com/demig00d/week-planner/releases).

![Themes|width=300](images/usage-demo.gif)

## Key Features

**Effortless Task Management:**

- [x] Inbox for tasks without date
- [x] Detailed task descriptions
  - [x] Supports Markdown formatting
  - [x] Displays the number of subtasks
- [x] Fuzzy search capability

**Visual & User-Friendly:**

- [x] Week view calendar
- [x] Tab icon task count
- [x] Color-coded tasks
- [x] Dark theme

**Simplicity & Portability:**

- [x] Time-free planning
- [x] Single executable application
- [x] Portable tasks (SQLite `tasks.db`)
- [x] Import database (`tasks.db`) from UI **(Experimental)**
- [x] Export database (`tasks.db`) from UI **(Experimental)**

## Env variables

- `LOGLEVEL` (one of `debug`, `info`, `warn`, `error`)
- `PORT` (App port)
