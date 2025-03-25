import * as api from "./api.js";
import * as calendar from "./calendar.js";
import * as tasks from "./tasks.js";
import * as ui from "./ui.js";
import * as utils from "./utils.js";
import { loadLanguage, translations } from "./localization.js";
import { dayIds, TASK_COLORS, initialWrapTaskTitles } from "./config.js";

// DOM element references
const monthNameElement = document.querySelector(".month-name");
const prevWeekButton = document.getElementById("prev-week");
const nextWeekButton = document.getElementById("next-week");
const settingsBtn = document.getElementById("settings-btn");
const searchBtn = document.getElementById("search-btn");
const fuzzySearchInput = document.getElementById("fuzzy-search-input");

// State variables
let _displayedWeekStartDate = utils.getStartOfWeek(new Date()); // Use an underscore to indicate it's "private" to app.js
let currentTheme = localStorage.getItem("theme") || "auto";
let displayFullWeekdays = localStorage.getItem("fullWeekdays") === "true";
let wrapTaskTitles = localStorage.getItem("wrapTaskTitles") !== "false";
let lastKnownDate = new Date().toLocaleDateString("en-CA"); // Store last known date
if (localStorage.getItem("wrapTaskTitles") === null) {
  wrapTaskTitles = initialWrapTaskTitles;
}

// Getter for displayedWeekStartDate (optional, but good practice)
export const getDisplayedWeekStartDate = () => _displayedWeekStartDate;

// Setter function for displayedWeekStartDate - This is what we export
export const setDisplayedWeekStartDate = (newDate) => {
  _displayedWeekStartDate = newDate;
};

// Now use the getter internally in app.js where you need the value
const getDisplayedWeekStartDateInternal = () => _displayedWeekStartDate;

async function checkAndRefreshTasks() {
  const currentDate = new Date().toLocaleDateString("en-CA");
  if (currentDate !== lastKnownDate) {
    lastKnownDate = currentDate;

    try {
      const response = await fetch("/api/check_recurring_tasks", {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      console.log("Checked and created recurring tasks");
    } catch (error) {
      console.error("Could not check/create recurring tasks:", error);
    }

    setDisplayedWeekStartDate(utils.getStartOfWeek(new Date()));
    await calendar.renderWeekCalendar(getDisplayedWeekStartDateInternal());
    await ui.refreshTodayTasks();
    ui.updateTabTitle();
  }
}

// Initialization function
async function initialize() {
  await loadLanguage();
  ui.updateSettingsLanguageSelector(localStorage.getItem("language") || "ru");
  ui.setTheme(currentTheme);
  await calendar.renderWeekCalendar(getDisplayedWeekStartDateInternal());
  await calendar.renderInbox();
  ui.updateSettingsText();
  setupEventListeners();
  // Set initial checkbox states based on localStorage - keep this *before* initial task link handling
  document.getElementById("full-weekdays-checkbox").checked =
    displayFullWeekdays;
  document.getElementById("wrap-task-titles-checkbox").checked = wrapTaskTitles;
  ui.handleCheckboxChange(document.getElementById("full-weekdays-checkbox"));
  ui.handleCheckboxChange(document.getElementById("wrap-task-titles-checkbox"));
  ui.updateTabTitle();
  await checkAndRefreshTasks(); // Initial check on load

  // Handle initial task link on page load, but only once and AFTER initialization is complete
  if (!initialTaskLinkHandled) {
    initialTaskLinkHandled = true;
    handleInitialTaskLink();
  }

  if (currentTheme === "auto") {
    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", (event) => {
        ui.setTheme("auto");
      });
  }
}

