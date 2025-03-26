import * as api from "./api.js";
import * as calendar from "./calendar.js";
import * as tasks from "./tasks.js";
import * as utils from "./utils.js";
import {
  translations,
  loadLanguage,
  updateTranslations,
} from "./localization.js";
import { TASK_COLORS, initialWrapTaskTitles } from "./config.js";
import { setDisplayedWeekStartDate, getDisplayedWeekStartDate } from "./app.js";

// --- DOM Element References ---
const settingsPopup = document.getElementById("settings-popup");
const taskDetailsPopupOverlay = document.getElementById(
  "task-details-popup-overlay",
);
const taskDetailsPopup = document.getElementById("task-details-popup");
const taskDescriptionTextarea = document.getElementById(
  "task-description-textarea",
);
const taskDescriptionRendered = document.getElementById(
  "task-description-rendered",
);
const closeTaskDetailsPopupBtn = document.getElementById(
  "close-task-details-popup",
);
const deleteTaskDetailsBtn = document.getElementById("delete-task-details");
const toggleDescriptionModeBtn = document.getElementById(
  "toggle-description-mode-btn",
);
const descriptionModeIcon = document.getElementById("description-mode-icon");
const datePickerContainer = document.getElementById("date-picker-container");
const datePickerMonthYear = document.getElementById("date-picker-month-year");
const datePickerGrid = document.getElementById("date-picker-grid");
const fuzzySearchPopup = document.getElementById("fuzzy-search-popup");
const fuzzySearchResultsList = document.getElementById("fuzzy-search-results");
const taskDetailsDateInput = document.getElementById("task-details-date");
const markDoneTaskDetailsBtn = document.getElementById(
  "mark-done-task-details",
);
const copyTaskLinkBtn = document.getElementById("copy-task-link-btn");
const snackbar = document.getElementById("snackbar");
const snackbarText = document.createElement("span");
const snackbarUndoButton = document.createElement("button");
const recurringTaskDetailsBtn = document.getElementById(
  "recurring-task-details",
);
const recurrenceSettingsContainer = document.getElementById(
  "recurrence-settings-container",
);
const recurrenceControls = document.getElementById("recurrence-controls");
const recurrencePeriodSelect = document.getElementById(
  "recurrence-period-select",
);
const recurrenceIntervalInput = document.getElementById(
  "recurrence-interval-input",
);
const recurrencePreview = document.getElementById("recurrence-preview");
const exportDbBtn = document.getElementById("export-db-btn");
const importDbInput = document.getElementById("import-db-input");

// --- State Variables ---
export let todayTasks = [];
export let currentTaskBeingViewed = null;
let isDescriptionRenderedMode = false;
let isSettingsOpen = false;
let isSearchOpen = false;
let searchTimeout = null;
let datePickerVisible = false;
let datePickerCurrentDate = new Date();
let currentPage = 1;
const tasksPerPage = 10;
let searchQuery = "";
let loadingMoreResults = false;
let scrollEventListener = null;

// State for Undo Operations
export let lastDeletedTaskData = null; // Used in tasks.js to filter render temporarily
let deleteTimeoutId = null; // ID for the setTimeout confirming deletion
let lastClearedRecurrence = null; // { taskId: number, rule: string, interval: number }
let recurrenceTimeoutId = null; // ID for the setTimeout confirming recurrence removal
let snackbarTimeoutId = null; // General snackbar hide timeout
let snackbarProgressIntervalId = null; // For JS-based progress animation
let snackbarStartTime = 0;
let snackbarDuration = 0;
let recurrenceOpenedForNonRecurring = false; // Flag for saving default recurrence when popup closes

// Favicon Constants
const faviconColors = {
  light: { empty: "#CCCCCC", singleDigit: "#3498DB", multiple: "#E74C3C" },
  dark: { empty: "#555555", singleDigit: "#5DADE2", multiple: "#EC7063" },
};
const faviconBaseSvg = `<svg width='80' height='80' xmlns='http://www.w3.org/2000/svg'><defs><mask id='text-hole'><rect width='100%' height='100%' fill='white'/><text x='40' y='39' font-family='Arial' font-size='80' font-weight='bold' text-anchor='middle' dominant-baseline='central'>{SYMBOL}</text></mask></defs><circle cx='40' cy='40' r='40' fill='{FILL_COLOR}' mask='url(#text-hole)'/></svg>`;

// --- Today Tasks State ---
export function setTodayTasks(newTasks) {
  todayTasks = Array.isArray(newTasks) ? newTasks : [];
}

// --- Snackbar ---
function getSnackbarProgressBar() {
  let progressBar = snackbar?.querySelector(".snackbar-progress");
  if (!progressBar && snackbar) {
    progressBar = document.createElement("div");
    progressBar.className = "snackbar-progress";
    snackbar.appendChild(progressBar);
  }
  return progressBar;
}

function startSnackbarProgress(duration) {
  const progressBar = getSnackbarProgressBar();
  if (!progressBar) return;

  snackbarStartTime = Date.now();
  snackbarDuration = duration;

  clearInterval(snackbarProgressIntervalId); // Clear previous interval

  const updateProgress = () => {
    const elapsedTime = Date.now() - snackbarStartTime;
    const remainingTime = Math.max(0, snackbarDuration - elapsedTime);
    const progress = (remainingTime / snackbarDuration) * 100;
    const currentProgressBar = snackbar?.querySelector(".snackbar-progress");
    if (currentProgressBar) currentProgressBar.style.width = `${progress}%`;

    if (remainingTime <= 0) {
      clearInterval(snackbarProgressIntervalId);
    }
  };

  snackbarProgressIntervalId = setInterval(updateProgress, 50);
  updateProgress(); // Initial call
}

function stopSnackbarProgress() {
  clearInterval(snackbarProgressIntervalId);
  const progressBar = getSnackbarProgressBar();
  if (progressBar) {
    progressBar.style.width = "0%";
    // Ensure it's hidden when stopped
    progressBar.style.display = "none";
  }
}

export function showSnackbar(messageKey, isError = false, duration = 3000) {
  if (!snackbar) return;
  const lang = localStorage.getItem("language") || "ru";

  // Hide progress bar for simple info/success messages (like 'Task restored') and errors
  const simpleInfoMessages = [
    "taskLinkCopied",
    "taskRestored",
    "recurrenceRestored",
    "importingDatabase",
    "importSuccess",
  ];
  const hideProgressBar = isError || simpleInfoMessages.includes(messageKey);

  if (hideProgressBar) {
    duration = 2500; // Shorter display time for confirmation/error/simple info
  }

  const message = translations[lang]?.[messageKey] || messageKey;

  clearTimeout(snackbarTimeoutId);
  stopSnackbarProgress(); // Stop any previous progress
  clearTimeout(deleteTimeoutId);
  clearTimeout(recurrenceTimeoutId);

  snackbarText.textContent = message;
  snackbarUndoButton.style.display = "none"; // Ensure Undo is hidden by default

  // Ensure content structure is correct
  let contentWrapper = snackbar.querySelector(".snackbar-content");
  if (!contentWrapper) {
    snackbar.innerHTML = ""; // Clear completely
    contentWrapper = document.createElement("div");
    contentWrapper.className = "snackbar-content";
    snackbar.appendChild(contentWrapper); // Add wrapper first
    getSnackbarProgressBar(); // Ensure progress bar exists AFTER wrapper
  }
  contentWrapper.innerHTML = ""; // Clear only the content wrapper
  contentWrapper.appendChild(snackbarText); // Add text first
  // snackbarUndoButton is not added here, only in showUndoSnackbar

  // Handle progress bar visibility and state
  const progressBar = getSnackbarProgressBar(); // Get it again after ensuring structure
  if (progressBar) {
    if (hideProgressBar) {
      progressBar.style.display = "none";
      stopSnackbarProgress(); // Ensure interval is cleared if hiding
    } else {
      progressBar.style.display = "block";
      progressBar.style.width = "100%"; // Reset width for new animation
      startSnackbarProgress(duration); // Start progress only if needed
    }
  }

  snackbar.className = "snackbar show";
  snackbar.style.backgroundColor = isError ? "#d32f2f" : "#333";

  // Set timeout to hide the snackbar
  snackbarTimeoutId = setTimeout(() => {
    if (snackbar) snackbar.className = snackbar.className.replace("show", "");
    stopSnackbarProgress(); // Ensure progress stops when hiding
  }, duration);
}

