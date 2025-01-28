const body = document.body;
const monthNameElement = document.querySelector(".month-name");
const calendarDiv = document.querySelector(".calendar");
const row1Div = document.getElementById("row1");
const row2Div = document.getElementById("row2");
const prevWeekButton = document.getElementById("prev-week");
const nextWeekButton = document.getElementById("next-week");
const settingsBtn = document.getElementById("settings-btn");
const settingsPopup = document.getElementById("settings-popup");
const themeSelect = document.getElementById("theme-select");
const languageSelect = document.getElementById("language-select-popup");
const fullWeekdaysCheckbox = document.getElementById("full-weekdays-checkbox");
const wrapTaskTitlesCheckbox = document.getElementById(
  "wrap-task-titles-checkbox",
);
const inboxDiv = document.getElementById("inbox");
const dayIds = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];
const dayElements = dayIds.reduce((acc, id) => {
  acc[id] = document.getElementById(id);
  return acc;
}, {});

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
let currentTaskBeingViewed = null;
let isDescriptionRenderedMode = false; // Track description mode, default to editable
let descriptionHeight = "100px"; // Default height, or get initial from CSS
let minDescriptionHeight = "50px"; // Minimum height for textarea

let currentDate = new Date();
let displayedWeekStartDate = new Date(currentDate);
let draggedTask = null;
let isSettingsOpen = false;
let currentTheme = "light";
let inboxHeaderElement = null;
let inboxInputElement = null;
let isEditingInboxTitle = false;
let displayFullWeekdays = localStorage.getItem("fullWeekdays") === "true";
let wrapTaskTitles = localStorage.getItem("wrapTaskTitles") !== "false";
// Set wrapTaskTitles to true by default
if (localStorage.getItem("wrapTaskTitles") === null) {
  wrapTaskTitles = true;
} else {
  wrapTaskTitles = localStorage.getItem("wrapTaskTitles") !== "false";
}

// Fuzzy Search Variables
const searchBtn = document.getElementById("search-btn");
const fuzzySearchPopup = document.getElementById("fuzzy-search-popup");
const fuzzySearchInput = document.getElementById("fuzzy-search-input");
const fuzzySearchResultsList = document.getElementById("fuzzy-search-results");
let isSearchOpen = false;
let searchTimeout = null;
let popupOpen = false; // Flag to track if popup is open
let currentInboxTitle = "📦 Inbox"; // Default, will be updated after fetch

// Date Picker Variables
const taskDetailsDateInput = document.getElementById("task-details-date");
const datePickerContainer = document.getElementById("date-picker-container");
const datePickerMonthYear = document.getElementById("date-picker-month-year");
const datePickerGrid = document.getElementById("date-picker-grid");
let datePickerVisible = false;
let datePickerCurrentDate = new Date();

const translations = {
  en: {
    monthNames: [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ],
    dayNamesShort: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    dayNamesFull: [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ],
    newTask: "New task...",
    newTaskSomeday: "New task for inbox...",
    settings: "Settings",
    theme: "Theme",
    language: "Language",
    searchPlaceholder: "Search tasks...",
    noResults: "No matching tasks found.",
    taskDate: "Task Date",
    deleteTask: "Delete Task",
    close: "Close",
    datePickerNavPrev: "Previous Month",
    datePickerNavNext: "Next Month",
    datePickerSetDate: "Set Date",
    fullWeekdaysHeader: "Full weekday names",
    wrapTaskTitlesHeader: "Wrap task titles",
    displayOptionsHeader: "Display",
    themeAuto: "Auto",
    themeLight: "Light",
    themeDark: "Dark",
    description: "Description",
  },
  ru: {
    monthNames: [
      "Январь",
      "Февраль",
      "Март",
      "Апрель",
      "Май",
      "Июнь",
      "Июль",
      "Август",
      "Сентябрь",
      "Октябрь",
      "Ноябрь",
      "Декабрь",
    ],
    dayNamesShort: ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"],
    dayNamesFull: [
      "Понедельник",
      "Вторник",
      "Среда",
      "Четверг",
      "Пятница",
      "Суббота",
      "Воскресенье",
    ],
    newTask: "Новая задача...",
    newTaskSomeday: "Новая задача на когда-нибудь...",
    settings: "Настройки",
    theme: "Тема",
    language: "Язык",
    searchPlaceholder: "Поиск задач...",
    noResults: "Задачи не найдены.",
    taskDate: "Дата задачи",
    deleteTask: "Удалить задачу",
    close: "Закрыть",
    datePickerNavPrev: "Предыдущий месяц",
    datePickerNavNext: "Следующий месяц",
    datePickerSetDate: "Назначить дату",
    fullWeekdaysHeader: "Полные названия дней недели",
    wrapTaskTitlesHeader: "Переносить имя задач на следующую строку",
    displayOptionsHeader: "Отображение",
    themeAuto: "Авто",
    themeLight: "Светлая",
    themeDark: "Тёмная",
    description: "Описание",
  },
};
const TASK_COLORS = ["blue", "green", "yellow", "pink", "orange"];

