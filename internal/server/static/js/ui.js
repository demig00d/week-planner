import * as api from "./api.js";
import * as calendar from "./calendar.js";
import * as tasks from "./tasks.js";
import * as utils from "./utils.js";
import {
  translations,
  loadLanguage,
  updateTranslations,
} from "./localization.js";
import { TASK_COLORS } from "./config.js";

const settingsPopup = document.getElementById("settings-popup");
const taskDetailsPopupOverlay = document.getElementById(
  "task-details-popup-overlay",
);
const taskDetailsPopup = document.getElementById("task-details-popup");
const taskDetailsTitle = document.getElementById("task-details-title");
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
const markDoneTaskDetailsBtn = document.getElementById(
  "mark-done-task-details",
);
const taskDetailsDateInput = document.getElementById("task-details-date");
const datePickerContainer = document.getElementById("date-picker-container");
const datePickerMonthYear = document.getElementById("date-picker-month-year");
const datePickerGrid = document.getElementById("date-picker-grid");
const fuzzySearchPopup = document.getElementById("fuzzy-search-popup");
const fuzzySearchResultsList = document.getElementById("fuzzy-search-results");

let currentTaskBeingViewed = null;
let isDescriptionRenderedMode = false;
let descriptionHeight = "100px";
let minDescriptionHeight = "50px";
let isSettingsOpen = false;
let isSearchOpen = false;
let searchTimeout = null;
let datePickerVisible = false;
let datePickerCurrentDate = new Date();
export let todayTasks = []; // Changed from const to let

export function toggleSettingsPopup() {
  isSettingsOpen = !isSettingsOpen;
  settingsPopup.style.display = isSettingsOpen ? "block" : "none";
  document.getElementById("full-weekdays-checkbox").checked =
    localStorage.getItem("fullWeekdays") === "true";
  let wrapTaskTitles = localStorage.getItem("wrapTaskTitles") !== "false";
  if (localStorage.getItem("wrapTaskTitles") === null) {
    wrapTaskTitles = true;
  } else {
    wrapTaskTitles = localStorage.getItem("wrapTaskTitles") !== "false";
  }
  document.getElementById("wrap-task-titles-checkbox").checked = wrapTaskTitles;
}

export function closeAllPopups() {
  if (taskDetailsPopupOverlay.style.display === "flex") {
    closeTaskDetailsPopup();
    return;
  }
  if (isSettingsOpen) {
    isSettingsOpen = false;
    settingsPopup.style.display = "none";
    return;
  }

  if (datePickerVisible) {
    datePickerContainer.style.display = "none";
    datePickerVisible = false;
    return;
  }

  if (isSearchOpen) {
    isSearchOpen = false;
    fuzzySearchPopup.style.display = "none";
    fuzzySearchResultsList.innerHTML = "";
    document.getElementById("fuzzy-search-input").value = "";
    return;
  }
}

export function handleGlobalClick(event) {
  if (
    isSettingsOpen &&
    !event.target.closest(".settings-popup") &&
    event.target !== document.getElementById("settings-btn")
  ) {
    isSettingsOpen = false;
    settingsPopup.style.display = "none";
  }
  if (
    isSearchOpen &&
    !event.target.closest(".fuzzy-search-popup") &&
    event.target !== document.getElementById("search-btn") &&
    event.target !== document.getElementById("fuzzy-search-input")
  ) {
    isSearchOpen = false;
    fuzzySearchPopup.style.display = "none";
    fuzzySearchResultsList.innerHTML = "";
    document.getElementById("fuzzy-search-input").value = "";
  }
  if (
    datePickerVisible &&
    !event.target.closest(".date-picker-container") &&
    event.target !== taskDetailsDateInput
  ) {
    datePickerContainer.style.display = "none";
    datePickerVisible = false;
  }
  if (event.target === taskDetailsPopupOverlay) {
    const isTextSelected = window.getSelection().toString().length > 0;
    if (!isTextSelected) {
      closeTaskDetailsPopup();
    }
  }
}