// Shows a snackbar with an Undo button.
function showUndoSnackbar(
  messageKey,
  undoCallback,
  timeoutAction, // Action to perform if Undo is NOT clicked
  duration = 7000,
) {
  if (!snackbar) return;
  const lang = localStorage.getItem("language") || "ru";
  const message = translations[lang]?.[messageKey] || messageKey;
  const undoText = translations[lang]?.undo || "Undo";

  clearTimeout(snackbarTimeoutId);
  stopSnackbarProgress();
  clearTimeout(deleteTimeoutId);
  clearTimeout(recurrenceTimeoutId);

  snackbarText.textContent = message;
  snackbarUndoButton.textContent = undoText;
  snackbarUndoButton.style.display = "inline-block"; // Make Undo visible
  snackbarUndoButton.className = "snackbar-button";
  snackbarUndoButton.onclick = () => {
    clearTimeout(snackbarTimeoutId);
    stopSnackbarProgress();
    clearTimeout(deleteTimeoutId); // Prevent timeout action
    clearTimeout(recurrenceTimeoutId); // Prevent timeout action
    snackbar.className = snackbar.className.replace("show", "");

    // --- Updated Undo Callback Execution ---
    if (undoCallback) undoCallback(); // Call the specific undo logic

    // Clear relevant undo state *after* callback runs successfully
    if (messageKey === "taskDeleted") {
      lastDeletedTaskData = null;
    } else if (messageKey === "recurrenceRemoved") {
      lastClearedRecurrence = null;
    }
  };

  // Ensure content structure, including Undo button
  let contentWrapper = snackbar.querySelector(".snackbar-content");
  if (!contentWrapper) {
    snackbar.innerHTML = "";
    contentWrapper = document.createElement("div");
    contentWrapper.className = "snackbar-content";
    snackbar.appendChild(contentWrapper);
    getSnackbarProgressBar(); // Ensure progress bar exists
  }
  contentWrapper.innerHTML = ""; // Clear content
  contentWrapper.appendChild(snackbarText); // Add text
  contentWrapper.appendChild(snackbarUndoButton); // Add Undo button

  // Handle progress bar for Undo snackbars (always show)
  const progressBar = getSnackbarProgressBar();
  if (progressBar) {
    progressBar.style.display = "block"; // Ensure visible
    progressBar.style.width = "100%"; // Reset width
    startSnackbarProgress(duration); // Start progress
  }

  snackbar.className = "snackbar show";
  snackbar.style.backgroundColor = "#333";

  // Timeout action setup remains the same
  const timeoutActionWrapper = () => {
    if (timeoutAction) timeoutAction();
    if (snackbar) snackbar.className = snackbar.className.replace("show", "");
    stopSnackbarProgress();
    // Clear relevant undo state *after* action is confirmed/timeout expires
    if (messageKey === "taskDeleted") {
      lastDeletedTaskData = null;
    } else if (messageKey === "recurrenceRemoved") {
      lastClearedRecurrence = null;
    }
  };

  const timeoutId = setTimeout(timeoutActionWrapper, duration);

  if (messageKey === "taskDeleted") deleteTimeoutId = timeoutId;
  else if (messageKey === "recurrenceRemoved") recurrenceTimeoutId = timeoutId;
  snackbarTimeoutId = timeoutId;
}

// --- Popup Management ---
export function toggleSettingsPopup() {
  isSettingsOpen = !isSettingsOpen;
  if (settingsPopup)
    settingsPopup.style.display = isSettingsOpen ? "block" : "none";
  if (isSettingsOpen) {
    // Ensure checkboxes reflect current settings when opening
    const fullWeekdaysCheckbox = document.getElementById(
      "full-weekdays-checkbox",
    );
    if (fullWeekdaysCheckbox) {
      fullWeekdaysCheckbox.checked =
        localStorage.getItem("fullWeekdays") === "true";
      handleCheckboxChange(fullWeekdaysCheckbox);
    }
    const wrapTitlesCheckbox = document.getElementById(
      "wrap-task-titles-checkbox",
    );
    if (wrapTitlesCheckbox) {
      let wrapTitles = localStorage.getItem("wrapTaskTitles") !== "false";
      if (localStorage.getItem("wrapTaskTitles") === null)
        wrapTitles = initialWrapTaskTitles;
      wrapTitlesCheckbox.checked = wrapTitles;
      handleCheckboxChange(wrapTitlesCheckbox);
    }
  }
}

// Closes the most recently opened/top-most popup on Escape key or overlay click.
export function closeAllPopups() {
  if (taskDetailsPopupOverlay?.style.display === "flex") {
    closeTaskDetailsPopup();
    return;
  }
  if (isSettingsOpen) {
    isSettingsOpen = false;
    if (settingsPopup) settingsPopup.style.display = "none";
    return;
  }
  if (
    datePickerVisible &&
    datePickerContainer &&
    taskDetailsPopupOverlay?.style.display !== "flex"
  ) {
    datePickerContainer.style.display = "none";
    datePickerVisible = false;
    return;
  }
  if (isSearchOpen) {
    closeSearchPopup();
    return;
  }
}

function closeSearchPopup() {
  isSearchOpen = false;
  if (fuzzySearchPopup) fuzzySearchPopup.style.display = "none";
  if (fuzzySearchResultsList) fuzzySearchResultsList.innerHTML = "";
  const searchInput = document.getElementById("fuzzy-search-input");
  if (searchInput) {
    searchInput.value = "";
  }
  removeScrollListener();
  if (fuzzySearchResultsList)
    fuzzySearchResultsList.classList.remove("scrollable");
}

export function handleGlobalClick(event) {
  // Close Settings
  if (
    isSettingsOpen &&
    settingsPopup &&
    !settingsPopup.contains(event.target) &&
    !event.target.closest("#settings-btn")
  ) {
    toggleSettingsPopup();
  }
  // Close Search
  const fuzzySearchInnerDiv = fuzzySearchPopup?.querySelector("div");
  if (
    isSearchOpen &&
    fuzzySearchInnerDiv &&
    !fuzzySearchInnerDiv.contains(event.target) &&
    !event.target.closest("#search-btn")
  ) {
    closeSearchPopup();
  }
  // Close Date Picker (only if task details is NOT open)
  if (
    datePickerVisible &&
    datePickerContainer &&
    !datePickerContainer.contains(event.target) &&
    !event.target.closest("#task-details-date")
  ) {
    if (taskDetailsPopupOverlay?.style.display !== "flex") {
      datePickerContainer.style.display = "none";
      datePickerVisible = false;
    }
  }
  // Close Task Details on overlay click (ignore if text is selected)
  if (
    event.target === taskDetailsPopupOverlay &&
    window.getSelection().toString().length === 0
  ) {
    closeTaskDetailsPopup();
  }
  // Close Search on overlay click
  if (event.target === fuzzySearchPopup) {
    closeSearchPopup();
  }
}

// --- Theme Management ---
export function setTheme(theme) {
  const body = document.body;
  body.classList.remove("dark-theme", "light-theme");
  let resolvedTheme = theme;

  if (theme === "dark") {
    body.classList.add("dark-theme");
    resolvedTheme = "dark";
  } else if (theme === "light") {
    body.classList.add("light-theme");
    resolvedTheme = "light";
  } else {
    // Auto theme based on system preference
    const prefersDark = window.matchMedia?.(
      "(prefers-color-scheme: dark)",
    ).matches;
    if (prefersDark) {
      body.classList.add("dark-theme");
      resolvedTheme = "dark";
    } else {
      body.classList.add("light-theme");
      resolvedTheme = "light";
    }
  }

  // Update dynamic elements based on theme
  document.querySelectorAll(".event").forEach((event) => {
    const color = event.dataset.taskColor;
    event.style.backgroundColor = getTaskBackgroundColor(color);
  });
  const inboxDiv = document.getElementById("inbox");
  if (inboxDiv) {
    inboxDiv.style.backgroundColor =
      resolvedTheme === "dark"
        ? "var(--inbox-bg-dark)"
        : "var(--inbox-bg-light)";
  }

  requestAnimationFrame(updateSelectArrowsColor);
  updateTabTitle(); // Includes favicon update
  const themeSelect = document.getElementById("theme-select");
  if (themeSelect) themeSelect.value = theme;
}