async function updateSettingsText() {
  const lang = localStorage.getItem("language") || "ru";

  // Settings Header
  const settingsHeader = document.querySelector("#settings-popup h3");
  if (settingsHeader) {
    settingsHeader.textContent = translations[lang].settings;
  } else {
    console.error("Could not find settings header element.");
  }

  // Theme Label
  const themeLabel = document.querySelector(
    '#settings-popup label[for="theme-select"]',
  );
  if (themeLabel) {
    themeLabel.textContent = translations[lang].theme;
  } else {
    console.error("Could not find theme label element.");
  }

  // Theme Select Options
  const themeSelectElement = document.getElementById("theme-select");
  if (themeSelectElement) {
    themeSelectElement.querySelector('option[value="auto"]').textContent =
      translations[lang].themeAuto;
    themeSelectElement.querySelector('option[value="light"]').textContent =
      translations[lang].themeLight;
    themeSelectElement.querySelector('option[value="dark"]').textContent =
      translations[lang].themeDark;
  } else {
    console.error("Could not find theme select element.");
  }

  // Language Label
  const languageLabel = document.querySelector(
    '#settings-popup label[for="language-select-popup"]',
  );
  if (languageLabel) {
    languageLabel.textContent = translations[lang].language;
  } else {
    console.error("Could not find language label element.");
  }

  // Display Options Header
  const displayOptionsHeaderElement = document.querySelector(
    ".settings-options-header",
  );
  if (displayOptionsHeaderElement) {
    displayOptionsHeaderElement.textContent =
      translations[lang].displayOptionsHeader;
  } else {
    console.error("Could not find display options header element.");
  }

  // Full Weekdays Label
  const fullWeekdaysCheckbox = document.getElementById(
    "full-weekdays-checkbox",
  );
  if (fullWeekdaysCheckbox) {
    const label = fullWeekdaysCheckbox.parentElement;
    const newText = translations[lang].fullWeekdaysHeader;
    // Clear label and re-add translated text followed by checkbox
    label.innerHTML = "";
    label.appendChild(document.createTextNode(newText));
    label.appendChild(fullWeekdaysCheckbox);
  } else {
    console.error("Could not find full weekdays checkbox element.");
  }

  // Wrap Task Titles Label
  const wrapTaskTitlesCheckbox = document.getElementById(
    "wrap-task-titles-checkbox",
  );
  if (wrapTaskTitlesCheckbox) {
    const label = wrapTaskTitlesCheckbox.parentElement;
    const newText = translations[lang].wrapTaskTitlesHeader;
    // Clear label and re-add translated text followed by checkbox
    label.innerHTML = "";
    label.appendChild(document.createTextNode(newText));
    label.appendChild(wrapTaskTitlesCheckbox);
  } else {
    console.error("Could not find wrap task titles checkbox element.");
  }

  // Search Placeholder
  if (fuzzySearchInput) {
    fuzzySearchInput.placeholder = translations[lang].searchPlaceholder;
  } else {
    console.error("Could not find fuzzy search input element.");
  }

  // Description Label in Task Popup
  const descriptionLabel = document.querySelector(
    '#task-details-popup .task-details-popup-content label[for="task-description-textarea"]',
  );
  if (descriptionLabel) {
    descriptionLabel.firstChild.textContent =
      translations[lang].description + ":";
  } else {
    console.error("Could not find description label in task popup.");
  }
}

function getDatesForWeek(date) {
  const dayOfWeek = date.getDay();
  const diff = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);

  // *** Create a COPY of the input date to avoid modifying it ***
  const mondayBase = new Date(date);
  mondayBase.setDate(diff);
  const monday = new Date(mondayBase); // Create truly new Monday Date object
  monday.setHours(0, 0, 0, 0);

  const dates = [];
  for (let i = 0; i < 7; i++) {
    // *** Create a NEW Date based on Monday + i days - without modifying existing dates ***
    const nextDate = new Date(monday);
    const nextDay = new Date(nextDate); // Create a copy to avoid modifying 'nextDate' in place
    nextDay.setDate(monday.getDate() + i);
    dates.push(nextDay);
  }
  return dates;
}

function isCurrentWeek(date) {
  const now = new Date();
  const firstDayCurrentWeek = new Date(
    now.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1)),
  );
  const firstDayDisplayedWeek = getDatesForWeek(new Date(date))[0];
  return (
    firstDayCurrentWeek.getFullYear() === firstDayDisplayedWeek.getFullYear() &&
    firstDayCurrentWeek.getMonth() === firstDayDisplayedWeek.getMonth() &&
    firstDayCurrentWeek.getDate() === firstDayDisplayedWeek.getDate()
  );
}

async function fetchTasks(startDate, endDate) {
  try {
    const response = await fetch(
      `/api/tasks?start_date=${startDate}&end-date=${endDate}`,
    );
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const tasks = await response.json();
    return tasks;
  } catch (error) {
    console.error("Could not fetch tasks:", error);
    return [];
  }
}

