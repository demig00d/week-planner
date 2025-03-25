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
let _displayedWeekStartDate = utils.getStartOfWeek(new Date());
let currentTheme = localStorage.getItem("theme") || "auto";
let displayFullWeekdays = localStorage.getItem("fullWeekdays") === "true";
let wrapTaskTitles = localStorage.getItem("wrapTaskTitles") !== "false";
let lastKnownDate = new Date().toLocaleDateString("en-CA");
if (localStorage.getItem("wrapTaskTitles") === null) {
  wrapTaskTitles = initialWrapTaskTitles;
}
let initialTaskLinkHandled = false;

// Getter/Setter for displayedWeekStartDate
export const getDisplayedWeekStartDate = () => _displayedWeekStartDate;
export const setDisplayedWeekStartDate = (newDate) => {
  _displayedWeekStartDate = newDate;
};
const getDisplayedWeekStartDateInternal = () => _displayedWeekStartDate; // Internal use

// Check for date change and handle recurring tasks
async function checkAndRefreshTasks() {
  const currentDate = new Date().toLocaleDateString("en-CA");
  if (currentDate !== lastKnownDate) {
    lastKnownDate = currentDate;
    if (!(await api.checkRecurringTasks())) {
      console.error("Could not check/create recurring tasks:"); // Keep error log concise
    }
    // Refresh the week view as the check might have created new tasks for today
    setDisplayedWeekStartDate(utils.getStartOfWeek(new Date()));
    await calendar.renderWeekCalendar(getDisplayedWeekStartDateInternal());
    await ui.refreshTodayTasks(); // This now uses ui.setTodayTasks
    ui.updateTabTitle(); // Update title/favicon
  }
}

// Initialization function
async function initialize() {
  await loadLanguage();
  ui.updateSettingsLanguageSelector(localStorage.getItem("language") || "ru");
  ui.setTheme(currentTheme);
  requestAnimationFrame(ui.updateSelectArrowsColor); // Update select arrows after theme
  await calendar.renderWeekCalendar(getDisplayedWeekStartDateInternal());
  await calendar.renderInbox();
  ui.updateSettingsText(); // Apply translations
  setupEventListeners();

  // Set initial checkbox states and visual representation
  const fullWeekdaysCheckbox = document.getElementById(
    "full-weekdays-checkbox",
  );
  const wrapTitlesCheckbox = document.getElementById(
    "wrap-task-titles-checkbox",
  );
  if (fullWeekdaysCheckbox) {
    fullWeekdaysCheckbox.checked = displayFullWeekdays;
    ui.handleCheckboxChange(fullWeekdaysCheckbox);
  }
  if (wrapTitlesCheckbox) {
    wrapTitlesCheckbox.checked = wrapTaskTitles;
    ui.handleCheckboxChange(wrapTitlesCheckbox);
  }

  ui.updateTabTitle(); // Initial title/favicon set
  await checkAndRefreshTasks(); // Initial check on load

  if (!initialTaskLinkHandled) {
    initialTaskLinkHandled = true;
    handleInitialTaskLink(); // Handle potential deep link
  }

  // Add listener for system theme changes if theme is 'auto'
  if (currentTheme === "auto") {
    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", handleSystemThemeChange);
  }
}