export function getTaskBackgroundColor(color) {
  const currentThemeSetting = localStorage.getItem("theme") || "auto";
  if (!color || color === "no-color") return "transparent";

  const theme =
    currentThemeSetting === "auto"
      ? window.matchMedia?.("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : currentThemeSetting;

  const colorVar = `var(--task-color-${color}-${theme})`;
  const style = getComputedStyle(document.documentElement);
  return style.getPropertyValue(`--task-color-${color}-${theme}`)
    ? colorVar
    : "transparent";
}

// --- Localization & Settings ---
export async function updateSettingsText() {
  const lang = localStorage.getItem("language") || "ru";
  await updateTranslations(lang);
  updateSettingsLanguageSelector(lang);
}

export function updateSettingsLanguageSelector(currentLang) {
  const languageSelectPopup = document.getElementById("language-select-popup");
  if (languageSelectPopup) languageSelectPopup.value = currentLang;
}

// --- Task Details Popup ---
export async function openTaskDetails(taskId) {
  // Clear pending undos for *other* tasks immediately
  clearTimeout(deleteTimeoutId);
  if (lastDeletedTaskData?.id && lastDeletedTaskData.id !== taskId) {
    // *** Perform the final delete API call for the *other* task ***
    await api.deleteTask(lastDeletedTaskData.id);
    // Remove the *other* task's element from the DOM if it still exists
    const otherTaskElement = document.querySelector(
      `.event[data-task-id="${lastDeletedTaskData.id}"]`,
    );
    if (otherTaskElement) otherTaskElement.remove();
  }
  if (
    recurrenceTimeoutId &&
    currentTaskBeingViewed &&
    currentTaskBeingViewed !== taskId &&
    lastClearedRecurrence?.taskId !== taskId
  ) {
    if (lastClearedRecurrence?.taskId) {
      await api.updateTask(lastClearedRecurrence.taskId, {
        recurrence_rule: "",
        recurrence_interval: 1,
      });
    }
    clearTimeout(recurrenceTimeoutId);
  }
  // Reset undo state before opening new details
  lastDeletedTaskData = null;
  deleteTimeoutId = null;
  lastClearedRecurrence = null;
  recurrenceTimeoutId = null;
  recurrenceOpenedForNonRecurring = false;

  currentTaskBeingViewed = taskId;
  const lang = localStorage.getItem("language") || "ru";

  try {
    const task = await api.fetchTaskDetails(taskId);
    if (!task) {
      showSnackbar("errorTaskNotFound", true);
      currentTaskBeingViewed = null;
      return;
    }

    const taskIdForListener = taskId; // Capture for listeners to check context
    const isCompleted = task.completed === 1;

    // Replace Title Input to ensure clean state and listeners
    const oldTitleInput = document.getElementById("task-details-title");
    if (oldTitleInput) {
      const newTitleInput = oldTitleInput.cloneNode(true);
      newTitleInput.value = task.title;
      oldTitleInput.parentNode.replaceChild(newTitleInput, oldTitleInput);

      newTitleInput.addEventListener("blur", async () => {
        if (currentTaskBeingViewed !== taskIdForListener) return; // Check context
        const newTitle = newTitleInput.value.trim();
        if (newTitle !== task.title && newTitle !== "") {
          try {
            await api.updateTask(taskIdForListener, { title: newTitle });
            tasks.reRenderTaskElement(taskIdForListener); // Update list view
            updateFavicon(todayTasks.filter((t) => t.completed === 0).length);
          } catch (error) {
            console.error(`Error updating title:`, error);
            newTitleInput.value = task.title; // Revert on error
            showSnackbar("failedToSaveTitle", true);
          }
        } else if (newTitle === "") {
          newTitleInput.value = task.title; // Prevent empty title
        }
      });
      newTitleInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") newTitleInput.blur();
      });
    }

    // Update Date Picker Input
    if (taskDetailsDateInput) {
      if (task.due_date) {
        const dueDateUTC = utils.parseDateUTC(task.due_date);
        datePickerCurrentDate = dueDateUTC;
        taskDetailsDateInput.dataset.selectedDate = task.due_date;
        taskDetailsDateInput.textContent = dueDateUTC.toLocaleDateString(
          lang,
          utils.datePickerFormatOptions,
        );
      } else {
        datePickerCurrentDate = new Date(); // Reset for picker
        taskDetailsDateInput.dataset.selectedDate = "";
        taskDetailsDateInput.textContent =
          translations[lang]?.pickADate || "Pick a date";
      }
    }
    // Hide/Show "Remove Date" button based on initial state
    const datePickerResetButton = document.getElementById(
      "date-picker-reset-date",
    );
    if (datePickerResetButton) {
      datePickerResetButton.style.display = task.due_date
        ? "inline-block"
        : "none";
    }

    // Update Recurrence Section
    const currentRule = task.recurrence_rule || "";
    if (recurrencePeriodSelect)
      recurrencePeriodSelect.value = currentRule || "daily";
    if (recurrenceIntervalInput)
      recurrenceIntervalInput.value =
        task.recurrence_interval > 0 ? task.recurrence_interval : 1;
    if (recurringTaskDetailsBtn)
      recurringTaskDetailsBtn.style.display = task.due_date
        ? "inline-block"
        : "none";
    if (recurrenceSettingsContainer)
      recurrenceSettingsContainer.style.display = "none"; // Hide initially
    updateRecurrenceUI(currentRule && !!task.due_date ? currentRule : "");

    // Update Description Section
    const descriptionText = task.description || "";
    if (taskDescriptionTextarea)
      taskDescriptionTextarea.value = descriptionText;
    if (taskDescriptionRendered) {
      try {
        taskDescriptionRendered.innerHTML = marked.parse(descriptionText);
      } catch (e) {
        taskDescriptionRendered.textContent = "Error rendering description.";
      }
    }
    // Determine initial description mode based on content presence
    isDescriptionRenderedMode = descriptionText.trim() !== "";
    if (taskDescriptionRendered)
      taskDescriptionRendered.style.display = isDescriptionRenderedMode
        ? "block"
        : "none";
    if (taskDescriptionTextarea)
      taskDescriptionTextarea.style.display = isDescriptionRenderedMode
        ? "none"
        : "block";
    if (toggleDescriptionModeBtn)
      toggleDescriptionModeBtn.classList.toggle(
        "rendered-mode",
        isDescriptionRenderedMode,
      );
    if (descriptionModeIcon)
      descriptionModeIcon.className = isDescriptionRenderedMode
        ? "fas fa-pen"
        : "fas fa-book-open";

    // Update Color Swatches (replace to clear old listeners)
    document.querySelectorAll(".color-swatch").forEach((swatch) => {
      swatch.classList.remove("selected-color");
      const clonedSwatch = swatch.cloneNode(true);
      swatch.parentNode.replaceChild(clonedSwatch, swatch);
      clonedSwatch.addEventListener("click", handleColorSwatchClick);
    });
    const initialColor = task.color || "no-color";
    const swatchToSelect = document.querySelector(
      `.color-swatch[data-color="${initialColor}"]`,
    );
    if (swatchToSelect) swatchToSelect.classList.add("selected-color");

    // Update Action Buttons State
    updateMarkAsDoneButton(isCompleted);
    if (copyTaskLinkBtn) copyTaskLinkBtn.onclick = handleCopyTaskLinkClick; // Re-attach listener

    // Show Popup and Adjust UI
    if (taskDetailsPopupOverlay) taskDetailsPopupOverlay.style.display = "flex";
    requestAnimationFrame(() => {
      adjustTextareaHeight();
      const titleInputForFocus = document.getElementById("task-details-title");
      if (titleInputForFocus) titleInputForFocus.focus(); // Focus the potentially replaced input
      updateRecurrencePreview();
    });
  } catch (error) {
    console.error(`Error opening task details:`, error);
    showSnackbar("errorLoadingTaskDetails", true);
    currentTaskBeingViewed = null;
  }
}

async function handleColorSwatchClick(event) {
  const swatch = event.target.closest(".color-swatch");
  if (!currentTaskBeingViewed || !swatch || !swatch.matches(".color-swatch"))
    return;

  const selectedColor = swatch.dataset.color;
  const currentColorSwatch = document.querySelector(
    ".color-swatch.selected-color",
  );
  if (swatch === currentColorSwatch) return; // No change

  if (currentColorSwatch) currentColorSwatch.classList.remove("selected-color");
  swatch.classList.add("selected-color");

  const colorToSave = selectedColor === "no-color" ? "" : selectedColor;
  const taskElement = document.querySelector(
    `.event[data-task-id="${currentTaskBeingViewed}"]`,
  );

  // Optimistic UI update
  if (taskElement) {
    taskElement.dataset.taskColor = colorToSave;
    taskElement.style.backgroundColor = getTaskBackgroundColor(
      colorToSave || null,
    );
  }
  const updatedTodayTasks = todayTasks.map((t) =>
    t.id === currentTaskBeingViewed ? { ...t, color: colorToSave } : t,
  );
  setTodayTasks(updatedTodayTasks);

  try {
    await api.updateTask(currentTaskBeingViewed, { color: colorToSave });
  } catch (error) {
    showSnackbar("failedToSaveColor", true);
    // Revert UI on error
    swatch.classList.remove("selected-color");
    let originalColor = "";
    if (currentColorSwatch) {
      currentColorSwatch.classList.add("selected-color");
      originalColor =
        currentColorSwatch.dataset.color === "no-color"
          ? ""
          : currentColorSwatch.dataset.color;
    }
    if (taskElement) {
      taskElement.dataset.taskColor = originalColor;
      taskElement.style.backgroundColor = getTaskBackgroundColor(
        originalColor || null,
      );
    }
    setTodayTasks(
      todayTasks.map((t) =>
        t.id === currentTaskBeingViewed ? { ...t, color: originalColor } : t,
      ),
    );
  }
}

// Make the function async and implement fallback
async function handleCopyTaskLinkClick() {
  if (!currentTaskBeingViewed) return;
  const taskLink = `${window.location.origin}/#task/${currentTaskBeingViewed}`;
  let success = false;

  // Try modern Clipboard API first (preferred)
  // Check for navigator object, clipboard property, and secure context
  // The check window.isSecureContext implicitly handles the unsecured connection case.
  if (
    typeof navigator !== "undefined" &&
    navigator.clipboard &&
    window.isSecureContext
  ) {
    console.log("Using Clipboard API for copy.");
    try {
      await navigator.clipboard.writeText(taskLink);
      success = true;
    } catch (err) {
      console.error("Clipboard API failed:", err);
    }
  } else {
    if (typeof navigator === "undefined") {
      console.warn("Navigator object is undefined. Skipping Clipboard API.");
    } else if (!navigator.clipboard) {
      console.warn(
        "navigator.clipboard API is not available. Skipping Clipboard API.",
      );
    } else if (!window.isSecureContext) {
      console.warn("Context is not secure (HTTP). Skipping Clipboard API.");
    }
  }

  // Fallback using document.execCommand if Clipboard API was unavailable or failed
  if (!success) {
    console.warn(
      "Clipboard API unavailable or failed. Using fallback copy method.",
    );
    const textArea = document.createElement("textarea");
    textArea.value = taskLink;
    // Style to be invisible and prevent scrolling issues
    textArea.style.position = "fixed";
    textArea.style.top = "0";
    textArea.style.left = "-9999px";
    textArea.style.opacity = "0"; // Make visually hidden
    textArea.setAttribute("readonly", ""); // Prevent keyboard popup on mobile

    document.body.appendChild(textArea);
    textArea.select(); // Select the text node's content
    textArea.setSelectionRange(0, textArea.value.length); // Ensure selection works on mobile

    try {
      // Use execCommand
      success = document.execCommand("copy");
      if (!success) {
        console.error("Fallback execCommand('copy') failed.");
      }
    } catch (err) {
      console.error("Error during fallback execCommand('copy'):", err);
      success = false; // Ensure success is false on error
    }

    document.body.removeChild(textArea); // Clean up the temporary element

    // Deselect text after copy (good practice)
    if (window.getSelection) {
      window.getSelection().removeAllRanges();
    } else if (document.selection) {
      // Older IE
      document.selection.empty();
    }
  }

  // Show feedback based on success
  if (success) {
    showSnackbar("taskLinkCopied");
    // Keep the spinning animation feedback
    if (copyTaskLinkBtn) {
      copyTaskLinkBtn.classList.add("spinning");
      setTimeout(() => {
        if (copyTaskLinkBtn) {
          // Check if button still exists
          copyTaskLinkBtn.classList.remove("spinning");
        }
      }, 1000);
    }
  } else {
    // Use translation key for failure message
    showSnackbar("taskLinkCopyFailed", true);
  }
}