export function setTheme(theme) {
  const body = document.body;
  let resolvedTheme = theme;

  if (theme === "dark") {
    body.classList.add("dark-theme");
  } else if (theme === "light") {
    body.classList.remove("dark-theme");
  } else if (theme === "auto") {
    const prefersDark =
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (prefersDark) {
      body.classList.add("dark-theme");
      resolvedTheme = "dark";
    } else {
      body.classList.remove("dark-theme");
      resolvedTheme = "light";
    }
  }

  document.querySelectorAll(".event").forEach((event) => {
    const color = event.dataset.taskColor;
    event.style.backgroundColor = getTaskBackgroundColor(color);
  });
  const inboxDiv = document.getElementById("inbox");
  if (inboxDiv) {
    inboxDiv.style.backgroundColor = body.classList.contains("dark-theme")
      ? "var(--inbox-bg-dark)"
      : "var(--inbox-bg-light)";
  }
  updateTabTitle();
}

export function getTaskBackgroundColor(color) {
  const currentTheme = localStorage.getItem("theme") || "auto";
  if (!color) return "transparent";

  // Correctly determine the theme based on user preference
  const theme =
    currentTheme === "auto"
      ? window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : currentTheme;

  const lightColors = {
    blue: "var(--task-color-blue-light)",
    green: "var(--task-color-green-light)",
    yellow: "var(--task-color-yellow-light)",
    pink: "var(--task-color-pink-light)",
    orange: "var(--task-color-orange-light)",
  };
  const darkColors = {
    blue: "var(--task-color-blue-dark)",
    green: "var(--task-color-green-dark)",
    yellow: "var(--task-color-yellow-dark)",
    pink: "var(--task-color-pink-dark)",
    orange: "var(--task-color-orange-dark)",
  };
  return theme === "dark" ? darkColors[color] : lightColors[color];
}

export async function updateSettingsText() {
  const lang = localStorage.getItem("language") || "ru";
  await updateTranslations(lang);
}