async function fetchInboxTasks() {
  try {
    const response = await fetch(`/api/tasks?date=inbox`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const tasks = await response.json();
    return tasks;
  } catch (error) {
    console.error("Could not fetch inbox tasks:", error);
    return [];
  }
}

async function fetchInboxTitle() {
  try {
    const response = await fetch("/api/inbox_title");
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    currentInboxTitle = data.inbox_title || "📦 Inbox"; // Update currentInboxTitle here
    return currentInboxTitle;
  } catch (error) {
    console.error("Could not fetch inbox title:", error);
    return "📦 Inbox";
  }
}

async function addTask(inputElement, taskContainer, dueDate = null) {
  const taskTitle = inputElement.value.trim();
  if (taskTitle) {
    try {
      const taskData = {
        title: taskTitle,
        due_date: dueDate,
        order: taskContainer.children.length,
        color: "",
        description: "",
      };

      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(taskData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const newTask = await response.json();

      const newEvent = await createEventElement(
        newTask.title,
        newTask.id,
        newTask.completed,
        newTask.color,
        newTask.description ? 1 : 0,
      );

      if (newEvent) {
        attachTaskEventListeners(newEvent, newTask.id);
        taskContainer.appendChild(newEvent);
      }
      inputElement.value = "";
    } catch (error) {
      console.error("Error adding task:", error);
    }
  }
}

function attachTaskEventListeners(eventElement, taskId) {
  eventElement.addEventListener("dragstart", handleDragStart);
  eventElement.addEventListener("dragend", handleDragEnd);
  eventElement.addEventListener("click", (event) => {
    if (!event.target.closest(".action-buttons")) {
      openTaskDetails(taskId);
    }
  });
}

async function renderInbox() {
  const lang = localStorage.getItem("language") || "ru";
  const inboxTitle = await fetchInboxTitle();
  inboxDiv.innerHTML = ""; // Clear existing content
  inboxDiv.style.backgroundColor = body.classList.contains("dark-theme")
    ? "var(--inbox-bg-dark)"
    : "var(--inbox-bg-light)"; // Apply initial style

  const headerDiv = document.createElement("div");
  headerDiv.classList.add("inbox-header");
  headerDiv.style.textAlign = "left"; // Ensure it's left by default
  headerDiv.textContent = inboxTitle;
  inboxDiv.appendChild(headerDiv);

  inboxHeaderElement = headerDiv;

  // Make Inbox title editable
  inboxHeaderElement.addEventListener("click", () => {
    if (!isEditingInboxTitle) {
      makeInboxTitleEditable();
    }
  });

  inboxDiv.addEventListener("dragover", allowDrop);
  inboxDiv.addEventListener("drop", handleDrop);
  // Fetch inbox tasks
  const inboxTasks = await fetchInboxTasks();
  const taskContainer = document.createElement("div");
  inboxDiv.appendChild(taskContainer);
  await renderTasks(inboxTasks, taskContainer);

  const inboxForm = document.createElement("form");
  inboxForm.classList.add("new-task-form");
  inboxForm.innerHTML = `<input type="text" placeholder="${translations[lang].newTaskSomeday}">`;
  inboxDiv.appendChild(inboxForm);

  inboxInputElement = inboxForm.querySelector('input[type="text"]');

  const handleInboxTaskEvent = async (event) => {
    await handleAddTaskEvent(event, inboxInputElement, taskContainer);
  };

  // Add task on form submit
  inboxForm.addEventListener("submit", handleInboxTaskEvent);

  // Add task on enter key press
  inboxInputElement.addEventListener("keydown", handleInboxTaskEvent);

  // Add task on input blur (unfocus)
  inboxInputElement.addEventListener("blur", handleInboxTaskEvent);

  // Focus task input when clicking in the inbox container
  inboxDiv.addEventListener("click", (event) => {
    if (
      event.target === inboxDiv ||
      (!event.target.closest(".event") &&
        !event.target.closest(".inbox-header"))
    ) {
      inboxInputElement.focus();
    }
  });
}

function makeInboxTitleEditable() {
  if (isEditingInboxTitle) return; // Prevent concurrent edits
  isEditingInboxTitle = true;

  const currentTitle = inboxHeaderElement.textContent;
  const inputElement = document.createElement("input");
  inputElement.type = "text";
  inputElement.value = currentTitle;
  inputElement.classList.add("inbox-title-input");
  inputElement.style.textAlign = "left"; // Keep the text left-aligned

  inboxHeaderElement.innerHTML = "";
  inboxHeaderElement.appendChild(inputElement);
  inputElement.focus();

  const handleSave = async () => {
    const newTitle = inputElement.value.trim();
    inboxHeaderElement.innerHTML = "";
    inboxHeaderElement.style.textAlign = "left"; // Ensure it's left by default

    if (newTitle !== currentTitle) {
      try {
        await saveInboxTitle(newTitle);
        inboxHeaderElement.textContent = newTitle; // Set the new title immediately
      } catch (error) {
        console.error("Error saving inbox title", error);
        inboxHeaderElement.textContent = currentTitle;
      }
    } else {
      inboxHeaderElement.textContent = currentTitle;
    }
    isEditingInboxTitle = false;
  };

  const handleCancel = () => {
    inboxHeaderElement.innerHTML = ""; // Clear the input
    inboxHeaderElement.textContent = currentTitle; // Revert to original title
    inboxHeaderElement.style.textAlign = "left"; // Ensure it's left by default
    isEditingInboxTitle = false;
  };

  inputElement.addEventListener("blur", handleSave);

  inputElement.addEventListener("keydown", async (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      await handleSave();
    } else if (event.key === "Escape") {
      event.preventDefault();
      handleCancel();
    }
  });
}

async function saveInboxTitle(newTitle) {
  try {
    const response = await fetch("/api/inbox_title", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inbox_title: newTitle }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    currentInboxTitle = newTitle; // Update currentInboxTitle after successful save
    // No need to update inboxHeaderElement.textContent here, it's done in handleSave
    return;
  } catch (error) {
    console.error("Error updating inbox title:", error);
    inboxHeaderElement.textContent =
      translations[localStorage.getItem("language") || "ru"].inbox;
    throw error;
  }
}

async function renderCalendarWeek(date) {
  const lang = localStorage.getItem("language") || "ru";
  const dates = getDatesForWeek(new Date(date));
  displayedWeekStartDate = dates[0];

  const firstDayOfMonth = dates[0];
  const lastDayOfMonth = dates[6];

  // Get month and year elements
  const monthSpan = monthNameElement.querySelector(".month");
  const yearSpan = monthNameElement.querySelector(".year");

  let monthPart, yearPart;
  if (firstDayOfMonth.getMonth() === lastDayOfMonth.getMonth()) {
    // Single month case
    monthPart = translations[lang].monthNames[firstDayOfMonth.getMonth()];
    yearPart = firstDayOfMonth.getFullYear().toString();
  } else {
    // Cross-month case
    const firstMonthName =
      translations[lang].monthNames[firstDayOfMonth.getMonth()];
    const lastMonthName =
      translations[lang].monthNames[lastDayOfMonth.getMonth()];
    const firstYear = firstDayOfMonth.getFullYear();
    const lastYear = lastDayOfMonth.getFullYear();

    monthPart = `${firstMonthName} - ${lastMonthName}`;
    yearPart =
      firstYear === lastYear
        ? firstYear.toString()
        : `${firstYear} - ${lastYear}`;
  }

  // Update separated elements
  monthSpan.textContent = monthPart;
  yearSpan.textContent = yearPart;

  const isThisCurrentWeek = isCurrentWeek(displayedWeekStartDate);
  monthNameElement.classList.toggle("inactive-highlight", !isThisCurrentWeek);

  // Fetch tasks for the week
  const startDate = dates[0].toLocaleDateString("en-CA");
  const endDate = dates[6].toLocaleDateString("en-CA");
  const weekTasks = await fetchTasks(startDate, endDate);

  // Clear existing day elements
  Object.values(dayElements).forEach((dayElement) => {
    dayElement.innerHTML = "";
  });

  const today = new Date();

  // Render each day of the week
  for (let index = 0; index < dates.length; index++) {
    const date = dates[index];
    const dayId = dayIds[index];
    const dayDiv = dayElements[dayId];
    const dayDateString = dates[index].toLocaleDateString("en-CA");

    dayDiv.dataset.date = dayDateString;
    dayDiv.addEventListener("dragover", allowDrop);
    dayDiv.addEventListener("drop", handleDrop);

    // Create day header
    const dayHeaderDiv = document.createElement("div");
    dayHeaderDiv.classList.add("day-header");
    if (isThisCurrentWeek && date.toDateString() === today.toDateString()) {
      dayHeaderDiv.classList.add("today-highlight");
    }
    const weekdayName = displayFullWeekdays
      ? translations[lang].dayNamesFull[(date.getDay() + 6) % 7]
      : translations[lang].dayNamesShort[(date.getDay() + 6) % 7];
    dayHeaderDiv.innerHTML = `<span class="day-number">${date.getDate()}</span><span class="day-weekday">${weekdayName}</span>`;
    dayDiv.appendChild(dayHeaderDiv);

    // Create task container
    const taskContainer = document.createElement("div");
    dayDiv.appendChild(taskContainer);

    // Filter and sort tasks
    const dailyTasks = weekTasks.filter((task) => {
      if (!task.due_date) return false;
      const dateParts = task.due_date.split("-");
      const taskDueDateUTC = new Date(
        Date.UTC(
          parseInt(dateParts[0], 10),
          parseInt(dateParts[1], 10) - 1,
          parseInt(dateParts[2], 10),
        ),
      );
      const dayDivDateLocal = new Date(dayDateString);

      return (
        taskDueDateUTC.toISOString().slice(0, 10) ===
        dayDivDateLocal.toISOString().slice(0, 10)
      );
    });
    dailyTasks.sort((a, b) => a.order - b.order);
    await renderTasks(dailyTasks, taskContainer);

    // Create new task form
    const newTaskForm = document.createElement("form");
    newTaskForm.classList.add("new-task-form");
    newTaskForm.innerHTML = `<input type="text" placeholder="${translations[lang].newTask}">`;
    dayDiv.appendChild(newTaskForm);

    // Input handling
    dayDiv.addEventListener("click", (event) => {
      if (
        event.target === dayDiv ||
        (!event.target.closest(".event") &&
          !event.target.closest(".day-header"))
      ) {
        newTaskForm.querySelector("input").focus();
      }
    });

    const newTaskInput = newTaskForm.querySelector("input");
    const addTaskHandler = async (event) => {
      await handleAddTaskEvent(
        event,
        newTaskInput,
        taskContainer,
        dayDateString,
      );
    };

    newTaskForm.addEventListener("submit", addTaskHandler);
    newTaskInput.addEventListener("keydown", addTaskHandler);
    newTaskInput.addEventListener("blur", addTaskHandler);
  }
}

async function handleAddTaskEvent(
  event,
  inputElement,
  taskContainer,
  dueDate = null,
) {
  if (
    event.type === "submit" ||
    (event.type === "keydown" && event.key === "Enter") ||
    event.type === "blur"
  ) {
    event.preventDefault();
    if (inputElement.value.trim()) {
      // Only add task if input is not empty after trim
      await addTask(inputElement, taskContainer, dueDate);
    }
  }
}

async function renderTasks(tasks, container) {
  if (!tasks || tasks.length === 0) return;

  container.innerHTML = ""; // Clear existing tasks before re-rendering

  for (const task of tasks) {
    const eventDiv = await createEventElement(
      task.title,
      task.id,
      task.completed,
      task.color,
      task.description ? 1 : 0,
    );
    if (eventDiv) {
      attachTaskEventListeners(eventDiv, task.id);
      container.appendChild(eventDiv);
    }
  }
}

async function createEventElement(
  taskTitle,
  taskId,
  completed = 0,
  color = "",
  has_description = 0,
) {
  return new Promise((resolve) => {
    const eventDiv = document.createElement("div");
    if (!eventDiv) {
      resolve(null);
      return;
    }
    eventDiv.classList.add("event");
    eventDiv.dataset.taskId = taskId;
    if (color) {
      eventDiv.dataset.taskColor = color;
    }

    eventDiv.draggable = true;
    eventDiv.style.backgroundColor = getTaskBackgroundColor(color);

    const eventContent = document.createElement("div");
    eventContent.classList.add("event-content");

    const leftActionButtons = document.createElement("div");
    leftActionButtons.classList.add("action-buttons", "left");

    const doneButton = document.createElement("button");
    doneButton.classList.add("done-button");
    doneButton.innerHTML = '<i class="far fa-check-circle"></i>';
    doneButton.style.display = completed === 1 ? "none" : "inline-block";
    doneButton.addEventListener("click", (event) => {
      event.stopPropagation();
      handleTaskCompletion(taskId, 1);
    });
    leftActionButtons.appendChild(doneButton);

    const undoneButton = document.createElement("button");
    undoneButton.classList.add("undone-button");
    undoneButton.innerHTML = '<i class="fas fa-check-circle"></i>';
    undoneButton.style.display = completed === 0 ? "none" : "inline-block";
    undoneButton.addEventListener("click", (event) => {
      event.stopPropagation();
      handleTaskCompletion(taskId, 0);
    });
    leftActionButtons.appendChild(undoneButton);

    eventContent.appendChild(leftActionButtons);

    const taskTextElement = document.createElement("span");
    taskTextElement.classList.add("task-text");
    taskTextElement.style.flexGrow = "1";
    taskTextElement.textContent = taskTitle;
    if (completed === 1) {
      taskTextElement.classList.add("completed");
    }
    if (wrapTaskTitles) {
      taskTextElement.classList.add("wrap");
      taskTextElement.classList.remove("no-wrap");
    } else {
      taskTextElement.classList.add("no-wrap");
      taskTextElement.classList.remove("wrap");
    }
    eventContent.appendChild(taskTextElement);

    // Add description icon if the task has a description
    if (has_description) {
      const descriptionIcon = document.createElement("i");
      descriptionIcon.classList.add(
        "fas",
        "fa-sticky-note",
        "description-icon",
      );
      descriptionIcon.title = "This task has a description";
      eventContent.appendChild(descriptionIcon); // Add the icon before the action buttons
    }

    const rightActionButtons = document.createElement("div");
    rightActionButtons.classList.add("action-buttons", "right");

    const deleteButton = document.createElement("button");
    deleteButton.classList.add("delete-button");
    deleteButton.innerHTML = '<i class="fas fa-times"></i>';
    deleteButton.addEventListener("click", (event) => {
      event.stopPropagation();
      handleDeleteTask(taskId);
    });
    rightActionButtons.appendChild(deleteButton);

    eventContent.appendChild(rightActionButtons);

    eventDiv.appendChild(eventContent);
    resolve(eventDiv);
  });
}

async function openTaskDetails(taskId) {
  currentTaskBeingViewed = taskId;
  try {
    const response = await fetch(`/api/tasks/${taskId}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const task = await response.json();

    // Make title editable
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
        await updateTaskDetails(taskId, { title: newTitle });
      }
      const taskElement = document.querySelector(
        `.event[data-task-id="${taskId}"]`,
      );
      if (taskElement) {
        const taskTextElement = taskElement.querySelector(".task-text");
        taskTextElement.textContent = newTitle;
      }
    };

    titleInput.addEventListener("blur", handleTitleBlur);

    // Populate date input
    if (task.due_date) {
      datePickerCurrentDate = new Date(task.due_date);
      taskDetailsDateInput.dataset.selectedDate = task.due_date;
      taskDetailsDateInput.textContent = new Date(
        task.due_date,
      ).toLocaleDateString(localStorage.getItem("language") || "ru", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } else {
      datePickerCurrentDate = new Date();
      taskDetailsDateInput.dataset.selectedDate = "";
      taskDetailsDateInput.textContent =
        translations[
          localStorage.getItem("language") || "ru"
        ].datePickerSetDate;
    }
    renderDatePicker(); // Render datepicker initially
    taskDetailsPopupOverlay.style.display = "flex";

    const updateTaskDateAndRefresh = async (newDate) => {
      if (!currentTaskBeingViewed) return;

      if (currentTaskBeingViewed) {
        await updateTaskDetails(currentTaskBeingViewed, { due_date: newDate });
        const taskElement = document.querySelector(
          `.event[data-task-id="${currentTaskBeingViewed}"]`,
        );
        if (taskElement) {
          taskElement.dataset.dueDate = newDate;
        }

        // Re-render calendar to reflect changes
        if (newDate) {
          const newDueDate = new Date(newDate);
          const firstDayOfNewWeek = getDatesForWeek(newDueDate)[0];
          const firstDayOfDisplayedWeek = getDatesForWeek(
            displayedWeekStartDate,
          )[0];

          if (
            !(
              firstDayOfNewWeek.getFullYear() ===
                firstDayOfDisplayedWeek.getFullYear() &&
              firstDayOfNewWeek.getMonth() ===
                firstDayOfDisplayedWeek.getMonth() &&
              firstDayOfNewWeek.getDate() === firstDayOfDisplayedWeek.getDate()
            )
          ) {
            displayedWeekStartDate = firstDayOfNewWeek;
            await renderCalendarWeek(displayedWeekStartDate);
          } else {
            await renderCalendarWeek(displayedWeekStartDate);
          }
        }
      }
      await renderInbox(); // Re-render inbox to remove task or add if date is null
      highlightTask(currentTaskBeingViewed);
    };

    const descriptionText = task.description || "";
    taskDescriptionTextarea.value = descriptionText;

    // Adjust textarea height initially based on content when popup opens
    adjustTextareaHeight(); // CALL adjustTextareaHeight() **BEFORE** setting rendered content and height!
    taskDescriptionRendered.innerHTML = marked.parse(descriptionText);
    taskDescriptionRendered.style.height = descriptionHeight; // Set initial height for rendered as well

    isDescriptionRenderedMode = false; // Initialize to editable mode
    taskDescriptionRendered.style.display = "none";
    taskDescriptionTextarea.style.display = "block";
    toggleDescriptionModeBtn.classList.remove("rendered-mode");
    descriptionModeIcon.style.color = "";

    taskDetailsPopupOverlay.style.display = "flex";

    // Set up color swatches
    const colorSwatches = document.querySelectorAll(".color-swatch");
    colorSwatches.forEach((swatch) => {
      swatch.onclick = async (event) => {
        let color = event.target.dataset.color;
        if (color === "no-color") {
          color = "";
        }

        if (currentTaskBeingViewed) {
          await updateTaskDetails(currentTaskBeingViewed, { color: color });
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

    adjustTextareaHeight();
  } catch (error) {
    console.error("Error fetching task details:", error);
  }
}

function getTaskBackgroundColor(color) {
  if (!color) return "transparent";
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

function closeTaskDetailsPopup() {
  taskDetailsPopupOverlay.style.display = "none";
  datePickerContainer.style.display = "none"; // Hide date picker when popup closes
  datePickerVisible = false;
  currentTaskBeingViewed = null;
}

async function updateTaskDetails(taskId, updates) {
  try {
    const response = await fetch(`/api/tasks/${taskId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const taskElement = document.querySelector(
      `.event[data-task-id="${taskId}"]`,
    );
    if (taskElement) {
      if (updates.description !== undefined) {
        const hasDescription = updates.description.trim() !== "";
        const descriptionIcon = taskElement.querySelector(".description-icon");

        if (hasDescription && !descriptionIcon) {
          const icon = document.createElement("i");
          icon.classList.add("fas", "fa-sticky-note", "description-icon");
          icon.title = "This task has a description";
          taskElement.querySelector(".task-text").after(icon);
        } else if (!hasDescription && descriptionIcon) {
          descriptionIcon.remove();
        }
      }
    }

    return true;
  } catch (error) {
    console.error("Error updating task details:", error);
    return false;
  }
}

function adjustTextareaHeight() {
  taskDescriptionTextarea.style.height = "auto"; // Reset height to recalculate
  let scrollHeight = taskDescriptionTextarea.scrollHeight;
  let newHeight = scrollHeight;

  // Apply minimum and maximum height constraints
  newHeight = Math.max(parseInt(minDescriptionHeight), newHeight);

  taskDescriptionTextarea.style.height = `${newHeight}px`;
  descriptionHeight = `${newHeight}px`; // Update stored height
  taskDescriptionRendered.style.height = descriptionHeight; // Keep rendered height in sync
}

taskDescriptionTextarea.addEventListener("input", () => {
  adjustTextareaHeight();
});

taskDescriptionTextarea.addEventListener("blur", async (event) => {
  if (currentTaskBeingViewed) {
    await updateTaskDetails(currentTaskBeingViewed, {
      description: event.target.value,
    });
    // Re-render markdown when textarea blurs only if in rendered mode
    if (isDescriptionRenderedMode) {
      const descriptionText = event.target.value || "";
      const renderedDescription = marked.parse(descriptionText);
      taskDescriptionRendered.innerHTML = renderedDescription;
      adjustTextareaHeight(); // Re-adjust height after blur in rendered mode
    } else {
      adjustTextareaHeight(); // Re-adjust height after blur in edit mode as well
    }
  }
});

closeTaskDetailsPopupBtn.addEventListener("click", closeTaskDetailsPopup);

taskDetailsPopupOverlay.addEventListener("click", (event) => {
  if (event.target === taskDetailsPopupOverlay) {
    const isTextSelected = window.getSelection().toString().length > 0;
    if (!isTextSelected) {
      closeTaskDetailsPopup();
    }
  }
});

deleteTaskDetailsBtn.addEventListener("click", async () => {
  if (currentTaskBeingViewed) {
    await handleDeleteTask(currentTaskBeingViewed);
    closeTaskDetailsPopup();
  }
});

toggleDescriptionModeBtn.addEventListener("click", () => {
  isDescriptionRenderedMode = !isDescriptionRenderedMode; // Toggle the mode

  if (isDescriptionRenderedMode) {
    // Switch to Rendered (View) Mode
    const descriptionText = taskDescriptionTextarea.value || "";
    const renderedDescription = marked.parse(descriptionText);
    taskDescriptionRendered.innerHTML = renderedDescription;
    taskDescriptionRendered.style.display = "block";
    taskDescriptionTextarea.style.display = "none";
    toggleDescriptionModeBtn.classList.add("rendered-mode");
    descriptionModeIcon.style.color = "";
    taskDescriptionRendered.style.height = descriptionHeight; // Apply stored height
  } else {
    // Switch to Edit Mode
    taskDescriptionRendered.style.display = "none";
    taskDescriptionTextarea.style.display = "block";
    toggleDescriptionModeBtn.classList.remove("rendered-mode");
    descriptionModeIcon.style.color = "";
    taskDescriptionTextarea.style.height = descriptionHeight; // Apply stored height
    taskDescriptionTextarea.focus(); // Focus on textarea for editing
    adjustTextareaHeight(); // Adjust height when switching back to edit mode
  }
});

function handleDragStart(event) {
  draggedTask = event.target;
  event.target.classList.add("dragging");
}

function handleDragEnd(event) {
  event.target.classList.remove("dragging");
  draggedTask = null;
  updateTaskOrder(event.target.parentNode);
}

function allowDrop(event) {
  event.preventDefault();
}

async function handleDrop(event) {
  event.preventDefault();

  const currentlyDraggedTask = draggedTask;

  if (!currentlyDraggedTask) {
    return;
  }

  const dropTarget = event.target;
  const taskId = currentlyDraggedTask.dataset.taskId;
  let newDueDate = null;
  let targetContainerElement = null;

  if (dropTarget.classList.contains("day")) {
    newDueDate = dropTarget.dataset.date;
    targetContainerElement = dropTarget.querySelector(
      ":scope > div:not(.day-header):not(.new-task-form)",
    );
  } else if (dropTarget.classList.contains("inbox")) {
    newDueDate = null;
    targetContainerElement = inboxDiv.querySelector(
      ":scope > div:not(.inbox-header):not(.new-task-form)",
    );
  } else if (dropTarget.closest(".day")) {
    newDueDate = dropTarget.closest(".day").dataset.date;
    targetContainerElement = dropTarget
      .closest(".day")
      .querySelector(":scope > div:not(.day-header):not(.new-task-form)");
  } else if (dropTarget.closest(".inbox")) {
    newDueDate = null;
    targetContainerElement = inboxDiv.querySelector(
      ":scope > div:not(.inbox-header):not(.new-task-form)",
    );
  }

  if (taskId && targetContainerElement) {
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ due_date: newDueDate }),
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const rect = targetContainerElement.getBoundingClientRect();
      const offsetY = event.clientY - rect.top;
      const tasks = Array.from(targetContainerElement.children);
      let insertBeforeTask = null;

      for (const task of tasks) {
        const taskRect = task.getBoundingClientRect();
        if (offsetY < taskRect.top - rect.top + taskRect.height / 2) {
          insertBeforeTask = task;
          break;
        }
      }

      if (insertBeforeTask) {
        targetContainerElement.insertBefore(
          currentlyDraggedTask,
          insertBeforeTask,
        );
      } else {
        targetContainerElement.appendChild(currentlyDraggedTask);
      }

      await updateTaskOrder(targetContainerElement);
    } catch (error) {
      console.error("Error updating task due date:", error);
    }
  }
}