// Closes the task details popup and resets associated state.
export function closeTaskDetailsPopup() {
  // Check if recurrence was opened for a non-recurring task and needs saving on close
  if (recurrenceOpenedForNonRecurring && currentTaskBeingViewed) {
    const ruleInUI = recurrencePeriodSelect?.value;
    const controlsVisible = recurrenceControls?.style.display === "flex";
    if (controlsVisible && ruleInUI) {
      console.log(
        "Closing popup: Saving default recurrence settings for task",
        currentTaskBeingViewed,
      );
      saveRecurrenceSettings(); // Fire and forget save
    }
  }
  recurrenceOpenedForNonRecurring = false; // Reset flag

  if (taskDetailsPopupOverlay) taskDetailsPopupOverlay.style.display = "none";
  if (datePickerContainer) datePickerContainer.style.display = "none";
  datePickerVisible = false;
  currentTaskBeingViewed = null;

  // Clear inputs/state related to the closed popup
  const titleInput = document.getElementById("task-details-title");
  if (titleInput) titleInput.value = "";
  if (taskDescriptionTextarea) taskDescriptionTextarea.value = "";
  if (taskDescriptionRendered) taskDescriptionRendered.innerHTML = "";
  clearRecurrenceInPopup(false); // Clear UI without adjusting height
  if (recurrenceSettingsContainer)
    recurrenceSettingsContainer.style.display = "none";
}

// Adjusts the height of the description textarea/rendered view based on available space.
export function adjustTextareaHeight() {
  if (taskDetailsPopupOverlay?.style.display !== "flex") return;
  const popupContent = taskDetailsPopup?.querySelector(
    ".task-details-popup-content",
  );
  const titleInputEl = document.getElementById("task-details-title");
  if (!popupContent || !taskDetailsPopup || !titleInputEl) return;

  const popupHeight = taskDetailsPopup.offsetHeight;
  const topBarHeight =
    taskDetailsPopup.querySelector(".task-popup-top-bar")?.offsetHeight || 0;
  const titleHeight = titleInputEl.offsetHeight || 0;
  const titleMarginBottom =
    parseInt(getComputedStyle(titleInputEl).marginBottom) || 0;
  const recurrenceHeight =
    recurrenceSettingsContainer?.style.display === "none"
      ? 0
      : recurrenceSettingsContainer?.offsetHeight || 0;
  const descLabelHeight =
    popupContent.querySelector('label[for="task-description-textarea"]')
      ?.offsetHeight || 0;

  const availableHeight = Math.max(
    0,
    popupHeight -
      topBarHeight -
      titleHeight -
      titleMarginBottom -
      recurrenceHeight -
      descLabelHeight -
      40, // Approx padding/margins
  );

  const elementToAdjust = isDescriptionRenderedMode
    ? taskDescriptionRendered
    : taskDescriptionTextarea;
  const otherElement = isDescriptionRenderedMode
    ? taskDescriptionTextarea
    : taskDescriptionRendered;
  if (!elementToAdjust || !otherElement) return;

  otherElement.style.display = "none";
  elementToAdjust.style.display = "block";
  elementToAdjust.style.height = "auto"; // Reset first to measure scrollHeight correctly
  const scrollHeight = elementToAdjust.scrollHeight;
  const minHeight = 50;
  let targetHeight = Math.max(
    minHeight,
    Math.min(scrollHeight, availableHeight),
  );
  elementToAdjust.style.height = `${targetHeight}px`;
  popupContent.style.overflowY = "auto";
}

export function updateMarkAsDoneButton(isCompleted) {
  if (!markDoneTaskDetailsBtn) return;
  const lang = localStorage.getItem("language") || "ru";
  markDoneTaskDetailsBtn.dataset.completed = isCompleted ? "1" : "0";
  markDoneTaskDetailsBtn.innerHTML = isCompleted
    ? '<i class="fas fa-check-circle"></i>'
    : '<i class="far fa-check-circle"></i>';
  markDoneTaskDetailsBtn.title = isCompleted
    ? translations[lang]?.markAsUndone || "Mark as undone"
    : translations[lang]?.markAsDone || "Mark as done";
}

// Updates the UI of a task item (in the calendar/inbox list) when completed/uncompleted.
export function handleTaskCompletionUI(taskElement, completed) {
  const doneButton = taskElement.querySelector(".done-button");
  const undoneButton = taskElement.querySelector(".undone-button");
  const taskTextElement = taskElement.querySelector(".task-text");
  if (taskTextElement)
    taskTextElement.classList.toggle("completed", completed === 1);
  if (doneButton)
    doneButton.style.display = completed === 1 ? "none" : "inline-block";
  if (undoneButton)
    undoneButton.style.display = completed === 0 ? "none" : "inline-block";
  // Sync the popup button if this task is currently being viewed
  if (currentTaskBeingViewed === parseInt(taskElement.dataset.taskId)) {
    updateMarkAsDoneButton(completed === 1);
  }
}

