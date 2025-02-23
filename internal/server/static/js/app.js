import * as api from "./api.js";
import * as calendar from "./calendar.js";
import * as tasks from "./tasks.js";
import * as ui from "./ui.js";
import * as utils from "./utils.js";
import { setupSSE } from "./sse.js";
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
let displayedWeekStartDate = utils.getStartOfWeek(new Date());
let currentTheme = localStorage.getItem("theme") || "auto";
let displayFullWeekdays = localStorage.getItem("fullWeekdays") === "true";
let wrapTaskTitles = localStorage.getItem("wrapTaskTitles") !== "false";
if (localStorage.getItem("wrapTaskTitles") === null) {
  wrapTaskTitles = initialWrapTaskTitles; // Use the default if not set
}

// Initialization function
async function initialize() {
  loadLanguage();
  ui.setTheme(currentTheme);
  calendar.renderWeekCalendar(displayedWeekStartDate);
  calendar.renderInbox();
  ui.updateSettingsText();
  setupEventListeners();
  setupSSE();
  ui.updateTabTitle();

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
  prevWeekButton.addEventListener("click", () => {
    displayedWeekStartDate = utils.addDays(displayedWeekStartDate, -7);
    calendar.renderWeekCalendar(displayedWeekStartDate);
  });

  nextWeekButton.addEventListener("click", () => {
    displayedWeekStartDate = utils.addDays(displayedWeekStartDate, 7);
    calendar.renderWeekCalendar(displayedWeekStartDate);
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
}

function handleMonthNameClick() {
  displayedWeekStartDate = utils.getStartOfWeek(new Date());
  calendar.renderWeekCalendar(displayedWeekStartDate);
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
  calendar.renderWeekCalendar(displayedWeekStartDate);
}

async function handleWrapTaskTitlesChange(event) {
  ui.handleCheckboxChange(event.target);
  wrapTaskTitles = event.target.checked;
  localStorage.setItem("wrapTaskTitles", wrapTaskTitles);
  await tasks.renderAllTasks();
}

// Start the application
document.addEventListener("DOMContentLoaded", initialize);