function setupEventListeners() {
  if (prevWeekButton) {
    prevWeekButton.addEventListener("click", async () => {
      setDisplayedWeekStartDate(
        utils.addDays(getDisplayedWeekStartDateInternal(), -7),
      );
      await calendar.renderWeekCalendar(getDisplayedWeekStartDateInternal());
      await checkAndRefreshTasks(); // Refresh recurring etc.
    });
  }
  if (nextWeekButton) {
    nextWeekButton.addEventListener("click", async () => {
      setDisplayedWeekStartDate(
        utils.addDays(getDisplayedWeekStartDateInternal(), 7),
      );
      await calendar.renderWeekCalendar(getDisplayedWeekStartDateInternal());
      await checkAndRefreshTasks();
    });
  }
  if (settingsBtn)
    settingsBtn.addEventListener("click", ui.toggleSettingsPopup);
  if (searchBtn) searchBtn.addEventListener("click", ui.toggleSearchPopup);
  if (fuzzySearchInput)
    fuzzySearchInput.addEventListener("input", ui.handleSearchInput);
  if (monthNameElement)
    monthNameElement.addEventListener("click", handleMonthNameClick);

  document.addEventListener("keydown", handleGlobalKeydown);
  window.addEventListener("click", ui.handleGlobalClick);
  window.addEventListener("hashchange", handleHashChange);

  const themeSelect = document.getElementById("theme-select");
  if (themeSelect) {
    themeSelect.addEventListener("change", (event) => {
      const selectedTheme = event.target.value;
      localStorage.setItem("theme", selectedTheme);
      ui.setTheme(selectedTheme);
      // Manage system theme listener
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      mediaQuery.removeEventListener("change", handleSystemThemeChange); // Remove first
      if (selectedTheme === "auto") {
        mediaQuery.addEventListener("change", handleSystemThemeChange); // Add back if auto
      }
    });
  }

  const langSelect = document.getElementById("language-select-popup");
  if (langSelect)
    langSelect.addEventListener("change", (event) =>
      ui.setLanguage(event.target.value),
    );

  const fullWeekdaysCheckbox = document.getElementById(
    "full-weekdays-checkbox",
  );
  const wrapTitlesCheckbox = document.getElementById(
    "wrap-task-titles-checkbox",
  );
  if (fullWeekdaysCheckbox) {
    fullWeekdaysCheckbox.addEventListener("change", handleFullWeekdaysChange);
    ui.handleCheckboxChange(fullWeekdaysCheckbox);
  }
  if (wrapTitlesCheckbox) {
    wrapTitlesCheckbox.addEventListener("change", handleWrapTaskTitlesChange);
    ui.handleCheckboxChange(wrapTitlesCheckbox);
  }

  // Task completion in task details popup
  const markDoneBtn = document.getElementById("mark-done-task-details");
  if (markDoneBtn) {
    markDoneBtn.addEventListener("click", async () => {
      console.log(
        "Mark done button clicked. Current task ID:",
        ui.currentTaskBeingViewed,
      );
      const button = document.getElementById("mark-done-task-details"); // Re-fetch inside listener
      const currentTaskId = ui.currentTaskBeingViewed; // Capture current ID

      if (!currentTaskId || !button) {
        console.error("Cannot mark done: Task ID or button not available.");
        return;
      }

      const isCompleted = button.dataset.completed === "1";
      const newCompletedStatus = isCompleted ? 0 : 1;

      try {
        await tasks.handleTaskCompletion(
          currentTaskId,
          newCompletedStatus,
          ui.todayTasks, // Pass current state
          (updatedTasks) => {
            // Pass the UPDATE FUNCTION
            ui.setTodayTasks(updatedTasks); // Use the setter
            ui.updateTabTitle(); // Update favicon
          },
        );
        // UI update for the button is handled within handleTaskCompletion if popup is open
      } catch (error) {
        console.error("Error handling task completion from popup:", error);
        ui.showSnackbar("failedToUpdateTaskStatus", true);
      }
    });
  } else {
    console.error("Mark done button not found during setup.");
  }

  // Refresh tasks on visibility change (tab switch)
  document.addEventListener("visibilitychange", async () => {
    if (document.visibilityState === "visible") {
      await checkAndRefreshTasks();
    }
  });

  // Export/Import handlers are attached directly in ui.js now
}

async function handleInitialTaskLink() {
  const hash = window.location.hash;
  if (hash.startsWith("#task/")) {
    const taskId = hash.substring(6);
    try {
      const taskDetails = await api.fetchTaskDetails(taskId);
      if (taskDetails) {
        ui.closeAllPopups(); // Close any other popups first
        if (taskDetails.due_date) {
          const taskDateObj = new Date(
            Date.UTC(
              taskDetails.due_date.split("-")[0],
              taskDetails.due_date.split("-")[1] - 1,
              taskDetails.due_date.split("-")[2],
            ),
          );
          const startOfWeek = utils.getStartOfWeek(taskDateObj);
          setDisplayedWeekStartDate(startOfWeek);
          await calendar.renderWeekCalendar(startOfWeek); // Render the correct week
        } else {
          await calendar.renderInbox(); // Ensure inbox is rendered
          document
            .getElementById("inbox")
            ?.scrollIntoView({ behavior: "smooth" });
        }
        ui.highlightTask(taskId); // Highlight after rendering/scrolling
        history.pushState(
          "",
          document.title,
          window.location.pathname + window.location.search,
        ); // Clear hash
      } else {
        console.warn(`Task with ID ${taskId} not found from hash link.`);
        history.pushState(
          "",
          document.title,
          window.location.pathname + window.location.search,
        );
      }
    } catch (error) {
      console.error("Error fetching task details from link:", error);
      history.pushState(
        "",
        document.title,
        window.location.pathname + window.location.search,
      );
    }
  }
}

function handleHashChange() {
  handleInitialTaskLink(); // Re-evaluate hash on change
}

async function handleMonthNameClick() {
  setDisplayedWeekStartDate(utils.getStartOfWeek(new Date()));
  await calendar.renderWeekCalendar(getDisplayedWeekStartDateInternal());
}

function handleGlobalKeydown(event) {
  if (event.key === "Escape") {
    ui.closeAllPopups();
  }
}

function handleSystemThemeChange(event) {
  if (localStorage.getItem("theme") === "auto") {
    ui.setTheme("auto"); // Re-apply auto theme based on new system preference
  }
}

async function handleFullWeekdaysChange(event) {
  ui.handleCheckboxChange(event.target);
  displayFullWeekdays = event.target.checked;
  localStorage.setItem("fullWeekdays", displayFullWeekdays);
  await calendar.renderWeekCalendar(getDisplayedWeekStartDateInternal());
  ui.updateSettingsText(); // Re-apply translations if needed
}

async function handleWrapTaskTitlesChange(event) {
  ui.handleCheckboxChange(event.target);
  wrapTaskTitles = event.target.checked;
  localStorage.setItem("wrapTaskTitles", wrapTaskTitles);
  await tasks.renderAllTasks(); // Re-render all visible tasks
}

// Start the application
document.addEventListener("DOMContentLoaded", initialize);