// --- Event Listeners Setup ---
function setupActionListeners() {
  // Description saving on blur
  if (taskDescriptionTextarea) {
    taskDescriptionTextarea.addEventListener("blur", async (event) => {
      const taskIdForUpdate = currentTaskBeingViewed;
      if (!taskIdForUpdate) return;
      try {
        const task = await api.fetchTaskDetails(taskIdForUpdate);
        if (!task) return;
        const oldDescription = task.description || "";
        const newDescription = event.target.value;
        if (
          newDescription !== oldDescription &&
          currentTaskBeingViewed === taskIdForUpdate // Double check context
        ) {
          await api.updateTask(taskIdForUpdate, {
            description: newDescription,
          });
          tasks.reRenderTaskElement(taskIdForUpdate); // Update list view (e.g., progress)
          // If rendered mode is active, update the rendered view too
          if (isDescriptionRenderedMode && taskDescriptionRendered) {
            try {
              taskDescriptionRendered.innerHTML = marked.parse(newDescription);
            } catch (e) {}
          }
        }
        // Adjust height even if no change, in case content caused resize
        if (currentTaskBeingViewed === taskIdForUpdate) adjustTextareaHeight();
      } catch (error) {
        console.error(`Error saving description:`, error);
        showSnackbar("Failed to save description.", true);
      }
    });
  }

  if (closeTaskDetailsPopupBtn)
    closeTaskDetailsPopupBtn.addEventListener("click", closeTaskDetailsPopup);

  // Delete Task Button with Undo
  if (deleteTaskDetailsBtn) {
    deleteTaskDetailsBtn.addEventListener("click", async () => {
      const taskIdToDelete = currentTaskBeingViewed;
      if (!taskIdToDelete) return;

      const taskElement = document.querySelector(
        // Find the element *before* potentially closing popup
        `.event[data-task-id="${taskIdToDelete}"]`,
      );

      try {
        // Store original task data *needed for re-rendering*
        lastDeletedTaskData = await api.fetchTaskDetails(taskIdToDelete);
        if (!lastDeletedTaskData) throw new Error("Failed fetch for undo.");

        // Optimistic UI: Hide immediately *if the element exists in the current view*
        if (taskElement) {
          taskElement.style.display = "none";
        } else {
          // If element not found (e.g., task details opened via link, view not rendered yet)
          // Still proceed, but undo will rely solely on re-rendering the correct view.
          console.log(
            "Task element not found in current view for optimistic hide.",
          );
        }

        // Update today's task state if applicable
        const taskIndex = todayTasks.findIndex((t) => t.id === taskIdToDelete);
        if (taskIndex > -1) {
          setTodayTasks([
            ...todayTasks.slice(0, taskIndex),
            ...todayTasks.slice(taskIndex + 1),
          ]);
        }
        updateTabTitle(); // Update favicon

        // Close popup if the deleted task was being viewed
        if (currentTaskBeingViewed === taskIdToDelete) {
          closeTaskDetailsPopup();
        }

        // --- Show Undo Snackbar ---
        showUndoSnackbar(
          "taskDeleted",
          // --- Undo Callback (Re-render) ---
          async () => {
            const taskDataToRestore = lastDeletedTaskData; // Capture before clearing state
            // Clear local undo state *immediately* upon clicking Undo
            lastDeletedTaskData = null;
            deleteTimeoutId = null;

            if (taskDataToRestore) {
              // Trigger a re-render of the appropriate container
              if (taskDataToRestore.due_date) {
                const weekStart = utils.getStartOfWeek(
                  utils.parseDateUTC(taskDataToRestore.due_date),
                );
                // Check if the week to re-render is the currently displayed one
                if (
                  weekStart.toISOString().split("T")[0] ===
                  getDisplayedWeekStartDate().toISOString().split("T")[0]
                ) {
                  await calendar.renderWeekCalendar(weekStart);
                }
                // If not the current week, the task will appear when user navigates there.
              } else {
                await calendar.renderInbox(); // Re-render inbox
              }
              updateTabTitle(); // Refresh today's tasks count / favicon
              showSnackbar("taskRestored");
            }
          },
          // --- Timeout Action (Permanent Delete API Call) ---
          async () => {
            const idToDelete = lastDeletedTaskData?.id; // Capture ID before clearing state
            // Clear undo state *first*
            lastDeletedTaskData = null;
            deleteTimeoutId = null; // Timeout already fired, but clear for safety

            if (idToDelete) {
              const deleted = await api.deleteTask(idToDelete);
              if (!deleted) {
                // If API delete fails *after timeout*, show error and potentially refresh UI
                showSnackbar("failedToDeleteTask", true);
                // Attempt to refresh the view where the task *should* have been
                // This is a fallback in case the optimistic hide failed or state is inconsistent
                try {
                  const potentiallyFailedTask =
                    await api.fetchTaskDetails(idToDelete);
                  if (potentiallyFailedTask) {
                    // Re-render the view where the task still exists according to the backend
                    if (potentiallyFailedTask.due_date) {
                      const weekStart = utils.getStartOfWeek(
                        utils.parseDateUTC(potentiallyFailedTask.due_date),
                      );
                      // Check if the week to re-render is the currently displayed one
                      if (
                        weekStart.toISOString().split("T")[0] ===
                        getDisplayedWeekStartDate().toISOString().split("T")[0]
                      ) {
                        await calendar.renderWeekCalendar(weekStart);
                      }
                    } else {
                      await calendar.renderInbox();
                    }
                  }
                } catch (fetchError) {
                  /* ignore if task truly gone */
                }
                updateTabTitle(); // Refresh state/UI based on actual backend state
              }
              // If API delete *succeeds*, the task is already visually hidden (or gone after re-render)
            }
          },
        );
      } catch (error) {
        console.error("Error preparing deletion:", error);
        showSnackbar("failedToDeleteTask", true);
        // Clear undo state on error
        lastDeletedTaskData = null;
        deleteTimeoutId = null;
        if (taskElement) taskElement.style.display = ""; // Restore visibility if hidden
        updateTabTitle(); // Refresh state/UI
      }
    });
  }

  // Description Mode Toggle
  if (toggleDescriptionModeBtn) {
    toggleDescriptionModeBtn.addEventListener("click", () => {
      isDescriptionRenderedMode = !isDescriptionRenderedMode;
      const displayRendered = isDescriptionRenderedMode ? "block" : "none";
      const displayTextArea = isDescriptionRenderedMode ? "none" : "block";

      if (taskDescriptionRendered)
        taskDescriptionRendered.style.display = displayRendered;
      if (taskDescriptionTextarea)
        taskDescriptionTextarea.style.display = displayTextArea;
      if (toggleDescriptionModeBtn)
        toggleDescriptionModeBtn.classList.toggle(
          "rendered-mode",
          isDescriptionRenderedMode,
        );
      if (descriptionModeIcon)
        descriptionModeIcon.className = isDescriptionRenderedMode
          ? "fas fa-pen"
          : "fas fa-book-open";

      if (!isDescriptionRenderedMode && taskDescriptionTextarea) {
        taskDescriptionTextarea.focus();
      } else if (taskDescriptionRendered && taskDescriptionTextarea) {
        // Update rendered view immediately when switching to rendered mode
        try {
          taskDescriptionRendered.innerHTML = marked.parse(
            taskDescriptionTextarea.value,
          );
        } catch (e) {}
      }
      adjustTextareaHeight();
    });
  }

  // --- Date Picker Setup ---
  if (taskDetailsDateInput) {
    taskDetailsDateInput.addEventListener("click", (event) => {
      event.stopPropagation();
      datePickerVisible = !datePickerVisible;
      if (datePickerContainer)
        datePickerContainer.style.display = datePickerVisible
          ? "block"
          : "none";
      // Also update Remove Date button visibility when picker opens
      const currentSelectedDate = taskDetailsDateInput?.dataset.selectedDate;
      const datePickerResetButton = document.getElementById(
        "date-picker-reset-date",
      );
      if (datePickerResetButton) {
        datePickerResetButton.style.display = currentSelectedDate
          ? "inline-block"
          : "none";
      }
      if (datePickerVisible) {
        renderDatePicker();
        positionDatePicker();
      }
    });
  }
  if (datePickerContainer)
    datePickerContainer.addEventListener("click", (e) => e.stopPropagation()); // Prevent closing picker on internal click
  document
    .getElementById("date-picker-prev-month")
    ?.addEventListener("click", () => {
      datePickerCurrentDate.setUTCMonth(
        datePickerCurrentDate.getUTCMonth() - 1,
      );
      renderDatePicker();
    });
  document
    .getElementById("date-picker-next-month")
    ?.addEventListener("click", () => {
      datePickerCurrentDate.setUTCMonth(
        datePickerCurrentDate.getUTCMonth() + 1,
      );
      renderDatePicker();
    });
  document
    .getElementById("date-picker-reset-date")
    ?.addEventListener("click", async () => {
      if (taskDetailsDateInput) {
        taskDetailsDateInput.dataset.selectedDate = "";
        const lang = localStorage.getItem("language") || "ru";
        taskDetailsDateInput.textContent =
          translations[lang]?.pickADate || "Pick a date";
      }
      // Hide the reset button after removing the date
      const resetButton = document.getElementById("date-picker-reset-date");
      if (resetButton) {
        resetButton.style.display = "none";
      }

      if (datePickerContainer) datePickerContainer.style.display = "none";
      datePickerVisible = false;
      recurrenceOpenedForNonRecurring = false; // Clear flag when removing date
      await updateTaskDueDate(null); // API call to remove date & clear recurrence
    });

  // --- Recurrence Listeners ---
  if (
    recurringTaskDetailsBtn &&
    recurrenceSettingsContainer &&
    recurrenceControls &&
    recurrencePeriodSelect &&
    taskDetailsDateInput
  ) {
    recurringTaskDetailsBtn.addEventListener("click", async () => {
      const hasDate = !!taskDetailsDateInput.dataset.selectedDate;
      // Cannot set recurrence without a date
      if (!hasDate) {
        clearRecurrenceInPopup(false);
        if (recurrenceSettingsContainer)
          recurrenceSettingsContainer.style.display = "none";
        recurringTaskDetailsBtn.classList.remove("active");
        adjustTextareaHeight();
        return;
      }

      const isCurrentlyActive =
        recurringTaskDetailsBtn.classList.contains("active");
      const isContainerVisible =
        recurrenceSettingsContainer.style.display !== "none";

      // --- Trying to Disable Recurrence ---
      if (isCurrentlyActive && isContainerVisible) {
        // If the "remove recurrence" snackbar is still active, clicking again confirms the undo
        if (
          recurrenceTimeoutId &&
          lastClearedRecurrence?.taskId === currentTaskBeingViewed
        ) {
          clearTimeout(recurrenceTimeoutId);
          snackbar.className = snackbar.className.replace("show", "");
          restoreRecurrenceUI(); // Restore UI immediately
          showSnackbar("recurrenceRestored");
          return; // Stop further processing
        }

        const taskIdForRecurrence = currentTaskBeingViewed; // Capture current task ID
        recurrenceOpenedForNonRecurring = false; // Clear flag on disable attempt
        try {
          const taskData = await api.fetchTaskDetails(currentTaskBeingViewed);
          if (!taskData) return;
          // Store data needed for potential undo
          lastClearedRecurrence = {
            rule: taskData.recurrence_rule || "",
            interval: taskData.recurrence_interval || 1,
            taskId: taskIdForRecurrence,
          };
          // If no rule was actually set, just hide the UI normally
          if (!lastClearedRecurrence.rule) {
            recurrenceSettingsContainer.style.display = "none";
            recurringTaskDetailsBtn.classList.remove("active");
            adjustTextareaHeight();
            lastClearedRecurrence = null; // Nothing to undo
            return;
          }

          // Optimistic UI: Clear and hide controls
          clearRecurrenceInPopup(false);
          recurrenceSettingsContainer.style.display = "none";
          adjustTextareaHeight();

          showUndoSnackbar(
            "recurrenceRemoved",
            restoreRecurrenceUI, // Undo Callback: Restore UI using stored state
            // Timeout Action (Permanent Clear)
            async () => {
              const idToClear = lastClearedRecurrence?.taskId; // Capture ID before clearing state
              // Clear undo state *first*
              lastClearedRecurrence = null;
              recurrenceTimeoutId = null;

              if (idToClear) {
                try {
                  await api.updateTask(idToClear, {
                    recurrence_rule: "",
                    recurrence_interval: 1,
                  });
                } catch (error) {
                  showSnackbar("failedToRemoveRecurrence", true);
                  // On API failure, UI remains cleared. User must re-enable if desired.
                  console.error("API failed, but not restoring UI.");
                  adjustTextareaHeight();
                }
              }
            },
          );
        } catch (error) {
          showSnackbar("failedToRemoveRecurrence", true);
          lastClearedRecurrence = null; // Clear state on error
          recurrenceTimeoutId = null;
        }
      }
      // --- Trying to Enable/Show Recurrence Settings ---
      else {
        recurrenceSettingsContainer.style.display = !isContainerVisible
          ? "block"
          : "none"; // Toggle visibility
        if (!isContainerVisible) {
          // If just opened: Check if task was non-recurring to set defaults & flag
          const task = await api.fetchTaskDetails(currentTaskBeingViewed);
          if (!task?.recurrence_rule) {
            recurrenceOpenedForNonRecurring = true; // Set flag for potential save on close
            if (recurrencePeriodSelect) recurrencePeriodSelect.value = "daily";
            if (recurrenceIntervalInput) recurrenceIntervalInput.value = 1;
          } else {
            recurrenceOpenedForNonRecurring = false; // Already recurring
          }
          updateRecurrenceUI(recurrencePeriodSelect?.value || "");
          updateRecurrencePreview();
        } else {
          // If closing manually via button click (while inactive/no rule set)
          recurringTaskDetailsBtn.classList.remove("active");
          recurrenceOpenedForNonRecurring = false; // Clear flag if closing manually
        }
        adjustTextareaHeight();
      }
    });
  }
  // Save recurrence immediately on changing period/interval
  if (recurrencePeriodSelect)
    recurrencePeriodSelect.addEventListener("change", saveRecurrenceSettings);
  if (recurrenceIntervalInput) {
    recurrenceIntervalInput.addEventListener("input", updateRecurrencePreview); // Preview on input
    recurrenceIntervalInput.addEventListener("change", () => {
      // Validate and save on actual change commit (blur, enter)
      let interval = parseInt(recurrenceIntervalInput.value, 10);
      if (isNaN(interval) || interval < 1) recurrenceIntervalInput.value = 1;
      if (recurrencePeriodSelect && !recurrencePeriodSelect.value)
        recurrencePeriodSelect.value = "daily"; // Default rule if needed
      recurrenceOpenedForNonRecurring = false; // Explicit change means user intends to save
      saveRecurrenceSettings();
    });
  }

  // --- Data Import/Export ---
  if (exportDbBtn) exportDbBtn.addEventListener("click", handleExportDb);
  if (importDbInput) importDbInput.addEventListener("change", handleImportDb);
}
setupActionListeners(); // Initialize listeners

