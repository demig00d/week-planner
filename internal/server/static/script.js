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

const recurringTaskDetailsBtn = document.getElementById(
  "recurring-task-details",
);
const reminderTaskDetailsBtn = document.getElementById("reminder-task-details");

const markDoneTaskDetailsBtn = document.getElementById(
  "mark-done-task-details",
);
let currentTaskBeingViewed = null;
let isDescriptionRenderedMode = false;
let descriptionHeight = "100px";
let minDescriptionHeight = "50px";

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
if (localStorage.getItem("wrapTaskTitles") === null) {
  wrapTaskTitles = true;
} else {
  wrapTaskTitles = localStorage.getItem("wrapTaskTitles") !== "false";
}

const searchBtn = document.getElementById("search-btn");
const fuzzySearchPopup = document.getElementById("fuzzy-search-popup");
const fuzzySearchInput = document.getElementById("fuzzy-search-input");
const fuzzySearchResultsList = document.getElementById("fuzzy-search-results");
let isSearchOpen = false;
let searchTimeout = null;
let popupOpen = false;
let currentInboxTitle = "📦 Inbox";

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
    oneTaskLeft: "task left",
    tasksLeft: "tasks left",
    baseTitleName: "Week planner",
    noTodayTasks: "No tasks for today",
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
    oneTaskLeft: "задача осталась",
    tasksLeft: "задач(и) осталось",
    baseTitleName: "Планировщик недели",
    noTodayTasks: "Нет задач на сегодня",
  },
};
const TASK_COLORS = ["blue", "green", "yellow", "pink", "orange"];

let currentWeekTasks = [];
let todayTasks = [];
let eventSource = null;

async function updateSettingsText() {
  const lang = localStorage.getItem("language") || "ru";

  const settingsHeader = document.querySelector("#settings-popup h3");
  if (settingsHeader) {
    settingsHeader.textContent = translations[lang].settings;
  } else {
    console.error("Could not find settings header element.");
  }

  const themeLabel = document.querySelector(
    '#settings-popup label[for="theme-select"]',
  );
  if (themeLabel) {
    themeLabel.textContent = translations[lang].theme;
  } else {
    console.error("Could not find theme label element.");
  }

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

  const languageLabel = document.querySelector(
    '#settings-popup label[for="language-select-popup"]',
  );
  if (languageLabel) {
    languageLabel.textContent = translations[lang].language;
  } else {
    console.error("Could not find language label element.");
  }

  const displayOptionsHeaderElement = document.querySelector(
    ".settings-options-header",
  );
  if (displayOptionsHeaderElement) {
    displayOptionsHeaderElement.textContent =
      translations[lang].displayOptionsHeader;
  } else {
    console.error("Could not find display options header element.");
  }

  const fullWeekdaysCheckbox = document.getElementById(
    "full-weekdays-checkbox",
  );
  if (fullWeekdaysCheckbox) {
    const label = fullWeekdaysCheckbox.parentElement;
    const newText = translations[lang].fullWeekdaysHeader;
    label.innerHTML = "";
    label.appendChild(document.createTextNode(newText));
    label.appendChild(fullWeekdaysCheckbox);
  } else {
    console.error("Could not find full weekdays checkbox element.");
  }

  const wrapTaskTitlesCheckbox = document.getElementById(
    "wrap-task-titles-checkbox",
  );
  if (wrapTaskTitlesCheckbox) {
    const label = wrapTaskTitlesCheckbox.parentElement;
    const newText = translations[lang].wrapTaskTitlesHeader;
    label.innerHTML = "";
    label.appendChild(document.createTextNode(newText));
    label.appendChild(wrapTaskTitlesCheckbox);
  } else {
    console.error("Could not find wrap task titles checkbox element.");
  }

  if (fuzzySearchInput) {
    fuzzySearchInput.placeholder = translations[lang].searchPlaceholder;
  } else {
    console.error("Could not find fuzzy search input element.");
  }

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

function getWeekDates(date) {
  const dayOfWeek = date.getDay();
  const diff = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);

  const mondayBase = new Date(date);
  mondayBase.setDate(diff);
  const monday = new Date(mondayBase);
  monday.setHours(0, 0, 0, 0);

  const dates = [];
  for (let i = 0; i < 7; i++) {
    const nextDate = new Date(monday);
    const nextDay = new Date(nextDate);
    nextDay.setDate(monday.getDate() + i);
    dates.push(nextDay);
  }
  return dates;
}