export async function openTaskDetails(taskId) {
  currentTaskBeingViewed = taskId;
  try {
    const task = await api.fetchTaskDetails(taskId);
    if (!task) {
      console.error("Task not found!");
      return;
    }

    const isCompleted = task.completed === 1;
    taskDetailsTitle.innerHTML = "";

    const titleInput = document.createElement("input");
    titleInput.type = "text";
    titleInput.value = task.title;
    titleInput.classList.add("task-title-input");
    taskDetailsTitle.appendChild(titleInput);
    titleInput.focus();

    const handleTitleBlur = async () => {
      const newTitle = titleInput.value.trim();
      if (newTitle !== task.title) {
        await api.updateTask(taskId, { title: newTitle });
        //Correct todayTasks update
        const todayTaskIndex = todayTasks.findIndex((t) => t.id === taskId);
        if (todayTaskIndex !== -1) {
          todayTasks[todayTaskIndex].title = newTitle;
        }
        const taskElement = document.querySelector(
          `.event[data-task-id="${taskId}"]`,
        );
        if (taskElement) {
          const taskTextElement = taskElement.querySelector(".task-text");
          taskTextElement.textContent = newTitle;
        }
      }
    };

    titleInput.addEventListener("blur", handleTitleBlur);

    // Get lang here
    const lang = localStorage.getItem("language") || "ru";

    if (task.due_date) {
      datePickerCurrentDate = new Date(task.due_date);
      taskDetailsDateInput.dataset.selectedDate = task.due_date;
      taskDetailsDateInput.textContent = new Date(
        task.due_date,
      ).toLocaleDateString(lang, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } else {
      datePickerCurrentDate = new Date();
      taskDetailsDateInput.dataset.selectedDate = "";
      taskDetailsDateInput.textContent = translations[lang].datePickerSetDate;
    }

    renderDatePicker();
    taskDetailsPopupOverlay.style.display = "flex";

    const descriptionText = task.description || "";
    taskDescriptionTextarea.value = descriptionText;
    taskDescriptionRendered.innerHTML = marked.parse(descriptionText);

    if (descriptionText.trim() !== "") {
      isDescriptionRenderedMode = true;
      taskDescriptionRendered.style.display = "block";
      taskDescriptionTextarea.style.display = "none";
      toggleDescriptionModeBtn.classList.add("rendered-mode");
      descriptionModeIcon.className = "fas fa-pen";
    } else {
      isDescriptionRenderedMode = false;
      taskDescriptionRendered.style.display = "none";
      taskDescriptionTextarea.style.display = "block";
      toggleDescriptionModeBtn.classList.remove("rendered-mode");
      descriptionModeIcon.className = "fas fa-book-open";
    }

    const colorSwatches = document.querySelectorAll(".color-swatch");
    colorSwatches.forEach((swatch) => {
      swatch.onclick = async (event) => {
        let color = event.target.dataset.color;
        if (color === "no-color") {
          color = "";
        }

        if (currentTaskBeingViewed) {
          await api.updateTask(currentTaskBeingViewed, { color: color });
          const taskElement = document.querySelector(
            `.event[data-task-id="${currentTaskBeingViewed}"]`,
          );
          if (taskElement) {
            taskElement.dataset.taskColor = color;
            taskElement.style.backgroundColor = getTaskBackgroundColor(color);
          }
        }

        colorSwatches.forEach((sw) => {
          if (sw === event.target) {
            sw.classList.add("selected-color");
          } else {
            sw.classList.remove("selected-color");
          }
        });
      };
    });

    // Call adjustTextareaHeight *after* setting content and display properties
    adjustTextareaHeight();
    updateMarkAsDoneButton(isCompleted);
  } catch (error) {
    console.error("Error fetching task details:", error);
  }
}

export function closeTaskDetailsPopup() {
  taskDetailsPopupOverlay.style.display = "none";
  datePickerContainer.style.display = "none";
  datePickerVisible = false;
  currentTaskBeingViewed = null;
}
// IMPORTANT: Modified adjustTextareaHeight
function adjustTextareaHeight() {
  const popup = taskDetailsPopup;
  const topBarHeight = popup.querySelector(".task-popup-top-bar").offsetHeight;
  const titleHeight = popup.querySelector(".task-details-title").offsetHeight;
  const labelHeight = popup.querySelector(
    ".task-details-popup-content label",
  ).offsetHeight;
  const contentPaddingVertical = 40;
  const popupPaddingVertical = 40;
  const marginBottom = 20;

  const totalFixedElementsHeight =
    topBarHeight +
    titleHeight +
    labelHeight +
    contentPaddingVertical +
    popupPaddingVertical +
    marginBottom;

  // Get max-height of the popup from CSS, in pixels (assuming vh is relative to viewport height now)
  const maxHeightVH = 65; // as defined in your CSS (65vh)
  const viewportHeight = window.innerHeight;
  let maxHeightPixels = (maxHeightVH / 100) * viewportHeight;

  let availableHeight = maxHeightPixels - totalFixedElementsHeight;

  console.log("--- adjustTextareaHeight ---");
  console.log("Popup Max Height (pixels):", maxHeightPixels);
  console.log("Total Fixed Elements Height:", totalFixedElementsHeight);
  console.log("Available Height for Description:", availableHeight);

  if (availableHeight < 0) {
    availableHeight = 0; // Ensure availableHeight is not negative
  }

  if (isDescriptionRenderedMode) {
    taskDescriptionRendered.style.height = "auto";
    let renderedScrollHeight = taskDescriptionRendered.scrollHeight;
    let newRenderedHeight = Math.max(
      parseInt(minDescriptionHeight),
      renderedScrollHeight,
    );

    newRenderedHeight = Math.min(newRenderedHeight, availableHeight);
    taskDescriptionRendered.style.height = `${newRenderedHeight}px`;
    descriptionHeight = `${newRenderedHeight}px`;
    console.log("Rendered Description Height:", newRenderedHeight);
  } else {
    taskDescriptionTextarea.style.height = "auto";
    let scrollHeight = taskDescriptionTextarea.scrollHeight;
    let newTextareaHeight = Math.max(
      parseInt(minDescriptionHeight),
      scrollHeight,
    );

    newTextareaHeight = Math.min(newTextareaHeight, availableHeight);
    taskDescriptionTextarea.style.height = `${newTextareaHeight}px`;
    descriptionHeight = `${newTextareaHeight}px`;
    console.log("Textarea Description Height:", newTextareaHeight);
  }
  console.log("--- end adjustTextareaHeight ---");
}

export function updateMarkAsDoneButton(isCompleted) {
  if (isCompleted) {
    markDoneTaskDetailsBtn.dataset.completed = 1;
    markDoneTaskDetailsBtn.innerHTML = '<i class="fas fa-check-circle"></i>';
    markDoneTaskDetailsBtn.title = "Mark as undone";
  } else {
    markDoneTaskDetailsBtn.innerHTML = '<i class="far fa-check-circle"></i>';
    markDoneTaskDetailsBtn.title = "Mark as done";
    markDoneTaskDetailsBtn.dataset.completed = 0;
  }
}

export function updateTaskCompletionDisplay(taskElement, completed) {
  handleTaskCompletionUI(taskElement, completed);
}

taskDescriptionTextarea.addEventListener("input", () => {
  adjustTextareaHeight();
});

taskDescriptionTextarea.addEventListener("blur", async (event) => {
  if (currentTaskBeingViewed) {
    const newDescription = event.target.value;
    await api.updateTask(currentTaskBeingViewed, {
      description: newDescription,
    });

    // Find the task element and update the description icon
    const taskElement = document.querySelector(
      `.event[data-task-id="${currentTaskBeingViewed}"]`,
    );
    if (taskElement) {
      let descriptionIcon = taskElement.querySelector(".description-icon");
      if (newDescription.trim() !== "") {
        if (!descriptionIcon) {
          descriptionIcon = document.createElement("i");
          descriptionIcon.classList.add(
            "fas",
            "fa-sticky-note",
            "description-icon",
          );
          descriptionIcon.title = "This task has a description";
          // Insert after .task-text
          taskElement.querySelector(".task-text").after(descriptionIcon);
        }
      } else {
        if (descriptionIcon) {
          descriptionIcon.remove();
        }
      }
    }

    if (isDescriptionRenderedMode) {
      const descriptionText = event.target.value || "";
      const renderedDescription = marked.parse(descriptionText);
      taskDescriptionRendered.innerHTML = renderedDescription;
      adjustTextareaHeight(); //adjust height after parsing
    } else {
      adjustTextareaHeight(); // Adjust if in edit mode
    }
  }
});

closeTaskDetailsPopupBtn.addEventListener("click", closeTaskDetailsPopup);

deleteTaskDetailsBtn.addEventListener("click", async () => {
  if (currentTaskBeingViewed) {
    const deleted = await api.deleteTask(currentTaskBeingViewed);
    if (deleted) {
      //Correct todayTasks update
      todayTasks = todayTasks.filter(
        (task) => task.id !== currentTaskBeingViewed,
      );
      const taskElement = document.querySelector(
        `.event[data-task-id="${currentTaskBeingViewed}"]`,
      );
      if (taskElement) {
        taskElement.remove();
      }
      updateTabTitle();
      closeTaskDetailsPopup();
    }
  }
});

toggleDescriptionModeBtn.addEventListener("click", () => {
  isDescriptionRenderedMode = !isDescriptionRenderedMode;

  if (isDescriptionRenderedMode) {
    const descriptionText = taskDescriptionTextarea.value || "";
    const renderedDescription = marked.parse(descriptionText);
    taskDescriptionRendered.innerHTML = renderedDescription;
    taskDescriptionRendered.style.display = "block";
    taskDescriptionTextarea.style.display = "none";
    toggleDescriptionModeBtn.classList.add("rendered-mode");
    descriptionModeIcon.className = "fas fa-pen";
    taskDescriptionRendered.style.height = descriptionHeight;
  } else {
    taskDescriptionRendered.style.display = "none";
    taskDescriptionTextarea.style.display = "block";
    toggleDescriptionModeBtn.classList.remove("rendered-mode");
    descriptionModeIcon.className = "fas fa-book-open";
    taskDescriptionTextarea.style.height = descriptionHeight;
    taskDescriptionTextarea.focus();
  }
  //Adjust after toggling
  adjustTextareaHeight();
});

export function handleTaskCompletionUI(taskElement, completed) {
  const doneButton = taskElement.querySelector(".done-button");
  const undoneButton = taskElement.querySelector(".undone-button");
  const taskTextElement = taskElement.querySelector(".task-text");

  taskTextElement.classList.toggle("completed", completed === 1);
  doneButton.style.display = completed === 1 ? "none" : "inline-block";
  undoneButton.style.display = completed === 0 ? "none" : "inline-block";

  if (currentTaskBeingViewed === parseInt(taskElement.dataset.taskId)) {
    updateMarkAsDoneButton(completed === 1);
  }
}

export function toggleSearchPopup() {
  isSearchOpen = !isSearchOpen;
  fuzzySearchPopup.style.display = isSearchOpen ? "block" : "none";
  if (isSearchOpen) {
    document.getElementById("fuzzy-search-input").focus();
  } else {
    fuzzySearchResultsList.innerHTML = "";
    document.getElementById("fuzzy-search-input").value = "";
  }
}

export async function handleSearchInput() {
  clearTimeout(searchTimeout);
  const query = document.getElementById("fuzzy-search-input").value.trim();
  searchTimeout = setTimeout(async () => {
    await displayFuzzySearchResults(query);
  }, 300);
}

async function displayFuzzySearchResults(query) {
  if (query.length === 0) {
    fuzzySearchResultsList.innerHTML = "";
    return;
  }

  const tasks = await api.searchTasks(query);

  fuzzySearchResultsList.innerHTML = "";

  if (tasks.length === 0) {
    const noResultsItem = document.createElement("li");
    noResultsItem.textContent =
      translations[localStorage.getItem("language") || "ru"].noResults;
    fuzzySearchResultsList.appendChild(noResultsItem);
  } else {
    tasks.forEach((task) => {
      const listItem = document.createElement("li");
      const taskDate = task.due_date
        ? new Date(task.due_date).toLocaleDateString(
            localStorage.getItem("language") || "ru",
            { day: "numeric", month: "short" },
          )
        : "📦 Inbox"; // Use a constant or i18n key
      listItem.innerHTML = `
                <div class="fuzzy-search-task-title">${task.title}</div>
                <div class="fuzzy-search-task-date">${taskDate}</div>
            `;
      listItem.addEventListener("click", () => {
        isSearchOpen = false;
        fuzzySearchPopup.style.display = "none";
        fuzzySearchResultsList.innerHTML = "";
        document.getElementById("fuzzy-search-input").value = "";

        if (task.due_date) {
          let displayedWeekStartDate = utils.getStartOfWeek(
            new Date(task.due_date),
          );
          calendar.renderWeekCalendar(displayedWeekStartDate);
          highlightTask(task.id);
        } else {
          document
            .getElementById("inbox")
            .scrollIntoView({ behavior: "smooth" });
          highlightTask(task.id);
        }
      });
      fuzzySearchResultsList.appendChild(listItem);
    });
  }
}

function highlightTask(taskId) {
  const taskElement = document.querySelector(
    `.event[data-task-id="${taskId}"]`,
  );
  if (taskElement) {
    taskElement.style.border = "2px solid var(--highlight-text-color)";
    setTimeout(() => {
      taskElement.style.border = "";
    }, 3000);
  }
}

function renderDatePicker() {
  const lang = localStorage.getItem("language") || "ru";
  const monthNames = translations[lang].monthNames;
  const dayNamesShort = translations[lang].dayNamesShort;

  const date = datePickerCurrentDate;
  const firstDayOfMonth = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), 1),
  );
  const daysInMonth = new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0,
  ).getDate();
  const startDayOfWeek =
    firstDayOfMonth.getDay() === 0 ? 6 : firstDayOfMonth.getDay() - 1;

  datePickerMonthYear.textContent = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
  datePickerGrid.innerHTML = "";

  for (let dayName of dayNamesShort) {
    const dayNameElement = document.createElement("div");
    dayNameElement.classList.add("date-picker-day-name");
    dayNameElement.textContent = dayName;
    datePickerGrid.appendChild(dayNameElement);
  }

  for (let i = 0; i < startDayOfWeek; i++) {
    const emptyCell = document.createElement("div");
    emptyCell.classList.add("date-picker-day", "inactive");
    datePickerGrid.appendChild(emptyCell);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dayElement = document.createElement("div");
    dayElement.classList.add("date-picker-day");
    dayElement.textContent = day;
    const dayDate = new Date(
      Date.UTC(date.getFullYear(), date.getMonth(), day),
    );
    if (
      taskDetailsDateInput.dataset.selectedDate &&
      dayDate.toISOString().split("T")[0] ===
        taskDetailsDateInput.dataset.selectedDate
    ) {
      dayElement.classList.add("selected");
    }
    const today = new Date();
    if (dayDate.toDateString() === today.toDateString()) {
      dayElement.classList.add("current-day");
    }

    dayElement.addEventListener("click", () =>
      handleDateSelection(dayDate.toISOString().split("T")[0]),
    );
    datePickerGrid.appendChild(dayElement);
  }
}