// --- Search ---
export function toggleSearchPopup() {
  isSearchOpen = !isSearchOpen;
  if (fuzzySearchPopup)
    fuzzySearchPopup.style.display = isSearchOpen ? "flex" : "none";
  if (isSearchOpen) {
    const searchInput = document.getElementById("fuzzy-search-input");
    if (searchInput) searchInput.focus();
    if (fuzzySearchResultsList) {
      fuzzySearchResultsList.scrollTop = 0;
      fuzzySearchResultsList.innerHTML = "";
    }
    currentPage = 1;
    searchQuery = "";
    const input = document.getElementById("fuzzy-search-input");
    if (input) input.value = "";
    removeScrollListener();
    if (fuzzySearchResultsList)
      fuzzySearchResultsList.classList.remove("scrollable");
  } else closeSearchPopup();
}

export function handleSearchInput() {
  clearTimeout(searchTimeout);
  const input = document.getElementById("fuzzy-search-input");
  const query = input ? input.value.trim() : "";
  if (query !== searchQuery) {
    // Reset and search if query changed
    searchQuery = query;
    currentPage = 1;
    if (fuzzySearchResultsList) {
      fuzzySearchResultsList.scrollTop = 0;
      fuzzySearchResultsList.innerHTML = "";
    }
    removeScrollListener();
    searchTimeout = setTimeout(performSearch, 300); // Debounce search
  } else if (query === "" && fuzzySearchResultsList?.innerHTML !== "") {
    // Clear results if query becomes empty
    if (fuzzySearchResultsList) fuzzySearchResultsList.innerHTML = "";
    removeScrollListener();
    if (fuzzySearchResultsList)
      fuzzySearchResultsList.classList.remove("scrollable");
  }
}

async function performSearch() {
  if (fuzzySearchResultsList) {
    fuzzySearchResultsList.innerHTML = "";
    fuzzySearchResultsList.classList.remove("scrollable");
  }
  if (searchQuery.length === 0) {
    removeScrollListener();
    return;
  }
  loadingMoreResults = false; // Reset infinite scroll flag
  await displayFuzzySearchResults(searchQuery, currentPage, tasksPerPage);
}

async function displayFuzzySearchResults(query, page, pageSize) {
  if (!fuzzySearchResultsList || (loadingMoreResults && page > 1)) return;
  loadingMoreResults = true;
  try {
    const tasks = await api.searchTasks(query, pageSize, page);
    loadingMoreResults = false;
    if (tasks.length === 0 && page === 1) {
      // Display "No results" message
      const li = document.createElement("li");
      const lang = localStorage.getItem("language") || "ru";
      li.textContent =
        translations[lang]?.noResults || "No matching tasks found.";
      li.style.cursor = "default";
      fuzzySearchResultsList.appendChild(li);
      removeScrollListener();
    } else if (tasks.length > 0) {
      // Render task list items
      const lang = localStorage.getItem("language") || "ru";
      tasks.forEach((task) => {
        const listItem = document.createElement("li");
        listItem.dataset.taskId = task.id;
        if (task.completed === 1) listItem.classList.add("completed-task");
        let taskDateStr = translations[lang]?.newTaskSomeday || "Inbox Task";
        if (task.due_date) {
          try {
            taskDateStr = utils
              .parseDateUTC(task.due_date)
              .toLocaleDateString(lang, {
                day: "numeric",
                month: "short",
                timeZone: "UTC",
              });
          } catch (e) {
            taskDateStr = task.due_date; // Fallback
          }
        } else {
          taskDateStr = "Inbox"; // Explicitly "Inbox" if no date
        }
        listItem.innerHTML = `<div class="fuzzy-search-task-title">${task.title || "Untitled Task"}</div><div class="fuzzy-search-task-date">${taskDateStr}</div>`;
        const titleEl = listItem.querySelector(".fuzzy-search-task-title");
        if (titleEl && task.color && task.color !== "no-color")
          titleEl.classList.add(`${task.color}-title-highlight`);

        // Add click listener to navigate and highlight the task
        listItem.addEventListener("click", async () => {
          closeSearchPopup();
          try {
            const freshTask = await api.fetchTaskDetails(task.id);
            if (!freshTask) {
              showSnackbar("errorTaskNotFound", true);
              return;
            }
            if (freshTask.due_date) {
              // Navigate to the correct week and highlight
              const startOfWeek = utils.getStartOfWeek(
                utils.parseDateUTC(freshTask.due_date),
              );
              setDisplayedWeekStartDate(startOfWeek);
              await calendar.renderWeekCalendar(startOfWeek);
              highlightTask(task.id);
            } else {
              // Scroll to inbox and highlight
              await calendar.renderInbox();
              document
                .getElementById("inbox")
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
              highlightTask(task.id);
            }
          } catch (error) {
            showSnackbar("errorLoadingTaskDetails", true);
          }
        });
        fuzzySearchResultsList.appendChild(listItem);
      });
      // Infinite scroll setup
      if (tasks.length < pageSize) removeScrollListener();
      else setupScrollListener();
      // Add scrollable class if content overflows
      requestAnimationFrame(() => {
        if (fuzzySearchResultsList)
          fuzzySearchResultsList.classList.toggle(
            "scrollable",
            fuzzySearchResultsList.scrollHeight >
              fuzzySearchResultsList.clientHeight,
          );
      });
    } else removeScrollListener(); // No more results from API
  } catch (error) {
    console.error("Error fetching or displaying search results:", error);
    loadingMoreResults = false;
  }
}

function setupScrollListener() {
  if (!scrollEventListener && fuzzySearchResultsList) {
    scrollEventListener = async () => {
      // Load more results when scrolled near the bottom
      if (isSearchOpen && !loadingMoreResults && fuzzySearchResultsList) {
        if (
          fuzzySearchResultsList.scrollTop +
            fuzzySearchResultsList.clientHeight >=
          fuzzySearchResultsList.scrollHeight - 50 // Threshold
        ) {
          currentPage++;
          await displayFuzzySearchResults(
            searchQuery,
            currentPage,
            tasksPerPage,
          );
        }
      }
    };
    fuzzySearchResultsList.addEventListener("scroll", scrollEventListener);
  }
}

function removeScrollListener() {
  if (scrollEventListener && fuzzySearchResultsList) {
    fuzzySearchResultsList.removeEventListener("scroll", scrollEventListener);
    scrollEventListener = null;
  }
}

// --- Highlighting ---
// Briefly highlights a task element and scrolls it into view.
export function highlightTask(taskId) {
  setTimeout(() => {
    // Delay slightly to allow for rendering after navigation/updates
    const taskElement = document.querySelector(
      `.event[data-task-id="${taskId}"]`,
    );
    if (taskElement) {
      document
        .querySelectorAll(".highlighted-task")
        .forEach((el) => el.classList.remove("highlighted-task"));
      taskElement.classList.add("highlighted-task");
      taskElement.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "nearest",
      });
      // Remove highlight after a short duration
      setTimeout(() => {
        if (taskElement) taskElement.classList.remove("highlighted-task");
      }, 3000);
    }
  }, 100);
}

