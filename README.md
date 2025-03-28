# Week Planner

Simple, time-free planner with week view & to-do list. It's a single executable application with portable tasks stored locally in a `tasks.db` file (SQLite), available for download [here](https://github.com/demig00d/week-planner/releases).

<img src="https://github.com/demig00d/week-planner/blob/master/images/usage-demo.gif?raw=true" width=55% height=55%>

## Key Features

**Effortless Task Management:**

- [x] Inbox for tasks without date
- [x] Detailed task descriptions
  - [x] Supports Markdown formatting
  - [x] Displays the number of subtasks
- [x] Fuzzy search capability
- [x] Recurring tasks
- [ ] Notifications

**Visual & User-Friendly:**

- [x] Week view calendar
- [x] Tab icon task count
- [x] Color-coded tasks
- [x] Dark theme
- [ ] Option to select the starting day of the week

**Simplicity & Portability:**

- [x] Time-free planning
- [x] Single executable application
- [x] Portable tasks (SQLite `tasks.db`)
- [x] Import database (`tasks.db`) from UI **(Experimental)**
- [x] Export database (`tasks.db`) from UI **(Experimental)**

## Env variables

- `LOGLEVEL` (one of `debug`, `info`, `warn`, `error`)
- `PORT` (App port)
