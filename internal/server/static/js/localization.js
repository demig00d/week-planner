export let translations = {
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
    wrapWeekTitlesHeader: "Wrap week titles",
    displayOptionsHeader: "Display",
    themeAuto: "Auto",
    themeLight: "Light",
    themeDark: "Dark",
    description: "Description",
    oneTaskLeft: "task left",
    tasksLeft: "tasks left",
    baseTitleName: "Week planner",
    noTodayTasks: "No tasks for today",
    exportDatabase: "Export Database",
    importDatabase: "Import Database",
    importSuccess: "Database imported successfully!",
    importError: "Import failed",
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
    wrapWeekTitlesHeader: "Не сокращать заголовки задач",
    displayOptionsHeader: "Отображение",
    themeAuto: "Авто",
    themeLight: "Светлая",
    themeDark: "Тёмная",
    description: "Описание",
    oneTaskLeft: "задача осталась",
    tasksLeft: "задач(и) осталось",
    baseTitleName: "Планировщик недели",
    noTodayTasks: "Нет задач на сегодня",
    exportDatabase: "Экспорт базы данных",
    importDatabase: "Импорт базы данных",
    importSuccess: "База данных успешно импортирована!",
    importError: "Ошибка импорта",
  },
};

export function loadLanguage() {
  const lang = localStorage.getItem("language") || "ru"; // Default to Russian
  updateTranslations(lang);
  return lang;
}
export async function updateTranslations(lang) {
  document.getElementById("fuzzy-search-input").placeholder =
    translations[lang].searchPlaceholder;
  document.querySelector("#settings-popup h3").textContent =
    translations[lang].settings;

  document.querySelector(
    '#settings-popup label[for="theme-select"]',
  ).textContent = translations[lang].theme;
  document.querySelector(
    '#settings-popup label[for="language-select-popup"]',
  ).textContent = translations[lang].language;

  document
    .getElementById("theme-select")
    .querySelector('option[value="auto"]').textContent =
    translations[lang].themeAuto;
  document
    .getElementById("theme-select")
    .querySelector('option[value="light"]').textContent =
    translations[lang].themeLight;
  document
    .getElementById("theme-select")
    .querySelector('option[value="dark"]').textContent =
    translations[lang].themeDark;

  document.querySelector(".settings-options-header").textContent =
    translations[lang].displayOptionsHeader;

  const fullWeekdaysCheckbox = document.getElementById(
    "full-weekdays-checkbox",
  );
  if (fullWeekdaysCheckbox) {
    const label = fullWeekdaysCheckbox.parentElement;
    const newText = translations[lang].fullWeekdaysHeader;
    label.innerHTML = ""; // Clear existing content
    label.appendChild(document.createTextNode(newText));
    label.appendChild(fullWeekdaysCheckbox);
  }

  const wrapTaskTitlesCheckbox = document.getElementById(
    "wrap-task-titles-checkbox",
  );
  if (wrapTaskTitlesCheckbox) {
    const label = wrapTaskTitlesCheckbox.parentElement;
    const newText = translations[lang].wrapWeekTitlesHeader;
    label.innerHTML = "";
    label.appendChild(document.createTextNode(newText));
    label.appendChild(wrapTaskTitlesCheckbox);
  }

  document.querySelector(
    '#task-details-popup .task-details-popup-content label[for="task-description-textarea"]',
  ).firstChild.textContent = translations[lang].description + ":";
  document.getElementById("date-picker-reset-date").innerText =
    translations[lang].datePickerSetDate;
}