function isDateCurrentWeek(date) {
  const now = new Date();
  const firstDayCurrentWeek = new Date(
    now.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1)),
  );
  const firstDayDisplayedWeek = getWeekDates(new Date(date))[0];
  return (
    firstDayCurrentWeek.getFullYear() === firstDayDisplayedWeek.getFullYear() &&
    firstDayCurrentWeek.getMonth() === firstDayDisplayedWeek.getMonth() &&
    firstDayCurrentWeek.getDate() === firstDayDisplayedWeek.getDate()
  );
}

async function requestTasksForWeek(startDate, endDate) {
  try {
    const response = await fetch(
      `/api/tasks?start_date=${startDate}&end_date=${endDate}`,
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

async function requestInboxTasks() {
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

async function requestInboxTitle() {
  try {
    const response = await fetch("/api/inbox_title");
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    currentInboxTitle = data.inbox_title || "📦 Inbox";
    return currentInboxTitle;
  } catch (error) {
    console.error("Could not fetch inbox title:", error);
    return "📦 Inbox";
  }
}

async function createTask(inputElement, taskContainer, dueDate = null) {
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
      if (dueDate === new Date().toLocaleDateString("en-CA")) {
        todayTasks.push(newTask);
      }
      if (dueDate) {
        currentWeekTasks.push(newTask);
      }

      const newEvent = await createEventElement(
        newTask.title,
        newTask.id,
        newTask.completed,
        newTask.color,
        newTask.description ? 1 : 0,
        newTask.due_date,
      );

      if (newEvent) {
        attachTaskEventListeners(newEvent, newTask.id);
        taskContainer.appendChild(newEvent);
      }
      inputElement.value = "";
      updateTabTitle();
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
  const inboxTitle = await requestInboxTitle();
  inboxDiv.innerHTML = "";
  inboxDiv.style.backgroundColor = body.classList.contains("dark-theme")
    ? "var(--inbox-bg-dark)"
    : "var(--inbox-bg-light)";

  const headerDiv = document.createElement("div");
  headerDiv.classList.add("inbox-header");
  headerDiv.style.textAlign = "left";
  headerDiv.textContent = inboxTitle;
  inboxDiv.appendChild(headerDiv);

  inboxHeaderElement = headerDiv;

  inboxHeaderElement.addEventListener("click", () => {
    if (!isEditingInboxTitle) {
      makeInboxTitleEditable();
    }
  });

  inboxDiv.addEventListener("dragover", allowDrop);
  inboxDiv.addEventListener("drop", handleDrop);
  const inboxTasks = await requestInboxTasks();
  const taskContainer = document.createElement("div");
  inboxDiv.appendChild(taskContainer);
  await renderTasks(inboxTasks, taskContainer);

  const inboxForm = document.createElement("form");
  inboxForm.classList.add("new-task-form");
  inboxForm.innerHTML = `<input type="text" placeholder="${translations[lang].newTaskSomeday}">`;
  inboxDiv.appendChild(inboxForm);

  inboxInputElement = inboxForm.querySelector('input[type="text"]');

  const handleInboxTaskEvent = async (event) => {
    await handleAddTaskInput(event, inboxInputElement, taskContainer);
  };

  inboxForm.addEventListener("submit", handleInboxTaskEvent);
  inboxInputElement.addEventListener("keydown", handleInboxTaskEvent);
  inboxInputElement.addEventListener("blur", handleInboxTaskEvent);

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
  if (isEditingInboxTitle) return;
  isEditingInboxTitle = true;

  const currentTitle = inboxHeaderElement.textContent;
  const inputElement = document.createElement("input");
  inputElement.type = "text";
  inputElement.value = currentTitle;
  inputElement.classList.add("inbox-title-input");
  inputElement.style.textAlign = "left";

  inboxHeaderElement.innerHTML = "";
  inboxHeaderElement.appendChild(inputElement);
  inputElement.focus();

  const handleSave = async () => {
    const newTitle = inputElement.value.trim();
    inboxHeaderElement.innerHTML = "";
    inboxHeaderElement.style.textAlign = "left";

    if (newTitle !== currentTitle) {
      try {
        await saveInboxTitle(newTitle);
        inboxHeaderElement.textContent = newTitle;
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
    inboxHeaderElement.innerHTML = "";
    inboxHeaderElement.textContent = currentTitle;
    inboxHeaderElement.style.textAlign = "left";
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
      body: JSON.stringify({
        inbox_title: newTitle,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    currentInboxTitle = newTitle;
    return;
  } catch (error) {
    console.error("Error updating inbox title:", error);
    inboxHeaderElement.textContent =
      translations[localStorage.getItem("language") || "ru"].inbox;
    throw error;
  }
}

async function renderWeekCalendar(date) {
  const lang = localStorage.getItem("language") || "ru";
  const dates = getWeekDates(new Date(date));
  displayedWeekStartDate = dates[0];

  const firstDayOfMonth = dates[0];
  const lastDayOfMonth = dates[6];

  const monthSpan = monthNameElement.querySelector(".month");
  const yearSpan = monthNameElement.querySelector(".year");

  let monthPart, yearPart;
  if (firstDayOfMonth.getMonth() === lastDayOfMonth.getMonth()) {
    monthPart = translations[lang].monthNames[firstDayOfMonth.getMonth()];
    yearPart = firstDayOfMonth.getFullYear().toString();
  } else {
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

  monthSpan.textContent = monthPart;
  yearSpan.textContent = yearPart;

  const isThisCurrentWeek = isDateCurrentWeek(displayedWeekStartDate);
  monthNameElement.classList.toggle("inactive-highlight", !isThisCurrentWeek);

  const startDate = dates[0].toLocaleDateString("en-CA");
  const endDate = dates[6].toLocaleDateString("en-CA");
  const weekTasks = await requestTasksForWeek(startDate, endDate);
  currentWeekTasks = weekTasks;

  Object.values(dayElements).forEach((dayElement) => {
    dayElement.innerHTML = "";
  });

  const today = new Date();

  for (let index = 0; index < dates.length; index++) {
    const date = dates[index];
    const dayId = dayIds[index];
    const dayDiv = dayElements[dayId];
    const dayDateString = dates[index].toLocaleDateString("en-CA");

    dayDiv.dataset.date = dayDateString;
    dayDiv.addEventListener("dragover", allowDrop);
    dayDiv.addEventListener("drop", handleDrop);

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

    const taskContainer = document.createElement("div");
    dayDiv.appendChild(taskContainer);

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

    const newTaskForm = document.createElement("form");
    newTaskForm.classList.add("new-task-form");
    newTaskForm.innerHTML = `<input type="text" placeholder="${translations[lang].newTask}">`;
    dayDiv.appendChild(newTaskForm);

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
      await handleAddTaskInput(
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
  updateTabTitle();
}

async function handleAddTaskInput(
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
      await createTask(inputElement, taskContainer, dueDate);
    }
  }
}

async function renderTasks(tasks, container) {
  if (!tasks || tasks.length === 0) return;

  container.innerHTML = "";

  for (const task of tasks) {
    const eventDiv = await createEventElement(
      task.title,
      task.id,
      task.completed,
      task.color,
      task.description ? 1 : 0,
      task.due_date,
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
  dueDate,
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
    if (dueDate) {
      eventDiv.dataset.dueDate = dueDate;
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

    if (has_description) {
      const descriptionIcon = document.createElement("i");
      descriptionIcon.classList.add(
        "fas",
        "fa-sticky-note",
        "description-icon",
      );
      descriptionIcon.title = "This task has a description";
      eventContent.appendChild(descriptionIcon);
    }

    const rightActionButtons = document.createElement("div");
    rightActionButtons.classList.add("action-buttons", "right");

    const deleteButton = document.createElement("button");
    deleteButton.classList.add("delete-button");
    deleteButton.innerHTML = '<i class="fas fa-times"></i>';
    deleteButton.addEventListener("click", (event) => {
      event.stopPropagation();
      deleteTask(taskId);
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
        await updateTaskDetails(taskId, {
          title: newTitle,
        });
        const taskIndex = currentWeekTasks.findIndex((t) => t.id === taskId);
        if (taskIndex !== -1) {
          currentWeekTasks[taskIndex].title = newTitle;
        }
        const todayTaskIndex = todayTasks.findIndex((t) => t.id === taskId);
        if (todayTaskIndex !== -1) {
          todayTasks[todayTaskIndex].title = newTitle;
        }
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
    renderDatePicker();
    taskDetailsPopupOverlay.style.display = "flex";

    const updateTaskDateAndRefresh = async (newDate) => {
      if (!currentTaskBeingViewed) return;

      if (currentTaskBeingViewed) {
        const taskElement = document.querySelector(
          `.event[data-task-id="${currentTaskBeingViewed}"]`,
        );
        const wasTodayTask =
          taskElement &&
          taskElement.dataset.dueDate ===
            new Date().toLocaleDateString("en-CA");
        const isTodayTask = newDate === new Date().toLocaleDateString("en-CA");

        await updateTaskDetails(currentTaskBeingViewed, {
          due_date: newDate,
        });
        const taskIndex = currentWeekTasks.findIndex((t) => t.id === taskId);
        if (taskIndex !== -1) {
          currentWeekTasks[taskIndex].due_date = newDate;
        }

        if (wasTodayTask && !isTodayTask) {
          todayTasks = todayTasks.filter(
            (task) => task.id !== currentTaskBeingViewed,
          );
        } else if (!wasTodayTask && isTodayTask) {
          const taskDetails = await fetchTaskDetailsById(
            currentTaskBeingViewed,
          );
          if (taskDetails) {
            todayTasks.push(taskDetails);
          }
        }

        if (taskElement) {
          taskElement.dataset.dueDate = newDate;
        }

        if (newDate) {
          const newDueDate = new Date(newDate);
          const firstDayOfNewWeek = getWeekDates(newDueDate)[0];
          const firstDayOfDisplayedWeek = getWeekDates(
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
            await renderWeekCalendar(displayedWeekStartDate);
          } else {
            await renderWeekCalendar(displayedWeekStartDate);
          }
        }
      }
      await renderInbox();
      highlightTask(currentTaskBeingViewed);
    };

    const descriptionText = task.description || "";
    taskDescriptionTextarea.value = descriptionText;

    adjustTextareaHeight();
    taskDescriptionRendered.innerHTML = marked.parse(descriptionText);
    taskDescriptionRendered.style.height = descriptionHeight;

    isDescriptionRenderedMode = false;
    taskDescriptionRendered.style.display = "none";
    taskDescriptionTextarea.style.display = "block";
    toggleDescriptionModeBtn.classList.remove("rendered-mode");
    descriptionModeIcon.style.color = "";

    taskDetailsPopupOverlay.style.display = "flex";

    const colorSwatches = document.querySelectorAll(".color-swatch");
    colorSwatches.forEach((swatch) => {
      swatch.onclick = async (event) => {
        let color = event.target.dataset.color;
        if (color === "no-color") {
          color = "";
        }

        if (currentTaskBeingViewed) {
          await updateTaskDetails(currentTaskBeingViewed, {
            color: color,
          });
          const taskIndex = currentWeekTasks.findIndex((t) => t.id === taskId);
          if (taskIndex !== -1) {
            currentWeekTasks[taskIndex].color = color;
          }
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

    updateMarkAsDoneButton(isCompleted);
    recurringTaskDetailsBtn.style.display = "inline-block";
    reminderTaskDetailsBtn.style.display = "inline-block";
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

function updateMarkAsDoneButton(isCompleted) {
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

function updateTaskCompletionDisplay(taskElement, completed) {
  handleTaskCompletionUI(taskElement, completed);
}

function closeTaskDetailsPopup() {
  taskDetailsPopupOverlay.style.display = "none";
  datePickerContainer.style.display = "none";
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
  taskDescriptionTextarea.style.height = "auto";
  let scrollHeight = taskDescriptionTextarea.scrollHeight;
  let newHeight = scrollHeight;

  newHeight = Math.max(parseInt(minDescriptionHeight), newHeight);

  taskDescriptionTextarea.style.height = `${newHeight}px`;
  descriptionHeight = `${newHeight}px`;
  taskDescriptionRendered.style.height = descriptionHeight;
}

taskDescriptionTextarea.addEventListener("input", () => {
  adjustTextareaHeight();
});

taskDescriptionTextarea.addEventListener("blur", async (event) => {
  if (currentTaskBeingViewed) {
    await updateTaskDetails(currentTaskBeingViewed, {
      description: event.target.value,
    });
    const taskIndex = currentWeekTasks.findIndex(
      (t) => t.id === currentTaskBeingViewed,
    );
    if (taskIndex !== -1) {
      currentWeekTasks[taskIndex].description = event.target.value;
    }
    if (isDescriptionRenderedMode) {
      const descriptionText = event.target.value || "";
      const renderedDescription = marked.parse(descriptionText);
      taskDescriptionRendered.innerHTML = renderedDescription;
      adjustTextareaHeight();
    } else {
      adjustTextareaHeight();
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
    deleteTask(currentTaskBeingViewed);
    closeTaskDetailsPopup();
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
    descriptionModeIcon.style.color = "";
    taskDescriptionRendered.style.height = descriptionHeight;
  } else {
    taskDescriptionRendered.style.display = "none";
    taskDescriptionTextarea.style.display = "block";
    toggleDescriptionModeBtn.classList.remove("rendered-mode");
    descriptionModeIcon.style.color = "";
    taskDescriptionTextarea.style.height = descriptionHeight;
    taskDescriptionTextarea.focus();
    adjustTextareaHeight();
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

  let dropTarget = event.target;
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
  } else if (
    dropTarget.classList.contains("day-header") ||
    dropTarget.classList.contains("day-number") ||
    dropTarget.classList.contains("day-weekday")
  ) {
    dropTarget = dropTarget.closest(".day");
    newDueDate = dropTarget.dataset.date;
    targetContainerElement = dropTarget.querySelector(
      ":scope > div:not(.day-header):not(.new-task-form)",
    );
  } else if (dropTarget.closest(".day")) {
    newDueDate = dropTarget.closest(".day").dataset.date;
    targetContainerElement = dropTarget
      .closest(".day")
      .querySelector(":scope > div:not(.day-header):not(.new-task-form)");
  } else if (dropTarget.closest(".inbox")) {
    newDueDate = dropTarget.closest(".inbox").dataset.date;
    targetContainerElement = inboxDiv.querySelector(
      ":scope > div:not(.inbox-header):not(.new-task-form)",
    );
  }

  if (taskId && targetContainerElement) {
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          due_date: newDueDate,
        }),
      });

      const todayString = new Date().toLocaleDateString("en-CA");
      const wasTodayTask = currentlyDraggedTask.dataset.dueDate === todayString;
      const isTodayTask = newDueDate === todayString;

      if (wasTodayTask && !isTodayTask) {
        todayTasks = todayTasks.filter((task) => task.id !== parseInt(taskId));
      } else if (!wasTodayTask && isTodayTask) {
        const taskDetails = await fetchTaskDetailsById(taskId);
        if (taskDetails) {
          todayTasks.push(taskDetails);
        }
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
  await refreshTodayTasks();
  updateTabTitle();
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
      body: JSON.stringify({
        completed: completed,
      }),
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const taskToUpdateIndex = todayTasks.findIndex(
      (task) => task.id === taskId,
    );
    if (taskToUpdateIndex !== -1) {
      todayTasks[taskToUpdateIndex].completed = completed;
    }
    const taskIndex = currentWeekTasks.findIndex((t) => t.id === taskId);
    if (taskIndex !== -1) {
      currentWeekTasks[taskIndex].completed = completed;
    }

    const taskElement = document.querySelector(
      `.event[data-task-id="${taskId}"]`,
    );
    if (taskElement) {
      handleTaskCompletionUI(taskElement, completed);
    }
  } catch (error) {
    console.error("Error updating task completion:", error);
  }
  updateTabTitle();
}

function handleTaskCompletionUI(taskElement, completed) {
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
async function deleteTask(taskId) {
  try {
    const response = await fetch(`/api/tasks/${taskId}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    todayTasks = todayTasks.filter((task) => task.id !== taskId);
    currentWeekTasks = currentWeekTasks.filter((task) => task.id !== taskId);

    const taskElement = document.querySelector(
      `.event[data-task-id="${taskId}"]`,
    );
    if (taskElement) {
      taskElement.remove();
      updateTabTitle();
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
    currentTheme = resolvedTheme;
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
  updateTabTitle();
}

function setLanguage(lang) {
  localStorage.setItem("language", lang);
  if (inboxInputElement) {
    inboxInputElement.placeholder = translations[lang].newTaskSomeday;
  }
  renderWeekCalendar(displayedWeekStartDate);
  updateSettingsText();
  renderDatePicker();
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

  await renderWeekCalendar(currentDate);
  await renderInbox();
  await renderAllTasks();
  await refreshTodayTasks();
  updateTabTitle();

  if (storedTheme === "auto") {
    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", (event) => {
        setTheme("auto");
      });
  }

  monthNameElement.addEventListener("click", resetCalendarToCurrentWeek);

  setupSSE();
}

async function refreshTodayTasks() {
  const today = new Date();
  const todayString = today.toLocaleDateString("en-CA");
  try {
    const tasks = await requestTasksForWeek(todayString, todayString);
    todayTasks = tasks;
  } catch (error) {
    console.error("Error fetching today's tasks:", error);
    todayTasks = [];
  }
  updateTabTitle();
}

async function renderAllTasks() {
  for (const dayId of dayIds) {
    const dayDiv = dayElements[dayId];
    const taskContainer = dayDiv.querySelector(
      ":scope > div:not(.day-header):not(.new-task-form)",
    );
    if (taskContainer) {
      const taskElements = Array.from(taskContainer.children);
      taskContainer.innerHTML = "";
      for (const taskElement of taskElements) {
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
              taskDetails.due_date,
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
  const inboxTaskContainer = inboxDiv.querySelector(
    ":scope > div:not(.inbox-header):not(.new-task-form)",
  );
  if (inboxTaskContainer) {
    const inboxTaskElements = Array.from(inboxTaskContainer.children);
    inboxTaskContainer.innerHTML = "";
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
            taskDetails.due_date,
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

function resetCalendarToCurrentWeek() {
  currentDate = new Date();
  displayedWeekStartDate = new Date(currentDate);
  renderWeekCalendar(currentDate);
}

async function displayFuzzySearchResults(query) {
  if (query.length === 0) {
    fuzzySearchResultsList.innerHTML = "";
    return;
  }

  try {
    const response = await fetch(
      `/api/search_tasks?query=${encodeURIComponent(query)}`,
    );
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const tasks = await response.json();

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
              {
                day: "numeric",
                month: "short",
              },
            )
          : currentInboxTitle;
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
            renderWeekCalendar(currentDate);
            highlightTask(task.id);
          } else {
            inboxDiv.scrollIntoView({
              behavior: "smooth",
            });
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
    {
      year: "numeric",
      month: "short",
      day: "numeric",
    },
  );
  datePickerContainer.style.display = "none";
  datePickerVisible = false;
  await updateTaskDueDate(dateString);
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

    await updateTaskDetails(currentTaskBeingViewed, {
      due_date: newDate,
    });

    const taskIndex = currentWeekTasks.findIndex(
      (t) => t.id === currentTaskBeingViewed,
    );
    if (taskIndex !== -1) {
      currentWeekTasks[taskIndex].due_date = newDate;
    }

    if (wasTodayTask && !isTodayTask) {
      todayTasks = todayTasks.filter(
        (task) => task.id !== currentTaskBeingViewed,
      );
    } else if (!wasTodayTask && isTodayTask) {
      const taskDetails = await fetchTaskDetailsById(currentTaskBeingViewed);
      if (taskDetails) {
        todayTasks.push(taskDetails);
      }
    }
    updateTabTitle();
  }

  if (newDate) {
    const newDueDate = new Date(newDate);
    const firstDayOfNewWeek = getWeekDates(newDueDate)[0];
    const firstDayOfDisplayedWeek = getWeekDates(displayedWeekStartDate)[0];

    if (
      !(
        firstDayOfNewWeek.getFullYear() ===
          firstDayOfDisplayedWeek.getFullYear() &&
        firstDayOfNewWeek.getMonth() === firstDayOfDisplayedWeek.getMonth() &&
        firstDayOfNewWeek.getDate() === firstDayOfDisplayedWeek.getDate()
      )
    ) {
      displayedWeekStartDate = firstDayOfNewWeek;
      await renderWeekCalendar(displayedWeekStartDate);
    } else {
      await renderWeekCalendar(displayedWeekStartDate);
    }
  } else {
    await renderWeekCalendar(displayedWeekStartDate);
  }
  await renderInbox();
  highlightTask(currentTaskBeingViewed);
}

markDoneTaskDetailsBtn.addEventListener("click", async () => {
  if (!currentTaskBeingViewed) return;
  const isCompleted = markDoneTaskDetailsBtn.dataset.completed === "1";
  const newCompletedStatus = isCompleted ? 0 : 1;
  handleTaskCompletion(currentTaskBeingViewed, newCompletedStatus);
  updateMarkAsDoneButton(newCompletedStatus === 1);
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
    await updateTaskDueDate(null);
  });

searchBtn.addEventListener("click", () => {
  isSearchOpen = !isSearchOpen;
  fuzzySearchPopup.style.display = isSearchOpen ? "block" : "none";
  if (isSearchOpen) {
    fuzzySearchInput.focus();
  } else {
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
          await updateTaskDueDate(clickedDate);
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
  renderWeekCalendar(displayedWeekStartDate);
});

nextWeekButton.addEventListener("click", () => {
  displayedWeekStartDate.setDate(displayedWeekStartDate.getDate() + 7);
  renderWeekCalendar(displayedWeekStartDate);
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
  renderWeekCalendar(displayedWeekStartDate);
});

handleCheckboxChange(fullWeekdaysCheckbox);

wrapTaskTitlesCheckbox.addEventListener("change", async (event) => {
  handleCheckboxChange(event.target);
  wrapTaskTitles = event.target.checked;
  localStorage.setItem("wrapTaskTitles", wrapTaskTitles);
  await renderAllTasks();
});

handleCheckboxChange(wrapTaskTitlesCheckbox);
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
      isSearchOpen = false;
      fuzzySearchPopup.style.display = "none";
      fuzzySearchResultsList.innerHTML = "";
      fuzzySearchInput.value = "";
      return;
    }

    if (isSearchOpen) {
      isSearchOpen = false;
      fuzzySearchPopup.style.display = "none";
      fuzzySearchResultsList.innerHTML = "";
      fuzzySearchInput.value = "";
      return;
    }
  }
});

function updateTabTitle() {
  let title =
    translations[localStorage.getItem("language") || "ru"].baseTitleName || "";
  document.title = title;
  updateFavicon(todayTasks.filter((task) => task.completed === 0).length);
}

function setupSSE() {
  eventSource = new EventSource("/api/events");

  eventSource.onopen = () => {};

  eventSource.onerror = (error) => {
    console.error("SSE error:", error);
    if (eventSource.readyState === EventSource.CLOSED) {
      setTimeout(setupSSE, 5000);
    }
  };

  eventSource.addEventListener("date-change", async (event) => {
    await refreshTodayTasks();
    updateTabTitle();
    renderWeekCalendar(currentDate);
  });
}

const faviconColors = {
  light: {
    empty: "lightgreen",
    singleDigit: "lightblue",
    multiple: "lightgrey",
    textColor: "#000000",
  },
  dark: {
    empty: "#4CAF50",
    singleDigit: "#64B5F6",
    multiple: "#9E9E9E",
    textColor: "#000000",
  },
};

const faviconEmptyTasks = `<svg width="80" height="80" xmlns="http://www.w3.org/2000/svg">
    <circle cx="40" cy="40" r="40" fill="{fillColor}"/>
    <text x="40" y="39" font-family="Arial" font-size="80" fill="{textColor}" text-anchor="middle" dominant-baseline="central">✓</text>
    </svg>`;

const faviconSingleDigitTasks = `<svg width="80" height="80" xmlns="http://www.w3.org/2000/svg">
    <circle cx="40" cy="40" r="40" fill="{fillColor}"/>
    <text x="40" y="39" font-family="Arial" font-size="80" fill="{textColor}" text-anchor="middle" dominant-baseline="central">{count}</text>
    </svg>`;

const faviconMultipleTasks = `<svg width="80" height="80" xmlns="http://www.w3.org/2000/svg">
    <circle cx="40" cy="40" r="40" fill="{fillColor}"/>
    <text x="40" y="39" font-family="Arial" font-size="80" fill="{textColor}" text-anchor="middle" dominant-baseline="central">∞</text>
    </svg>`;

function svgToDataUrl(svgString) {
  const encodedSVG = encodeURIComponent(svgString);
  return `data:image/svg+xml,${encodedSVG}`;
}

function updateFavicon(taskCount) {
  let faviconUrl = "";
  const themeColors =
    currentTheme === "dark" ? faviconColors.dark : faviconColors.light;
  const currentFaviconEmptyTasks = faviconEmptyTasks
    .replace("{fillColor}", themeColors.empty)
    .replace("{textColor}", themeColors.textColor);
  const currentFaviconSingleDigitTasks = faviconSingleDigitTasks
    .replace("{fillColor}", themeColors.singleDigit)
    .replace("{textColor}", themeColors.textColor);
  const currentFaviconMultipleTasks = faviconMultipleTasks
    .replace("{fillColor}", themeColors.multiple)
    .replace("{textColor}", themeColors.textColor);

  if (taskCount === 0) {
    faviconUrl = svgToDataUrl(currentFaviconEmptyTasks);
  } else if (taskCount < 10 && taskCount > 0) {
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