async function handleDateSelection(dateString) {
  taskDetailsDateInput.dataset.selectedDate = dateString;
  taskDetailsDateInput.textContent = new Date(dateString).toLocaleDateString(
    localStorage.getItem("language") || "ru",
    { year: "numeric", month: "short", day: "numeric" },
  );
  datePickerContainer.style.display = "none";
  datePickerVisible = false;
  await updateTaskDueDate(dateString); // Calls the API
}

async function updateTaskDueDate(newDate) {
  if (!currentTaskBeingViewed) return;
  if (currentTaskBeingViewed) {
    const taskElement = document.querySelector(
      `.event[data-task-id="${currentTaskBeingViewed}"]`,
    );
    const wasTodayTask =
      taskElement &&
      taskElement.dataset.dueDate === new Date().toLocaleDateString("en-CA");
    const isTodayTask = newDate === new Date().toLocaleDateString("en-CA");

    await api.updateTask(currentTaskBeingViewed, { due_date: newDate });

    //Correct todayTasks update
    if (wasTodayTask && !isTodayTask) {
      todayTasks = todayTasks.filter(
        (task) => task.id !== currentTaskBeingViewed,
      );
    } else if (!wasTodayTask && isTodayTask) {
      const taskDetails = await api.fetchTaskDetails(currentTaskBeingViewed);
      if (taskDetails) {
        todayTasks.push(taskDetails);
      }
    }
    updateTabTitle();
  }

  if (newDate) {
    const newDueDate = new Date(newDate);
    let displayedWeekStartDate = utils.getStartOfWeek(newDueDate);
    calendar.renderWeekCalendar(displayedWeekStartDate);
  } else {
    let displayedWeekStartDate = utils.getStartOfWeek(new Date());
    calendar.renderWeekCalendar(displayedWeekStartDate);
  }
  tasks.renderAllTasks();
  highlightTask(currentTaskBeingViewed);
}