function animateDrop(element, container) {
  element.style.transition = "transform 0.3s ease, opacity 0.3s ease";
  element.style.transform = "scale(1)";
  element.style.opacity = "1";

  container.appendChild(element);

  setTimeout(() => {
    element.style.transition = "";
  }, 300);
}

async function handleTaskCompletion(taskId, completed) {
  try {
    const response = await fetch(`/api/tasks/${taskId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ completed: completed }),
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const taskElement = document.querySelector(
      `.event[data-task-id="${taskId}"]`,
    );
    if (taskElement) {
      const doneButton = taskElement.querySelector(".done-button");
      const undoneButton = taskElement.querySelector(".undone-button");
      const taskTextElement = taskElement.querySelector(".task-text");

      if (completed === 1) {
        taskTextElement.classList.add("completed");
        doneButton.style.display = "none";
        undoneButton.style.display = "inline-block";
      } else {
        taskTextElement.classList.remove("completed");
        doneButton.style.display = "inline-block";
        undoneButton.style.display = "none";
      }
    }
  } catch (error) {
    console.error("Error updating task completion:", error);
  }
}

async function handleDeleteTask(taskId) {
  try {
    const response = await fetch(`/api/tasks/${taskId}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const taskElement = document.querySelector(
      `.event[data-task-id="${taskId}"]`,
    );
    if (taskElement) {
      taskElement.remove();
    }
  } catch (error) {
    console.error("Error deleting task:", error);
  }
}

async function updateTaskOrder(taskContainer) {
  const tasks = Array.from(taskContainer.children);
  const updates = tasks.map((task, index) => ({
    id: parseInt(task.dataset.taskId, 10),
    order: index,
  }));

  try {
    const response = await fetch("/api/tasks/bulk_update_order", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updates),
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  } catch (error) {
    console.error("Error updating task order:", error);
  }
}

function setTheme(theme) {
  currentTheme = theme;
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
    } else {
      body.classList.remove("dark-theme");
    }
  }
  document.querySelectorAll(".event").forEach((event) => {
    const color = event.dataset.taskColor;
    event.style.backgroundColor = getTaskBackgroundColor(color);
  });
  if (inboxDiv) {
    inboxDiv.style.backgroundColor = body.classList.contains("dark-theme")
      ? "var(--inbox-bg-dark)"
      : "var(--inbox-bg-light)";
  }
}

