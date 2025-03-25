import * as api from "./api.js";
import * as tasks from "./tasks.js";
import * as ui from "./ui.js";
import * as utils from "./utils.js";
import { translations } from "./localization.js";
import { dayIds } from "./config.js";

const monthNameElement = document.querySelector(".month-name");
const dayElements = dayIds.reduce((acc, id) => {
  acc[id] = document.getElementById(id);
  return acc;
}, {});
const inboxDiv = document.getElementById("inbox");
let inboxHeaderElement = null;
let isEditingInboxTitle = false;

// Define the drop handler OUTSIDE of renderWeekCalendar and renderInbox,
// and accept todayTasks and update function as parameters.
async function handleDayDrop(event, todayTasks, updateTodayTasks) {
  await tasks.handleDrop(event, todayTasks, updateTodayTasks);
}

export async function renderWeekCalendar(date) {
  const lang = localStorage.getItem("language") || "ru";
  const dates = utils.getWeekDates(new Date(date));
  const displayedWeekStartDate = dates[0];

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

  const isThisCurrentWeek = utils.isDateCurrentWeek(displayedWeekStartDate);
  monthNameElement.classList.toggle("inactive-highlight", !isThisCurrentWeek);

  const startDate = dates[0].toLocaleDateString("en-CA");
  const endDate = dates[6].toLocaleDateString("en-CA");
  const weekTasks = await api.fetchTasksForWeek(startDate, endDate);

  Object.values(dayElements).forEach((dayElement) => {
    dayElement.innerHTML = "";
  });

  const today = new Date();
  let displayFullWeekdays = localStorage.getItem("fullWeekdays") === "true";

  for (let index = 0; index < dates.length; index++) {
    const date = dates[index];
    const dayId = dayIds[index];
    const dayDiv = dayElements[dayId];
    const dayDateString = dates[index].toLocaleDateString("en-CA");

    dayDiv.dataset.date = dayDateString;
    dayDiv.addEventListener("dragover", tasks.allowDrop);
    // Pass todayTasks and the update function to the handler
    dayDiv.addEventListener("drop", (event) =>
      handleDayDrop(event, ui.todayTasks, async (newTasks) => {
        await ui.refreshTodayTasks(); // Use the existing function
        ui.updateTabTitle();
      }),
    );
    dayDiv.addEventListener("dragleave", tasks.handleDragLeave);

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
    taskContainer.classList.add("task-container");
    // Initially hide the container if we are going to render tasks into it.
    // We'll make it visible after tasks (or lack thereof) are added.
    taskContainer.style.visibility = "hidden";
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
    await tasks.renderTasks(dailyTasks, taskContainer);
    // Make the container visible after rendering.
    taskContainer.style.visibility = "visible";

    const newTaskForm = document.createElement("form");
    newTaskForm.classList.add("new-task-form");
    newTaskForm.innerHTML = `<input type="text" placeholder="${translations[lang].newTask}">`;
    dayDiv.appendChild(newTaskForm);

    const newTaskInput = newTaskForm.querySelector('input[type="text"]');

    const addTaskHandler = async (event) => {
      if (
        event.type === "submit" ||
        (event.type === "keydown" && event.key === "Enter") ||
        event.type === "blur"
      ) {
        event.preventDefault();
        if (newTaskInput.value.trim()) {
          const taskData = {
            title: newTaskInput.value.trim(),
            due_date: dayDateString,
            order: taskContainer.children.length,
            color: "",
            description: "",
          };
          try {
            const newTask = await api.createTask(taskData);
            //Correct todayTasks update
            if (newTask.due_date === new Date().toLocaleDateString("en-CA")) {
              ui.todayTasks.push(newTask);
            }
            const newEvent = await tasks.createTaskElement(newTask);
            if (newEvent) {
              tasks.attachTaskEventListeners(newEvent, newTask.id);
              taskContainer.appendChild(newEvent);
            }
            newTaskInput.value = "";
            ui.updateTabTitle();
          } catch (error) {
            console.error("Error adding task:", error);
          }
        }
      }
    };

    newTaskForm.addEventListener("submit", addTaskHandler);
    newTaskInput.addEventListener("keydown", addTaskHandler);
    newTaskInput.addEventListener("blur", addTaskHandler);
    dayDiv.addEventListener("click", (event) => {
      if (
        event.target === dayDiv ||
        (!event.target.closest(".event") &&
          !event.target.closest(".day-header"))
      ) {
        newTaskForm.querySelector("input").focus();
      }
    });
  }
  ui.updateTabTitle();
}

export async function renderInbox() {
  const lang = localStorage.getItem("language") || "ru";
  const inboxTitle = await api.fetchInboxTitle();
  inboxDiv.innerHTML = "";
  inboxDiv.style.backgroundColor = document.body.classList.contains(
    "dark-theme",
  )
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

  inboxDiv.addEventListener("dragover", tasks.allowDrop);
  // Pass todayTasks and the update function to the handler
  inboxDiv.addEventListener("drop", (event) =>
    handleDayDrop(event, ui.todayTasks, async (newTasks) => {
      await ui.refreshTodayTasks();
      ui.updateTabTitle();
    }),
  );
  inboxDiv.addEventListener("dragleave", tasks.handleDragLeave);

  const inboxTasks = await api.fetchInboxTasks();
  inboxTasks.sort((a, b) => a.order - b.order); // Ensure inbox tasks are sorted
  const taskContainer = document.createElement("div");
  // Initially hide the container, make visible after rendering
  taskContainer.style.visibility = "hidden";
  inboxDiv.appendChild(taskContainer);
  await tasks.renderTasks(inboxTasks, taskContainer);

  const inboxForm = document.createElement("form");
  inboxForm.classList.add("new-task-form");
  inboxForm.innerHTML = `<input type="text" placeholder="${translations[lang].newTaskSomeday}">`;
  inboxDiv.appendChild(inboxForm);
  // Make the task container visible after rendering tasks and adding the form.
  taskContainer.style.visibility = "visible";
  const inboxInputElement = inboxForm.querySelector('input[type="text"]');

  const handleInboxTaskEvent = async (event) => {
    if (
      event.type === "submit" ||
      (event.type === "keydown" && event.key === "Enter") ||
      event.type === "blur"
    ) {
      event.preventDefault();
      if (inboxInputElement.value.trim()) {
        const taskData = {
          title: inboxInputElement.value.trim(),
          due_date: null, // No due date for inbox tasks
          order: taskContainer.children.length, // Append at the end
          color: "",
          description: "",
        };

        try {
          const newTask = await api.createTask(taskData);
          const newEvent = await tasks.createTaskElement(newTask);
          if (newEvent) {
            tasks.attachTaskEventListeners(newEvent, newTask.id);
            taskContainer.appendChild(newEvent);
          }
          inboxInputElement.value = "";
          ui.updateTabTitle();
        } catch (error) {
          console.error("Error adding task:", error);
        }
      }
    }
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
        await api.saveInboxTitle(newTitle);
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