markDoneTaskDetailsBtn.addEventListener("click", async () => {
  if (!currentTaskBeingViewed) return;
  const isCompleted = markDoneTaskDetailsBtn.dataset.completed === "1";
  const newCompletedStatus = isCompleted ? 0 : 1;
  tasks.handleTaskCompletion(
    currentTaskBeingViewed,
    newCompletedStatus,
    todayTasks,
    async (updatedTasks) => {
      await refreshTodayTasks();
      updateTabTitle();
    },
  );
  const taskElement = document.querySelector(
    `.event[data-task-id="${currentTaskBeingViewed}"]`,
  );
  if (taskElement) {
    updateTaskCompletionDisplay(taskElement, newCompletedStatus);
  }
});

taskDetailsDateInput.addEventListener("click", (event) => {
  event.stopPropagation();
  datePickerVisible = !datePickerVisible;
  datePickerContainer.style.display = datePickerVisible ? "block" : "none";
  if (datePickerVisible) {
    renderDatePicker();
  }
});

datePickerContainer.addEventListener("click", (event) => {
  event.stopPropagation();
});

document
  .getElementById("date-picker-prev-month")
  .addEventListener("click", () => {
    datePickerCurrentDate.setMonth(datePickerCurrentDate.getMonth() - 1);
    renderDatePicker();
  });

