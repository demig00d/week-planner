export const translations = {
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
    data: "Data",
    searchTasks: "Search Tasks",
    settingsTitle: "Settings",
    previousWeek: "Previous Week",
    nextWeek: "Next Week",
    toggleDescriptionMode: "Toggle Description Mode",
    markAsDone: "Mark as done",
    recurringTask: "Recurring task",
    reminderSet: "Reminder set",
    resetColor: "Reset Color",
    pickADate: "Pick a date",
    deleteTaskTitle: "Delete Task",
    closePopup: "Close",
    exportDatabaseTitle: "Export Database",
    importDatabaseTitle: "Import Database",
    colorBlue: "Blue",
    colorGreen: "Green",
    colorYellow: "Yellow",
    colorPink: "Pink",
    colorOrange: "Orange",
    markAsUndone: "Mark as undone",
    taskLinkCopied: "Task link copied",
    taskLinkCopyFailed: "Failed to copy task link",
    copyTaskLink: "Copy Task Link",
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
    data: "Данные",
    searchTasks: "Поиск задач",
    settingsTitle: "Настройки",
    previousWeek: "Предыдущая неделя",
    nextWeek: "Следующая неделя",
    toggleDescriptionMode: "Переключить режим описания",
    markAsDone: "Отметить как сделанное",
    recurringTask: "Повторяющаяся задача",
    reminderSet: "Напоминание установлено",
    resetColor: "Сбросить цвет",
    pickADate: "Выбрать дату",
    deleteTaskTitle: "Удалить задачу",
    closePopup: "Закрыть",
    exportDatabaseTitle: "Экспорт базы данных",
    importDatabaseTitle: "Импорт базы данных",
    colorBlue: "Синий",
    colorGreen: "Зеленый",
    colorYellow: "Желтый",
    colorPink: "Розовый",
    colorOrange: "Оранжевый",
    markAsUndone: "Отметить как не сделанное",
    taskLinkCopied: "Ссылка на задачу скопирована",
    taskLinkCopyFailed: "Не удалось скопировать ссылку на задачу",
    copyTaskLink: "Копировать ссылку на задачу",
  },
};