let initialTaskLinkHandled = false; // Flag to prevent handling link multiple times on init
// Corrected setupEventListeners
function setupEventListeners() {
  prevWeekButton.addEventListener("click", async () => {
    setDisplayedWeekStartDate(
      utils.addDays(getDisplayedWeekStartDateInternal(), -7),
    ); // Use setter here
    await calendar.renderWeekCalendar(getDisplayedWeekStartDateInternal());
    await checkAndRefreshTasks(); // Check date after navigation
  });

  nextWeekButton.addEventListener("click", async () => {
    setDisplayedWeekStartDate(
      utils.addDays(getDisplayedWeekStartDateInternal(), 7),
    ); // Use setter here
    await calendar.renderWeekCalendar(getDisplayedWeekStartDateInternal());
    await checkAndRefreshTasks(); // Check date after navigation
  });

  settingsBtn.addEventListener("click", ui.toggleSettingsPopup);
  searchBtn.addEventListener("click", ui.toggleSearchPopup);
  fuzzySearchInput.addEventListener("input", ui.handleSearchInput);
  monthNameElement.addEventListener("click", handleMonthNameClick);

  document.addEventListener("keydown", handleGlobalKeydown);
  window.addEventListener("click", handleGlobalClick);
  window.addEventListener("hashchange", handleHashChange);

  document
    .getElementById("theme-select")
    .addEventListener("change", (event) => {
      const selectedTheme = event.target.value;
      localStorage.setItem("theme", selectedTheme);
      ui.setTheme(selectedTheme);
      if (selectedTheme === "auto") {
        window
          .matchMedia("(prefers-color-scheme: dark)")
          .addEventListener("change", handleSystemThemeChange);
      } else {
        window
          .matchMedia("(prefers-color-scheme: dark)")
          .removeEventListener("change", handleSystemThemeChange);
      }
    });

  document
    .getElementById("language-select-popup")
    .addEventListener("change", (event) => {
      ui.setLanguage(event.target.value);
    });

  document
    .getElementById("full-weekdays-checkbox")
    .addEventListener("change", handleFullWeekdaysChange);
  document
    .getElementById("wrap-task-titles-checkbox")
    .addEventListener("change", handleWrapTaskTitlesChange);

  document
    .getElementById("task-details-popup-overlay")
    .addEventListener("transitionend", () => {
      if (
        document.getElementById("task-details-popup-overlay").style.display ===
        "flex"
      ) {
        document
          .getElementById("task-details-popup-overlay")
          .dispatchEvent(new CustomEvent("show.popup"));
      } else {
        document
          .getElementById("task-details-popup-overlay")
          .dispatchEvent(new CustomEvent("hide.popup"));
      }
    });

  document
    .getElementById("task-details-popup-overlay")
    .addEventListener("show.popup", () => {
      ui.adjustTextareaHeight(); //Call on show.popup event
    });

  // Task completion in task details popup, correct todayTasks update
  document
    .getElementById("mark-done-task-details")
    .addEventListener("click", () => {
      if (ui.currentTaskBeingViewed) {
        const isCompleted =
          document.getElementById("mark-done-task-details").dataset
            .completed === "1";
        const newCompletedStatus = isCompleted ? 0 : 1;
        tasks.handleTaskCompletion(
          ui.currentTaskBeingViewed,
          newCompletedStatus,
          ui.todayTasks,
          (updatedTasks) => {
            ui.todayTasks = updatedTasks;
          },
        );
        ui.updateMarkAsDoneButton(newCompletedStatus === 1);
        const taskElement = document.querySelector(
          `.event[data-task-id="${ui.currentTaskBeingViewed}"]`,
        );
        if (taskElement) {
          ui.updateTaskCompletionDisplay(taskElement, newCompletedStatus);
        }
      }
    });

  // Refresh tasks when the page becomes visible (tab switch back)
  document.addEventListener("visibilitychange", async () => {
    if (document.visibilityState === "visible") {
      await checkAndRefreshTasks();
    }
  });

  const exportDbBtn = document.getElementById("export-db-btn");
  if (exportDbBtn) {
    exportDbBtn.addEventListener("click", ui.handleExportDb);
  } else {
    console.error(
      "Element with id 'export-db-btn' not found, export functionality will not work.",
    );
  }

  const importDbInput = document.getElementById("import-db-input");
  if (importDbInput) {
    importDbInput.addEventListener("change", ui.handleImportDb);
  } else {
    console.error(
      "Element with id 'import-db-input' not found, import functionality will not work.",
    );
  }
}

async function handleInitialTaskLink() {
  const hash = window.location.hash;
  if (hash.startsWith("#task/")) {
    const taskId = hash.substring(6); // Extract taskId from #task/{taskId}
    try {
      const taskDetails = await api.fetchTaskDetails(taskId);
      if (taskDetails) {
        ui.closeAllPopups();
        if (taskDetails.due_date) {
          setDisplayedWeekStartDate(
            utils.getStartOfWeek(new Date(taskDetails.due_date)),
          );
          calendar.renderWeekCalendar(
            utils.getStartOfWeek(new Date(taskDetails.due_date)),
          );
        } else {
          document
            .getElementById("inbox")
            .scrollIntoView({ behavior: "smooth" });
        }
        ui.highlightTask(taskId);

        // Clear the hash from the URL after handling the link
        history.pushState(
          "",
          document.title,
          window.location.pathname + window.location.search,
        );
      }
    } catch (error) {
      console.error("Error fetching task details from link:", error);
    }
  }
}

function handleHashChange() {
  handleInitialTaskLink();
}

function handleMonthNameClick() {
  setDisplayedWeekStartDate(utils.getStartOfWeek(new Date()));
  calendar.renderWeekCalendar(getDisplayedWeekStartDateInternal());
}

function handleGlobalKeydown(event) {
  if (event.key === "Escape") {
    ui.closeAllPopups();
  }
}

function handleGlobalClick(event) {
  ui.handleGlobalClick(event);
}

function handleSystemThemeChange(event) {
  ui.setTheme("auto");
}

function handleFullWeekdaysChange(event) {
  ui.handleCheckboxChange(event.target);
  displayFullWeekdays = event.target.checked;
  localStorage.setItem("fullWeekdays", displayFullWeekdays);
  calendar.renderWeekCalendar(getDisplayedWeekStartDateInternal());
  ui.updateSettingsText();
}

async function handleWrapTaskTitlesChange(event) {
  ui.handleCheckboxChange(event.target);
  wrapTaskTitles = event.target.checked;
  localStorage.setItem("wrapTaskTitles", wrapTaskTitles);
  await tasks.renderAllTasks();
}

// Start the application
document.addEventListener("DOMContentLoaded", initialize);