// --- Date Picker ---
function renderDatePicker() {
  if (!datePickerGrid || !datePickerMonthYear) return;
  const lang = localStorage.getItem("language") || "ru";
  const monthNames =
    translations[lang]?.monthNames || translations.en.monthNames;
  const dayNamesShort =
    translations[lang]?.dayNamesShort || translations.en.dayNamesShort;
  const year = datePickerCurrentDate.getUTCFullYear(),
    month = datePickerCurrentDate.getUTCMonth();
  const firstDayOfMonth = new Date(Date.UTC(year, month, 1));
  const startDayOfWeek = (firstDayOfMonth.getUTCDay() + 6) % 7; // 0=Mon
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  datePickerMonthYear.textContent = `${monthNames[month]} ${year}`;
  datePickerGrid.innerHTML = ""; // Clear previous grid

  // Add day headers (Mon-Sun)
  dayNamesShort.forEach((name) => {
    const el = document.createElement("div");
    el.classList.add("date-picker-day-name");
    el.textContent = name;
    datePickerGrid.appendChild(el);
  });

  // Add padding days from previous month
  for (let i = 0; i < startDayOfWeek; i++) {
    const emptyCell = document.createElement("div");
    emptyCell.classList.add("date-picker-day", "inactive");
    datePickerGrid.appendChild(emptyCell);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const selectedDateStr = taskDetailsDateInput?.dataset.selectedDate;

  // Add actual days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    const dayElement = document.createElement("div");
    dayElement.classList.add("date-picker-day");
    dayElement.textContent = day;
    const dayDateUTC = new Date(Date.UTC(year, month, day));
    const dayDateStr = dayDateUTC.toISOString().split("T")[0];
    const dayDateLocal = new Date(year, month, day); // Use local for today check

    if (selectedDateStr === dayDateStr) dayElement.classList.add("selected");
    if (dayDateLocal.toDateString() === today.toDateString())
      dayElement.classList.add("current-day");

    dayElement.addEventListener("click", () => handleDateSelection(dayDateStr));
    datePickerGrid.appendChild(dayElement);
  }

  // Add padding days from next month
  const totalCells = startDayOfWeek + daysInMonth;
  const remainingCells = (7 - (totalCells % 7)) % 7;
  for (let i = 0; i < remainingCells; i++) {
    const emptyCell = document.createElement("div");
    emptyCell.classList.add("date-picker-day", "inactive");
    datePickerGrid.appendChild(emptyCell);
  }
}

function positionDatePicker() {
  if (!datePickerVisible || !datePickerContainer || !taskDetailsDateInput)
    return;
  const inputRect = taskDetailsDateInput.getBoundingClientRect();
  datePickerContainer.style.position = "fixed";
  datePickerContainer.style.top = `${inputRect.bottom + 2}px`;
  let leftPos = inputRect.left;
  const pickerWidth = datePickerContainer.offsetWidth;
  // Adjust left position if it overflows viewport
  if (leftPos + pickerWidth > window.innerWidth - 10) {
    leftPos = window.innerWidth - pickerWidth - 10;
  }
  datePickerContainer.style.left = `${Math.max(10, leftPos)}px`; // Ensure minimum left margin
}

async function handleDateSelection(dateString) {
  if (!taskDetailsDateInput || !datePickerContainer) return;
  const lang = localStorage.getItem("language") || "ru";
  const selectedDateUTC = utils.parseDateUTC(dateString);

  // Update the input display and hide picker
  taskDetailsDateInput.dataset.selectedDate = dateString;
  taskDetailsDateInput.textContent = selectedDateUTC.toLocaleDateString(
    lang,
    utils.datePickerFormatOptions,
  );
  datePickerContainer.style.display = "none";

  // Show the "Remove Date" button now that a date is selected
  const datePickerResetButton = document.getElementById(
    "date-picker-reset-date",
  );
  if (datePickerResetButton) {
    datePickerResetButton.style.display = "inline-block";
  }

  datePickerVisible = false;
  // Update the task in the backend and refresh UI
  await updateTaskDueDate(dateString);
}

// Updates the task's due date and handles related UI/state changes (incl. recurrence).
async function updateTaskDueDate(newDate) {
  // newDate is "YYYY-MM-DD" or null
  if (!currentTaskBeingViewed) return;
  const taskElement = document.querySelector(
    `.event[data-task-id="${currentTaskBeingViewed}"]`,
  );
  const oldDueDate = taskElement?.dataset.dueDate;
  const todayStr = new Date().toLocaleDateString("en-CA");
  const wasTodayTask = oldDueDate === todayStr;
  const isNowTodayTask = newDate === todayStr;
  const updates = { due_date: newDate };
  let recurrenceCleared = false;

  // Show recurrence button only if a date is set
  if (newDate && recurringTaskDetailsBtn)
    recurringTaskDetailsBtn.style.display = "inline-block";
  // If date is removed, clear recurrence settings
  if (newDate === null) {
    updates.recurrence_rule = "";
    updates.recurrence_interval = 1;
    recurrenceCleared = true;
    if (recurringTaskDetailsBtn) recurringTaskDetailsBtn.style.display = "none";
    if (recurrenceSettingsContainer)
      recurrenceSettingsContainer.style.display = "none";
    recurrenceOpenedForNonRecurring = false; // Clear flag
  }

  try {
    await api.updateTask(currentTaskBeingViewed, updates);

    // Update todayTasks state if necessary
    const taskIndex = todayTasks.findIndex(
      (t) => t.id === currentTaskBeingViewed,
    );
    if (wasTodayTask && !isNowTodayTask && taskIndex > -1) {
      // Remove from todayTasks
      setTodayTasks([
        ...todayTasks.slice(0, taskIndex),
        ...todayTasks.slice(taskIndex + 1),
      ]);
    } else if (
      (!wasTodayTask && isNowTodayTask && taskIndex === -1) || // Add if now today
      taskIndex > -1 // Or update if still today
    ) {
      const taskDetails = await api.fetchTaskDetails(currentTaskBeingViewed);
      if (taskDetails) {
        const newTasks = [...todayTasks];
        if (taskIndex > -1) newTasks[taskIndex] = taskDetails;
        else newTasks.push(taskDetails);
        setTodayTasks(newTasks);
      }
    }
    updateTabTitle(); // Update favicon

    // Refresh relevant parts of the calendar view
    let weekToRender = newDate
      ? utils.getStartOfWeek(utils.parseDateUTC(newDate))
      : getDisplayedWeekStartDate();
    const currentWeekStartStr = getDisplayedWeekStartDate()
      .toISOString()
      .slice(0, 10);
    const targetWeekStartStr = weekToRender.toISOString().slice(0, 10);
    if (currentWeekStartStr !== targetWeekStartStr) {
      setDisplayedWeekStartDate(weekToRender); // Update displayed week if changed
    }
    await calendar.renderWeekCalendar(weekToRender);
    if (newDate === null || taskElement?.closest("#inbox")) {
      // Refresh inbox if task moved there or originated there
      await calendar.renderInbox();
    }

    // Update recurrence UI in the popup
    if (recurrenceCleared) {
      clearRecurrenceInPopup();
      recurrenceOpenedForNonRecurring = false;
    } else {
      // Fetch updated task data to refresh recurrence UI state
      const taskData = await api.fetchTaskDetails(currentTaskBeingViewed);
      updateRecurrenceUI(taskData?.recurrence_rule || "");
    }
    updateRecurrencePreview();
    requestAnimationFrame(() => highlightTask(currentTaskBeingViewed)); // Highlight task in new location
  } catch (error) {
    console.error("Error updating task due date:", error);
    showSnackbar("failedToUpdateDate", true);
    // Consider reverting UI changes on error
  }
}

// --- Checkbox Helper ---
// Toggles the 'checked' class on the label for visual styling.
export function handleCheckboxChange(checkbox) {
  if (!checkbox) return;
  const label = checkbox.closest("label.styled-checkbox");
  if (label) label.classList.toggle("checked", checkbox.checked);
}

// --- Language Setting ---
export function setLanguage(lang) {
  localStorage.setItem("language", lang);
  updateTranslations(lang);
  // Trigger UI refreshes after translation update
  calendar.renderWeekCalendar(getDisplayedWeekStartDate());
  calendar.renderInbox();
  if (datePickerVisible) renderDatePicker();
  if (currentTaskBeingViewed) {
    // Refresh details popup elements if open
    updateRecurrencePreview();
    const currentSelectedDate = taskDetailsDateInput?.dataset.selectedDate;
    if (taskDetailsDateInput) {
      if (currentSelectedDate)
        taskDetailsDateInput.textContent = utils
          .parseDateUTC(currentSelectedDate)
          .toLocaleDateString(lang, utils.datePickerFormatOptions);
      else
        taskDetailsDateInput.textContent =
          translations[lang]?.pickADate || "Pick a date";
    }
  }
}

// --- Today Tasks & Title/Favicon ---
export async function refreshTodayTasks() {
  try {
    setTodayTasks(await api.fetchTodayTasks());
  } catch (error) {
    setTodayTasks([]); // Ensure array state on error
  }
}

