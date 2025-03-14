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
    setDisplayedWeekStartDate(utils.getStartOfWeek(new Date()));
    await calendar.renderWeekCalendar(getDisplayedWeekStartDateInternal());
    await ui.refreshTodayTasks();
    ui.updateTabTitle();
  }
}

// Initialization function
async function initialize() {
  loadLanguage();
  ui.setTheme(currentTheme);
  calendar.renderWeekCalendar(getDisplayedWeekStartDateInternal());
  calendar.renderInbox();
  ui.updateSettingsText();
  setupEventListeners();
  // Set initial checkbox states based on localStorage
  document.getElementById("full-weekdays-checkbox").checked =
    displayFullWeekdays;
  document.getElementById("wrap-task-titles-checkbox").checked = wrapTaskTitles;
  ui.handleCheckboxChange(document.getElementById("full-weekdays-checkbox"));
  ui.handleCheckboxChange(document.getElementById("wrap-task-titles-checkbox"));
  ui.updateTabTitle();
  await checkAndRefreshTasks(); // Initial check on load

  if (currentTheme === "auto") {
    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", (event) => {
        ui.setTheme("auto");
      });
  }
}
//Corrected setupEventListeners
function setupEventListeners() {
  prevWeekButton.addEventListener("click", async () => {
    setDisplayedWeekStartDate(
      utils.addDays(getDisplayedWeekStartDateInternal(), -7),
    ); // Use setter here
    await calendar.renderWeekCalendar(getDisplayedWeekStartDateInternal()); //Await render
    await checkAndRefreshTasks(); // Check date after navigation
  });

  nextWeekButton.addEventListener("click", async () => {
    setDisplayedWeekStartDate(
      utils.addDays(getDisplayedWeekStartDateInternal(), 7),
    ); // Use setter here
    await calendar.renderWeekCalendar(getDisplayedWeekStartDateInternal()); //Await render
    await checkAndRefreshTasks(); // Check date after navigation
  });

  settingsBtn.addEventListener("click", ui.toggleSettingsPopup);
  searchBtn.addEventListener("click", ui.toggleSearchPopup);
  fuzzySearchInput.addEventListener("input", ui.handleSearchInput);
  monthNameElement.addEventListener("click", handleMonthNameClick);

  document.addEventListener("keydown", handleGlobalKeydown);
  window.addEventListener("click", handleGlobalClick);

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
}

async function handleWrapTaskTitlesChange(event) {
  ui.handleCheckboxChange(event.target);
  wrapTaskTitles = event.target.checked;
  localStorage.setItem("wrapTaskTitles", wrapTaskTitles);
  await tasks.renderAllTasks();
}

// Start the application
document.addEventListener("DOMContentLoaded", initialize);