function setLanguage(lang) {
  localStorage.setItem("language", lang);
  if (inboxInputElement) {
    inboxInputElement.placeholder = translations[lang].newTaskSomeday;
  }
  renderCalendarWeek(displayedWeekStartDate);
  updateSettingsText();
  renderDatePicker(); // Re-render datepicker on language change
}

async function initializeCalendar() {
  const storedTheme = localStorage.getItem("theme") || "auto";
  themeSelect.value = storedTheme;
  setTheme(storedTheme);

  const storedLanguage = localStorage.getItem("language") || "ru";
  languageSelect.value = storedLanguage;
  setLanguage(storedLanguage);

  fullWeekdaysCheckbox.checked = displayFullWeekdays;
  wrapTaskTitlesCheckbox.checked = wrapTaskTitles;

  await renderCalendarWeek(currentDate);
  await renderInbox();
  await renderAllTasks();

  if (storedTheme === "auto") {
    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", (event) => {
        setTheme("auto");
      });
  }

  // ** Add event listener to monthNameElement for click **
  monthNameElement.addEventListener("click", handleMonthNameClick);
}

async function renderAllTasks() {
  // Re-render all tasks in calendar and inbox to apply display settings
  for (const dayId of dayIds) {
    const dayDiv = dayElements[dayId];
    const taskContainer = dayDiv.querySelector(
      ":scope > div:not(.day-header):not(.new-task-form)",
    );
    if (taskContainer) {
      const taskElements = Array.from(taskContainer.children);
      taskContainer.innerHTML = ""; // Clear existing tasks
      for (const taskElement of taskElements) {
        const taskId = taskElement.dataset.taskId;
        if (taskId) {
          const taskDetails = await fetchTaskDetailsById(taskId); // Fetch task details to re-create event element
          if (taskDetails) {
            const newEvent = await createEventElement(
              taskDetails.title,
              taskDetails.id,
              taskDetails.completed,
              taskDetails.color,
              taskDetails.description ? 1 : 0,
            );
            if (newEvent) {
              attachTaskEventListeners(newEvent, taskDetails.id);
              taskContainer.appendChild(newEvent);
            }
          }
        }
      }
    }
  }
  // Re-render inbox tasks
  const inboxTaskContainer = inboxDiv.querySelector(
    ":scope > div:not(.inbox-header):not(.new-task-form)",
  );
  if (inboxTaskContainer) {
    const inboxTaskElements = Array.from(inboxTaskContainer.children);
    inboxTaskContainer.innerHTML = ""; // Clear inbox tasks
    for (const taskElement of inboxTaskElements) {
      const taskId = taskElement.dataset.taskId;
      if (taskId) {
        const taskDetails = await fetchTaskDetailsById(taskId);
        if (taskDetails) {
          const newEvent = await createEventElement(
            taskDetails.title,
            taskDetails.id,
            taskDetails.completed,
            taskDetails.color,
            taskDetails.description ? 1 : 0,
          );
          if (newEvent) {
            attachTaskEventListeners(newEvent, taskDetails.id);
            inboxTaskContainer.appendChild(newEvent);
          }
        }
      }
    }
  }
}