// Updates the browser tab title and favicon based on today's tasks.
export async function updateTabTitle() {
  await refreshTodayTasks(); // Ensure todayTasks is up-to-date
  const lang = localStorage.getItem("language") || "ru";
  document.title = translations[lang]?.baseTitleName || "Week Planner"; // Base title only
  updateFavicon(todayTasks.filter((task) => task.completed === 0).length);
}

function svgToDataUrl(svgString) {
  const encoded = encodeURIComponent(svgString)
    .replace(/'/g, "%27")
    .replace(/"/g, "%22");
  return `data:image/svg+xml,${encoded}`;
}

function updateFavicon(taskCount) {
  const themeSetting = localStorage.getItem("theme") || "auto";
  const isDark =
    themeSetting === "dark" ||
    (themeSetting === "auto" &&
      window.matchMedia?.("(prefers-color-scheme: dark)").matches);
  const colors = isDark ? faviconColors.dark : faviconColors.light;
  let symbol = "✓",
    fillColor = colors.empty; // Default: checkmark in empty color

  if (taskCount > 0 && taskCount < 10) {
    symbol = taskCount.toString();
    fillColor = colors.singleDigit;
  } else if (taskCount >= 10) {
    symbol = "∞"; // Infinity symbol for 10+ tasks
    fillColor = colors.multiple;
  }

  const svg = faviconBaseSvg
    .replace("{SYMBOL}", symbol)
    .replace("{FILL_COLOR}", fillColor);
  let link = document.querySelector("link[rel='icon']");
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.href = svgToDataUrl(svg);
}

// --- Misc UI Updates ---
// Updates the color of dropdown arrows based on the current theme.
export function updateSelectArrowsColor() {
  try {
    const bodyStyle = getComputedStyle(document.body);
    const dimTextColor = bodyStyle.getPropertyValue("--dim-text-color").trim();
    if (!dimTextColor) return;
    const encodedColor = encodeURIComponent(dimTextColor);
    const arrowSvg = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='${encodedColor}'%3E%3Cpath d='M8 11L3 6h10z'/%3E%3C/svg%3E")`;
    document
      .querySelectorAll(".themed-select, .language-select")
      .forEach((select) => {
        select.style.backgroundImage = arrowSvg;
      });
  } catch (error) {
    console.error("Error updating select arrow color:", error);
  }
}

// Adjust UI elements on window resize.
window.addEventListener("resize", () => {
  if (taskDetailsPopupOverlay?.style.display === "flex") {
    adjustTextareaHeight();
    if (datePickerVisible) positionDatePicker();
  }
});

// --- Data Import/Export Handlers ---
function handleExportDb() {
  window.location.href = "/api/export_db";
}
async function handleImportDb(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const lang = localStorage.getItem("language") || "ru";
  if (!file.name.toLowerCase().endsWith(".db")) {
    showSnackbar("errorImportFile", true);
    if (importDbInput) importDbInput.value = "";
    return;
  }
  const formData = new FormData();
  formData.append("database", file);
  showSnackbar("importingDatabase"); // Non-error, temporary message
  try {
    const response = await fetch("/api/import_db", {
      method: "POST",
      body: formData,
    });
    if (response.ok) {
      showSnackbar("importSuccess"); // Non-error, temporary message
      setTimeout(() => window.location.reload(), 2000); // Reload after success
    } else {
      // Try to parse server error message
      let errorText = await response.text();
      try {
        const json = JSON.parse(errorText);
        errorText = json.message || json.error || errorText;
      } catch (e) {
        /* ignore parsing error */
      }
      showSnackbar(
        `${translations[lang]?.importError || "Import failed"}: ${errorText}`,
        true,
      );
    }
  } catch (error) {
    showSnackbar("errorImportNetwork", true);
  } finally {
    if (importDbInput) importDbInput.value = ""; // Reset file input
  }
}

// --- Recurrence UI Functions ---

// Restores the recurrence UI elements based on the lastClearedRecurrence state.
function restoreRecurrenceUI() {
  // Check if there's a state to restore and if it applies to the current task
  if (
    lastClearedRecurrence?.rule &&
    currentTaskBeingViewed === lastClearedRecurrence.taskId
  ) {
    if (recurrencePeriodSelect)
      recurrencePeriodSelect.value = lastClearedRecurrence.rule;
    if (recurrenceIntervalInput)
      recurrenceIntervalInput.value = lastClearedRecurrence.interval;
    // Show container only if a date is still selected
    if (
      recurrenceSettingsContainer &&
      taskDetailsDateInput?.dataset.selectedDate
    ) {
      recurrenceSettingsContainer.style.display = "block";
    }
    updateRecurrenceUI(lastClearedRecurrence.rule);
    updateRecurrencePreview();
    adjustTextareaHeight();
  }
  lastClearedRecurrence = null; // Clear state after attempting restore
}

// Updates the visibility and state of recurrence controls based on current rule/date.
function updateRecurrenceUI(currentRule) {
  const hasRule = !!currentRule;
  const hasDate = !!taskDetailsDateInput?.dataset.selectedDate;

  // Show interval/period controls only if there's a rule AND a date
  if (recurrenceControls)
    recurrenceControls.style.display = hasRule && hasDate ? "flex" : "none";
  // Set the main recurrence button to 'active' state if rule and date exist
  if (recurringTaskDetailsBtn)
    recurringTaskDetailsBtn.classList.toggle("active", hasRule && hasDate);

  // Show the whole recurrence container section if a date exists AND
  // (a rule is set OR the section was manually opened before)
  if (recurrenceSettingsContainer) {
    const isManuallyOpened =
      recurrenceSettingsContainer.style.display === "block";
    recurrenceSettingsContainer.style.display =
      hasDate && (hasRule || isManuallyOpened) ? "block" : "none";
  }

  requestAnimationFrame(adjustTextareaHeight); // Adjust layout
}

// Updates the text preview showing the next calculated recurrence date.
function updateRecurrencePreview() {
  if (
    !currentTaskBeingViewed ||
    !recurrencePreview ||
    !recurrencePeriodSelect ||
    !recurrenceIntervalInput
  ) {
    if (recurrencePreview) recurrencePreview.textContent = "";
    return;
  }
  const lang = localStorage.getItem("language") || "ru";
  const period = recurrencePeriodSelect.value;
  const interval = parseInt(recurrenceIntervalInput.value, 10);
  const currentDueDateStr = taskDetailsDateInput?.dataset.selectedDate;

  // Hide preview if recurrence section is hidden, or inputs are invalid/missing
  if (
    recurrenceSettingsContainer?.style.display === "none" ||
    !period ||
    isNaN(interval) ||
    interval < 1 ||
    !currentDueDateStr
  ) {
    recurrencePreview.textContent = "";
    return;
  }

  try {
    const currentDueDateUTC = utils.parseDateUTC(currentDueDateStr);
    if (isNaN(currentDueDateUTC.getTime())) {
      recurrencePreview.textContent = ""; // Invalid date
      return;
    }

    let nextDate = utils.calculateNextRecurrence(
      currentDueDateUTC,
      period,
      interval,
    );
    if (!nextDate) {
      recurrencePreview.textContent = ""; // Invalid period/calculation
      return;
    }

    recurrencePreview.textContent = `${translations[lang]?.recurrenceNext || "Next:"} ${nextDate.toLocaleDateString(lang, utils.datePickerFormatOptions)}`;
  } catch (e) {
    console.error("Error calculating next recurrence date:", e);
    recurrencePreview.textContent = ""; // Clear on error
  }
}

// Saves the current recurrence settings from the UI to the backend.
async function saveRecurrenceSettings() {
  if (
    !currentTaskBeingViewed ||
    !recurrencePeriodSelect ||
    !recurrenceIntervalInput
  )
    return;

  const selectedRule = recurrencePeriodSelect.value;
  let selectedInterval = parseInt(recurrenceIntervalInput.value, 10);
  // Validate interval, default to 1 if invalid
  if (isNaN(selectedInterval) || selectedInterval < 1) {
    selectedInterval = 1;
    recurrenceIntervalInput.value = 1;
  }

  const ruleToSend = selectedRule || ""; // Send empty string if no rule selected
  const intervalToSend = ruleToSend ? selectedInterval : 1; // Send 1 if rule is cleared

  try {
    await api.updateTask(currentTaskBeingViewed, {
      recurrence_rule: ruleToSend,
      recurrence_interval: intervalToSend,
    });
    // Ensure recurrence button is visible if a date exists
    if (recurringTaskDetailsBtn && taskDetailsDateInput?.dataset.selectedDate)
      recurringTaskDetailsBtn.style.display = "inline-block";
    updateRecurrenceUI(ruleToSend); // Update active state etc.
    updateRecurrencePreview();
  } catch (error) {
    showSnackbar("failedToSaveRecurrence", true);
    // Consider reverting UI on save error
  }
}

// Clears the recurrence UI elements in the popup.
export function clearRecurrenceInPopup(shouldAdjustHeight = true) {
  if (recurrencePeriodSelect) recurrencePeriodSelect.value = "";
  if (recurrenceIntervalInput) recurrenceIntervalInput.value = 1;
  if (recurrenceControls) recurrenceControls.style.display = "none";
  if (recurringTaskDetailsBtn)
    recurringTaskDetailsBtn.classList.remove("active");
  if (recurrencePreview) recurrencePreview.textContent = "";
  // Don't hide the main container - visibility is controlled by updateRecurrenceUI
  if (shouldAdjustHeight) requestAnimationFrame(adjustTextareaHeight);
}