document
  .getElementById("date-picker-next-month")
  .addEventListener("click", () => {
    datePickerCurrentDate.setMonth(datePickerCurrentDate.getMonth() + 1);
    renderDatePicker();
  });

document
  .getElementById("date-picker-reset-date")
  .addEventListener("click", async () => {
    taskDetailsDateInput.dataset.selectedDate = "";
    taskDetailsDateInput.textContent =
      translations[localStorage.getItem("language") || "ru"].datePickerSetDate;
    datePickerContainer.style.display = "none";
    datePickerVisible = false;
    await updateTaskDueDate(null); // Update to null date
  });

export function handleCheckboxChange(checkbox) {
  const label = checkbox.closest("label.styled-checkbox");
  if (label) {
    label.classList.toggle("checked", checkbox.checked);
  }
}

export function setLanguage(lang) {
  localStorage.setItem("language", lang);
  calendar.renderWeekCalendar(utils.getStartOfWeek(new Date()));
  updateSettingsText();
  renderDatePicker();
  calendar.renderInbox();
}

export async function updateTabTitle() {
  const lang = localStorage.getItem("language") || "ru";
  await refreshTodayTasks(); // Await the refresh
  const incompleteTodayTasks = todayTasks.filter(
    (task) => task.completed === 0,
  );
  const count = incompleteTodayTasks.length;

  document.title = translations[lang].baseTitleName;
  updateFavicon(count);
}