export function loadLanguage() {
  const lang = localStorage.getItem("language") || "ru";
  updateTranslations(lang);
  return lang;
}
export async function updateTranslations(lang) {
  let element_fuzzy_search_input =
    document.getElementById("fuzzy-search-input");
  if (element_fuzzy_search_input) {
    element_fuzzy_search_input.placeholder =
      translations[lang].searchPlaceholder;
  }

  let element_settings_popup_h3 = document.querySelector("#settings-popup h3");
  if (element_settings_popup_h3) {
    element_settings_popup_h3.textContent = translations[lang].settings;
    element_settings_popup_h3.title = translations[lang].settingsTitle;
  }

  let element_settings_btn = document.getElementById("settings-btn");
  if (element_settings_btn) {
    element_settings_btn.title = translations[lang].settingsTitle;
  }

  let element_search_btn = document.getElementById("search-btn");
  if (element_search_btn) {
    element_search_btn.title = translations[lang].searchTasks;
  }

  let element_prev_week_btn = document.getElementById("prev-week");
  if (element_prev_week_btn) {
    element_prev_week_btn.title = translations[lang].previousWeek;
  }

  let element_next_week_btn = document.getElementById("next-week");
  if (element_next_week_btn) {
    element_next_week_btn.title = translations[lang].nextWeek;
  }

  let element_settings_popup_label_theme = document.querySelector(
    '#settings-popup label[for="theme-select"]',
  );
  if (element_settings_popup_label_theme) {
    element_settings_popup_label_theme.textContent = translations[lang].theme;
  }

  let element_settings_popup_label_language = document.querySelector(
    '#settings-popup label[for="language-select-popup"]',
  );
  if (element_settings_popup_label_language) {
    element_settings_popup_label_language.textContent =
      translations[lang].language;
  }

  let element_theme_select_auto_option = document
    .getElementById("theme-select")
    .querySelector('option[value="auto"]');
  if (element_theme_select_auto_option) {
    element_theme_select_auto_option.textContent = translations[lang].themeAuto;
  }
  let element_theme_select_light_option = document
    .getElementById("theme-select")
    .querySelector('option[value="light"]');
  if (element_theme_select_light_option) {
    element_theme_select_light_option.textContent =
      translations[lang].themeLight;
  }
  let element_theme_select_dark_option = document
    .getElementById("theme-select")
    .querySelector('option[value="dark"]');
  if (element_theme_select_dark_option) {
    element_theme_select_dark_option.textContent = translations[lang].themeDark;
  }

  let element_settings_options_header = document.querySelector(
    ".settings-options-header",
  );
  if (element_settings_options_header) {
    element_settings_options_header.textContent =
      translations[lang].displayOptionsHeader;
    element_settings_options_header.title =
      translations[lang].displayOptionsHeader;
  }

  const fullWeekdaysCheckbox = document.getElementById(
    "full-weekdays-checkbox",
  );
  if (fullWeekdaysCheckbox) {
    const label = fullWeekdaysCheckbox.parentElement;
    const newText = translations[lang].fullWeekdaysHeader;
    label.innerHTML = ""; // Clear existing content
    label.appendChild(document.createTextNode(newText));
    label.appendChild(fullWeekdaysCheckbox);
    label.title = translations[lang].fullWeekdaysHeader;
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
    label.title = translations[lang].wrapWeekTitlesHeader;
  }

  let element_task_details_date = document.getElementById("task-details-date");
  if (element_task_details_date) {
    element_task_details_date.title = translations[lang].pickADate;
  }

  let element_toggle_description_mode_btn = document.getElementById(
    "toggle-description-mode-btn",
  );
  if (element_toggle_description_mode_btn) {
    element_toggle_description_mode_btn.title =
      translations[lang].toggleDescriptionMode;
  }

  let element_mark_done_task_details = document.getElementById(
    "mark-done-task-details",
  );
  if (element_mark_done_task_details) {
    // Dynamic tooltip based on data-completed attribute
    if (element_mark_done_task_details.dataset.completed === "1") {
      element_mark_done_task_details.title = translations[lang].markAsUndone;
    } else {
      element_mark_done_task_details.title = translations[lang].markAsDone;
    }
  }

  let element_recurring_task_details = document.getElementById(
    "recurring-task-details",
  );
  if (element_recurring_task_details) {
    element_recurring_task_details.title = translations[lang].recurringTask;
  }

  let element_reminder_task_details = document.getElementById(
    "reminder-task-details",
  );
  if (element_reminder_task_details) {
    element_reminder_task_details.title = translations[lang].reminderSet;
  }

  let element_delete_task_details = document.getElementById(
    "delete-task-details",
  );
  if (element_delete_task_details) {
    element_delete_task_details.title = translations[lang].deleteTaskTitle;
  }

  let element_close_task_details_popup = document.getElementById(
    "close-task-details-popup",
  );
  if (element_close_task_details_popup) {
    element_close_task_details_popup.title = translations[lang].closePopup;
  }

  let element_color_swatch_no_color = document.querySelector(
    ".color-swatch.selected-color[data-color='no-color']",
  );
  if (element_color_swatch_no_color) {
    element_color_swatch_no_color.title = translations[lang].resetColor;
  }

  let element_color_swatch_blue = document.querySelector(
    ".color-swatch.blue-swatch",
  );
  if (element_color_swatch_blue) {
    element_color_swatch_blue.title = translations[lang].colorBlue;
  }

  let element_color_swatch_green = document.querySelector(
    ".color-swatch.green-swatch",
  );
  if (element_color_swatch_green) {
    element_color_swatch_green.title = translations[lang].colorGreen;
  }

  let element_color_swatch_yellow = document.querySelector(
    ".color-swatch.yellow-swatch",
  );
  if (element_color_swatch_yellow) {
    element_color_swatch_yellow.title = translations[lang].colorYellow;
  }

  let element_color_swatch_pink = document.querySelector(
    ".color-swatch.pink-swatch",
  );
  if (element_color_swatch_pink) {
    element_color_swatch_pink.title = translations[lang].colorPink;
  }

  let element_color_swatch_orange = document.querySelector(
    ".color-swatch.orange-swatch",
  );
  if (element_color_swatch_orange) {
    element_color_swatch_orange.title = translations[lang].colorOrange;
  }

  let element_task_details_popup_description_label = document.querySelector(
    '#task-details-popup .task-details-popup-content label[for="task-description-textarea"]',
  );
  if (element_task_details_popup_description_label) {
    element_task_details_popup_description_label.firstChild.textContent =
      translations[lang].description + ":";
  }

  let element_date_picker_reset_date = document.getElementById(
    "date-picker-reset-date",
  );
  if (element_date_picker_reset_date) {
    element_date_picker_reset_date.innerText =
      translations[lang].datePickerSetDate;
    element_date_picker_reset_date.title = translations[lang].datePickerSetDate;
  }

  let element_export_db_btn = document.getElementById("export-db-btn");
  if (element_export_db_btn) {
    element_export_db_btn.title = translations[lang].exportDatabaseTitle;
  }

  let element_import_db_label = document.querySelector(".import-db-label");
  if (element_import_db_label) {
    element_import_db_label.title = translations[lang].importDatabaseTitle;
  }

  let element_copy_task_link_btn =
    document.getElementById("copy-task-link-btn");
  if (element_copy_task_link_btn) {
    element_copy_task_link_btn.title = translations[lang].copyTaskLink;
  }
}

export function setLanguage(lang) {
  localStorage.setItem("language", lang);
  updateTranslations(lang);
}