async function fetchTaskDetailsById(taskId) {
  try {
    const response = await fetch(`/api/tasks/${taskId}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching task details:", error);
    return null;
  }
}

function handleMonthNameClick() {
  currentDate = new Date();
  displayedWeekStartDate = new Date(currentDate);
  renderCalendarWeek(currentDate);
}

// *** FUZZY SEARCH FUNCTIONS ***

async function displayFuzzySearchResults(query) {
  if (query.length === 0) {
    fuzzySearchResultsList.innerHTML = ""; // Clear results if query is empty
    return; // Return early if query is empty
  }

  try {
    const response = await fetch(
      `/api/search_tasks?query=${encodeURIComponent(query)}`,
    );
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const tasks = await response.json();

    fuzzySearchResultsList.innerHTML = ""; // Clear results before adding new ones

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
              {
                day: "numeric",
                month: "short",
              },
            )
          : currentInboxTitle; // Use currentInboxTitle when due_date is null
        listItem.innerHTML = `
          <div class="fuzzy-search-task-title">${task.title}</div>
          <div class="fuzzy-search-task-date">${taskDate}</div>
        `;
        listItem.addEventListener("click", () => {
          isSearchOpen = false;
          fuzzySearchPopup.style.display = "none";
          fuzzySearchResultsList.innerHTML = "";
          fuzzySearchInput.value = "";

          if (task.due_date) {
            currentDate = new Date(task.due_date);
            displayedWeekStartDate = new Date(currentDate);
            renderCalendarWeek(currentDate);
            highlightTask(task.id);
          } else {
            inboxDiv.scrollIntoView({ behavior: "smooth" });
            highlightTask(task.id);
          }
        });
        fuzzySearchResultsList.appendChild(listItem);
      });
    }
  } catch (error) {
    console.error("Error during fuzzy search:", error);
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

// *** DATE PICKER FUNCTIONS ***

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
    firstDayOfMonth.getDay() === 0 ? 6 : firstDayOfMonth.getDay() - 1; // Monday is 0

  datePickerMonthYear.textContent = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
  datePickerGrid.innerHTML = "";

  // Render day names
  for (let dayName of dayNamesShort) {
    const dayNameElement = document.createElement("div");
    dayNameElement.classList.add("date-picker-day-name");
    dayNameElement.textContent = dayName;
    datePickerGrid.appendChild(dayNameElement);
  }

  // Render empty cells for days before the first day of the month
  for (let i = 0; i < startDayOfWeek; i++) {
    const emptyCell = document.createElement("div");
    emptyCell.classList.add("date-picker-day", "inactive");
    datePickerGrid.appendChild(emptyCell);
  }

  // Render days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    const dayElement = document.createElement("div");
    dayElement.classList.add("date-picker-day");
    dayElement.textContent = day;
    // corrected date creation to prevent timezone issues
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
    // Highlight current day
    const today = new Date(); // define today here!
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
  await updateTaskDateAndRefresh(dateString);
}

async function updateTaskDateAndRefresh(newDate) {
  if (!currentTaskBeingViewed) return;

  if (currentTaskBeingViewed) {
    const taskElement = document.querySelector(
      `.event[data-task-id="${currentTaskBeingViewed}"]`,
    );
    let oldDayContainer = null;
    if (taskElement) {
      oldDayContainer = taskElement.parentNode; // Get the current parent day container
    }

    await updateTaskDetails(currentTaskBeingViewed, { due_date: newDate });

    if (
      newDate === null &&
      taskElement &&
      oldDayContainer &&
      oldDayContainer !==
        inboxDiv.querySelector(
          ":scope > div:not(.inbox-header):not(.new-task-form)",
        )
    ) {
      // If date is reset to inbox and task was in a day container, move it to inbox immediately
      const inboxTaskContainer = inboxDiv.querySelector(
        ":scope > div:not(.inbox-header):not(.new-task-form)",
      );
      if (inboxTaskContainer && taskElement) {
        oldDayContainer.removeChild(taskElement); // Remove from day
        inboxTaskContainer.appendChild(taskElement); // Add to inbox
        await updateTaskOrder(inboxTaskContainer); // Update order in inbox
      }
    }

    // Re-render calendar to reflect changes in days
    if (newDate) {
      const newDueDate = new Date(newDate);
      const firstDayOfNewWeek = getDatesForWeek(newDueDate)[0];
      const firstDayOfDisplayedWeek = getDatesForWeek(
        displayedWeekStartDate,
      )[0];

      if (
        !(
          firstDayOfNewWeek.getFullYear() ===
            firstDayOfDisplayedWeek.getFullYear() &&
          firstDayOfNewWeek.getMonth() === firstDayOfDisplayedWeek.getMonth() &&
          firstDayOfNewWeek.getDate() === firstDayOfDisplayedWeek.getDate()
        )
      ) {
        displayedWeekStartDate = firstDayOfNewWeek;
        await renderCalendarWeek(displayedWeekStartDate);
      } else {
        await renderCalendarWeek(displayedWeekStartDate);
      }
    }
    await renderInbox(); // Re-render inbox to remove task or add if date is null (re-render always to ensure inbox tasks are up to date)
    highlightTask(currentTaskBeingViewed);
  }
}

// *** EVENT LISTENERS ***

taskDetailsDateInput.addEventListener("click", (event) => {
  event.stopPropagation(); // Prevent popup overlay from closing datepicker immediately
  datePickerVisible = !datePickerVisible;
  datePickerContainer.style.display = datePickerVisible ? "block" : "none";
  if (datePickerVisible) {
    renderDatePicker(); // Re-render on every open to reflect current month/year
  }
});
datePickerContainer.addEventListener("click", (event) => {
  event.stopPropagation(); // Prevent closing when clicking inside datepicker
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
    await updateTaskDateAndRefresh(null);
  });

searchBtn.addEventListener("click", () => {
  isSearchOpen = !isSearchOpen;
  fuzzySearchPopup.style.display = isSearchOpen ? "block" : "none";
  if (isSearchOpen) {
    fuzzySearchInput.focus();
  } else {
    // Clear results when the popup is closed
    fuzzySearchResultsList.innerHTML = "";
    fuzzySearchInput.value = "";
  }
});

window.addEventListener("click", (event) => {
  if (
    isSearchOpen &&
    !event.target.closest(".fuzzy-search-popup") &&
    event.target !== searchBtn &&
    event.target !== fuzzySearchInput
  ) {
    isSearchOpen = false;
    fuzzySearchPopup.style.display = "none";
    // Clear results when the popup is closed by clicking outside
    fuzzySearchResultsList.innerHTML = "";
    fuzzySearchInput.value = "";
  }
  if (
    datePickerVisible &&
    !event.target.closest(".date-picker-container") &&
    event.target !== taskDetailsDateInput
  ) {
    datePickerContainer.style.display = "none";
    datePickerVisible = false;
  }
});

fuzzySearchInput.addEventListener("input", () => {
  clearTimeout(searchTimeout);
  const query = fuzzySearchInput.value.trim();

  searchTimeout = setTimeout(() => {
    displayFuzzySearchResults(query);
  }, 300);
});

Object.values(dayElements).forEach((dayDiv) => {
  dayDiv.addEventListener("click", async (event) => {
    if (
      popupOpen &&
      !event.target.closest(".event") &&
      !event.target.closest(".new-task-form") &&
      !event.target.closest(".day-header")
    ) {
      const clickedDate = dayDiv.dataset.date;
      const taskDateInput = document.getElementById("task-details-date");
      if (taskDateInput) {
        taskDateInput.value = clickedDate;
        if (currentTaskBeingViewed) {
          await updateTaskDateAndRefresh(clickedDate);
        }
      }
    }
  });
});

document.addEventListener("DOMContentLoaded", () => {
  initializeCalendar().then(() => {
    updateSettingsText();
  });
});

prevWeekButton.addEventListener("click", () => {
  displayedWeekStartDate.setDate(displayedWeekStartDate.getDate() - 7);
  renderCalendarWeek(displayedWeekStartDate);
});

nextWeekButton.addEventListener("click", () => {
  displayedWeekStartDate.setDate(displayedWeekStartDate.getDate() + 7);
  renderCalendarWeek(displayedWeekStartDate);
});

settingsBtn.addEventListener("click", () => {
  isSettingsOpen = !isSettingsOpen;
  settingsPopup.style.display = isSettingsOpen ? "block" : "none";
  fullWeekdaysCheckbox.checked = displayFullWeekdays;
  wrapTaskTitlesCheckbox.checked = wrapTaskTitles;
});

window.addEventListener("click", (event) => {
  if (
    isSettingsOpen &&
    !event.target.closest(".settings-popup") &&
    event.target !== settingsBtn
  ) {
    isSettingsOpen = false;
    settingsPopup.style.display = "none";
  }
});

themeSelect.addEventListener("change", (event) => {
  const selectedTheme = event.target.value;
  localStorage.setItem("theme", selectedTheme);
  setTheme(selectedTheme);
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

languageSelect.addEventListener("change", (event) => {
  setLanguage(event.target.value);
});

function handleCheckboxChange(checkbox) {
  const label = checkbox.closest("label.styled-checkbox");
  if (label) {
    label.classList.toggle("checked", checkbox.checked);
  }
}

fullWeekdaysCheckbox.addEventListener("change", (event) => {
  handleCheckboxChange(event.target);
  displayFullWeekdays = event.target.checked;
  localStorage.setItem("fullWeekdays", displayFullWeekdays);
  renderCalendarWeek(displayedWeekStartDate);
});

handleCheckboxChange(fullWeekdaysCheckbox); // Initialize state on load

wrapTaskTitlesCheckbox.addEventListener("change", async (event) => {
  handleCheckboxChange(event.target);
  wrapTaskTitles = event.target.checked;
  localStorage.setItem("wrapTaskTitles", wrapTaskTitles);
  await renderAllTasks();
});

handleCheckboxChange(wrapTaskTitlesCheckbox); // Initialize state on load
// Set Wrap Task Titles checkbox to checked by default
wrapTaskTitlesCheckbox.checked = true;
handleCheckboxChange(wrapTaskTitlesCheckbox);

function handleSystemThemeChange(event) {
  setTheme("auto");
}

taskDetailsPopupOverlay.addEventListener("show.popup", () => {
  popupOpen = true;
});

taskDetailsPopupOverlay.addEventListener("hide.popup", () => {
  popupOpen = false;
});

taskDetailsPopupOverlay.addEventListener("transitionend", () => {
  if (taskDetailsPopupOverlay.style.display === "flex") {
    popupOpen = true;
  } else {
    popupOpen = false;
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    // Close Task Details Popup
    if (taskDetailsPopupOverlay.style.display === "flex") {
      console.log("kek");
      closeTaskDetailsPopup();
      return;
    }

    // Close Settings Popup
    if (isSettingsOpen) {
      isSearchOpen = false;
      fuzzySearchPopup.style.display = "none";
      fuzzySearchResultsList.innerHTML = "";
      fuzzySearchInput.value = "";
      return;
    }

    // Close Date Picker
    if (datePickerVisible) {
      datePickerContainer.style.display = "none";
      datePickerVisible = false;
      return;
    }
  }
});