const faviconColors = {
  light: {
    empty: "#2E7D32",
    singleDigit: "#1565C0",
    multiple: "#424242",
  },
  dark: {
    empty: "#A5D6A7",
    singleDigit: "#64B5F6",
    multiple: "#BDBDBD",
  },
};

const faviconEmptyTasks = `<svg width="80" height="80" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <mask id="text-hole">
      <rect width="100%" height="100%" fill="white"/>
      <text x="40" y="39" font-family="Arial" font-size="80" font-weight="bold" fill="" text-anchor="middle" dominant-baseline="central">✓</text>
    </mask>
  </defs>
  <circle cx="40" cy="40" r="40" fill="{fillColor}" mask="url(#text-hole)"/>
</svg>`;

const faviconSingleDigitTasks = `<svg width="80" height="80" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <mask id="text-hole">
      <rect width="100%" height="100%" fill="white"/>
      <text x="40" y="39" font-family="Arial" font-size="80" font-weight="bold" fill="" text-anchor="middle" dominant-baseline="central">{count}</text>
    </mask>
  </defs>
  <circle cx="40" cy="40" r="40" fill="{fillColor}" mask="url(#text-hole)"/>
</svg>`;

const faviconMultipleTasks = `<svg width="80" height="80" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <mask id="text-hole">
      <rect width="100%" height="100%" fill="white"/>
      <text x="40" y="39" font-family="Arial" font-size="80" font-weight="bold" fill="" text-anchor="middle" dominant-baseline="central">∞</text>
    </mask>
  </defs>
  <circle cx="40" cy="40" r="40" fill="{fillColor}" mask="url(#text-hole)"/>
</svg>`;

function svgToDataUrl(svgString) {
  const encodedSVG = encodeURIComponent(svgString);
  return `data:image/svg+xml,${encodedSVG}`;
}

function updateFavicon(taskCount) {
  const currentTheme = localStorage.getItem("theme") || "auto";
  const isDarkTheme =
    currentTheme === "auto"
      ? window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
      : currentTheme === "dark";

  const themeColors = isDarkTheme ? faviconColors.dark : faviconColors.light;

  let faviconUrl = "";
  const currentFaviconEmptyTasks = faviconEmptyTasks.replace(
    "{fillColor}",
    themeColors.empty,
  );
  const currentFaviconSingleDigitTasks = faviconSingleDigitTasks.replace(
    "{fillColor}",
    themeColors.singleDigit,
  );
  const currentFaviconMultipleTasks = faviconMultipleTasks.replace(
    "{fillColor}",
    themeColors.multiple,
  );

  if (taskCount === 0) {
    faviconUrl = svgToDataUrl(currentFaviconEmptyTasks);
  } else if (taskCount > 0 && taskCount < 10) {
    faviconUrl = svgToDataUrl(
      currentFaviconSingleDigitTasks.replace("{count}", taskCount.toString()),
    );
  } else if (taskCount >= 10) {
    faviconUrl = svgToDataUrl(currentFaviconMultipleTasks);
  }

  let faviconLink = document.querySelector("link[rel='icon']");
  if (!faviconLink) {
    faviconLink = document.createElement("link");
    faviconLink.rel = "icon";
    document.head.appendChild(faviconLink);
  }
  faviconLink.href = faviconUrl;
}

export async function refreshTodayTasks() {
  todayTasks = await api.fetchTodayTasks();
}
