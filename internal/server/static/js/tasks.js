import * as api from "./api.js";
import * as ui from "./ui.js";
import * as calendar from "./calendar.js";
import { getDisplayedWeekStartDate } from "./app.js";
import { translations, loadLanguage } from "./localization.js";
import { TASK_COLORS } from "./config.js";
export let draggedTask = null;

// Create a task element (the DOM representation of a task)
export async function createTaskElement(task) {
  let wrapTaskTitles = localStorage.getItem("wrapTaskTitles") !== "false";
  if (localStorage.getItem("wrapTaskTitles") === null) {
    wrapTaskTitles = true;
  } else {
    wrapTaskTitles = localStorage.getItem("wrapTaskTitles") !== "false";
  }

  return new Promise((resolve) => {
    const eventDiv = document.createElement("div");
    if (!eventDiv) {
      resolve(null);
      return;
    }

    eventDiv.classList.add("event");
    eventDiv.dataset.taskId = task.id;
    if (task.color) {
      eventDiv.dataset.taskColor = task.color;
    }
    if (task.due_date) {
      eventDiv.dataset.dueDate = task.due_date;
    }
    eventDiv.draggable = true;
    eventDiv.style.backgroundColor = ui.getTaskBackgroundColor(task.color);

    const eventContent = document.createElement("div");
    eventContent.classList.add("event-content");

    const taskTextElement = document.createElement("span");
    taskTextElement.classList.add("task-text");
    taskTextElement.style.flexGrow = "1";
    taskTextElement.textContent = task.title;

    if (task.completed === 1) {
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

    if (task.description) {
      const checkboxRegex = /^- \[([x ])\]/gm;
      const matches = task.description.match(checkboxRegex);
      if (matches && matches.length <= 9) {
        const totalCheckboxes = matches.length;
        const checkedCheckboxes =
          task.description.match(/^- \[x\]/gm)?.length || 0;
        const progressText = `${checkedCheckboxes}/${totalCheckboxes}`;

        const progressElement = document.createElement("span");
        progressElement.classList.add("task-progress");
        progressElement.textContent = progressText;
        eventContent.appendChild(progressElement);
      } else if (task.description) {
        // Fallback to description icon if no checkboxes or more than 9
        const descriptionIcon = document.createElement("i");
        descriptionIcon.classList.add(
          "fas",
          "fa-sticky-note",
          "description-icon",
        );
        descriptionIcon.title = "This task has a description";
        eventContent.appendChild(descriptionIcon);
      }
    }

    const rightActionButtons = document.createElement("div");
    rightActionButtons.classList.add("action-buttons", "right");

    const doneButton = document.createElement("button");
    doneButton.classList.add("done-button");
    doneButton.innerHTML = '<i class="far fa-check-circle"></i>';
    doneButton.style.display = task.completed === 1 ? "none" : "inline-block";
    doneButton.addEventListener("click", (event) => {
      event.stopPropagation();
      handleTaskCompletion(task.id, 1, ui.todayTasks, async (updatedTasks) => {
        // Use the callback
        await ui.refreshTodayTasks(); // Refresh today's tasks.
        ui.updateTabTitle();
      });
    });
    rightActionButtons.appendChild(doneButton);

    const undoneButton = document.createElement("button");
    undoneButton.classList.add("undone-button");
    undoneButton.innerHTML = '<i class="fas fa-check-circle"></i>';
    undoneButton.style.display = task.completed === 0 ? "none" : "inline-block";
    undoneButton.addEventListener("click", (event) => {
      event.stopPropagation();
      handleTaskCompletion(task.id, 0, ui.todayTasks, async (updatedTasks) => {
        // Use the callback
        await ui.refreshTodayTasks(); // Refresh today's tasks.
        ui.updateTabTitle();
      });
    });
    rightActionButtons.appendChild(doneButton);
    rightActionButtons.appendChild(undoneButton);

    eventContent.appendChild(rightActionButtons);
    eventDiv.appendChild(eventContent);
    resolve(eventDiv);
  });
}

// Re-render a single task element
export async function reRenderTaskElement(taskId) {
  const taskDetails = await api.fetchTaskDetails(taskId);
  if (!taskDetails) {
    console.error("Task details not found for id:", taskId);
    return;
  }

  const oldTaskElement = document.querySelector(
    `.event[data-task-id="${taskId}"]`,
  );
  if (!oldTaskElement) {
    console.error("Old task element not found for id:", taskId);
    return;
  }

  const parentContainer = oldTaskElement.parentNode;
  if (!parentContainer) {
    console.error("Parent container not found for task id:", taskId);
    return;
  }

  const newTaskElement = await createTaskElement(taskDetails);
  if (!newTaskElement) {
    console.error("Failed to create new task element for id:", taskId);
    return;
  }

  attachTaskEventListeners(newTaskElement, taskId);

  parentContainer.replaceChild(newTaskElement, oldTaskElement);
}

// Attach event listeners to a task element
export function attachTaskEventListeners(eventElement, taskId) {
  eventElement.addEventListener("dragstart", handleDragStart);
  eventElement.addEventListener("dragend", handleDragEnd);
  eventElement.addEventListener("click", (event) => {
    if (!event.target.closest(".action-buttons")) {
      ui.openTaskDetails(taskId);
    }
  });
}

// Render a list of tasks into a container
export async function renderTasks(tasks, container) {
  if (!tasks) return;
  container.innerHTML = ""; // Clear existing tasks

  for (const task of tasks) {
    const eventDiv = await createTaskElement(task);
    if (eventDiv) {
      attachTaskEventListeners(eventDiv, task.id);
      container.appendChild(eventDiv);
    }
  }
}

export async function handleDragStart(event) {
  draggedTask = event.target;
  event.target.classList.add("dragging");
}

export async function handleDragEnd(event) {
  event.target.classList.remove("dragging");
  draggedTask = null;

  document
    .querySelectorAll(
      ".day > .task-container .drop-indicator, .inbox > div:not(.inbox-header):not(.new-task-form) .drop-indicator",
    )
    .forEach((indicator) => {
      indicator.remove();
    });
  updateTaskOrder(event.target.parentNode); // Use api function
}

export function allowDrop(event) {
  event.preventDefault();

  let dropTarget = event.target;
  let targetContainerElement = null;
  const inboxDiv = document.getElementById("inbox");

  if (dropTarget.classList.contains("day") || dropTarget.closest(".day")) {
    const dayElement = dropTarget.classList.contains("day")
      ? dropTarget
      : dropTarget.closest(".day");
    targetContainerElement = dayElement.querySelector(".task-container");
    if (!targetContainerElement) {
      console.warn("No task-container found in day:", dayElement);
      return;
    }
  } else if (
    dropTarget.classList.contains("inbox") ||
    dropTarget.closest(".inbox")
  ) {
    targetContainerElement = inboxDiv.querySelector(
      ":scope > div:not(.inbox-header):not(.new-task-form)",
    );
  } else if (
    dropTarget.classList.contains("day-header") ||
    dropTarget.classList.contains("day-number") ||
    dropTarget.classList.contains("day-weekday")
  ) {
    dropTarget = dropTarget.closest(".day");
    if (!dropTarget) return;
    targetContainerElement = dropTarget.querySelector(".task-container");
  } else if (
    dropTarget.classList.contains("event") ||
    dropTarget.closest(".event")
  ) {
    const eventElement = dropTarget.classList.contains("event")
      ? dropTarget
      : dropTarget.closest(".event");
    const dayElement = eventElement.closest(".day");
    if (dayElement) {
      targetContainerElement = dayElement.querySelector(".task-container");
    } else if (eventElement.closest(".inbox")) {
      targetContainerElement = inboxDiv.querySelector(
        ":scope > div:not(.inbox-header):not(.new-task-form)",
      );
    }
  }

  if (!targetContainerElement) return;

  let indicator = targetContainerElement.querySelector(".drop-indicator");
  if (!indicator) {
    indicator = document.createElement("div");
    indicator.className = "drop-indicator";
    targetContainerElement.appendChild(indicator);
  }

  const rect = targetContainerElement.getBoundingClientRect();
  const offsetY = event.clientY - rect.top;
  const tasks = Array.from(targetContainerElement.children).filter((child) =>
    child.classList.contains("event"),
  );
  let insertBeforeTask = null;
  let indicatorPosition = 0;

  if (tasks.length === 0) {
    indicator.style.top = `0px`;
    return;
  }

  let foundPosition = false;
  for (const task of tasks) {
    const taskRect = task.getBoundingClientRect();
    if (offsetY < taskRect.top - rect.top + taskRect.height / 2) {
      indicatorPosition = task.offsetTop;
      foundPosition = true;
      break;
    }
  }

  if (!foundPosition) {
    const lastTask = tasks[tasks.length - 1];
    indicatorPosition = lastTask.offsetTop + lastTask.offsetHeight;
  }

  indicator.style.top = `${indicatorPosition}px`;
}

// Corrected handleDrop to *only* use the callback
export async function handleDrop(event, todayTasks, updateTodayTasks) {
  event.preventDefault();
  const inboxDiv = document.getElementById("inbox");

  const currentlyDraggedTask = draggedTask;

  if (!currentlyDraggedTask) {
    return;
  }

  let dropTarget = event.target;
  const taskId = currentlyDraggedTask.dataset.taskId;
  let newDueDate = null;
  let targetContainerElement = null;

  if (dropTarget.classList.contains("day") || dropTarget.closest(".day")) {
    const dayElement = dropTarget.classList.contains("day")
      ? dropTarget
      : dropTarget.closest(".day");
    newDueDate = dayElement.dataset.date;
    targetContainerElement = dayElement.querySelector(".task-container");
    if (!targetContainerElement) {
      console.warn("No task-container found in day on drop:", dayElement);
      return;
    }
  } else if (
    dropTarget.classList.contains("inbox") ||
    dropTarget.closest(".inbox")
  ) {
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
    if (!dropTarget) return;
    newDueDate = dropTarget.dataset.date;
    targetContainerElement = dropTarget.querySelector(".task-container");
  } else if (
    dropTarget.classList.contains("event") ||
    dropTarget.closest(".event")
  ) {
    const eventElement = dropTarget.classList.contains("event")
      ? dropTarget
      : dropTarget.closest(".event");
    const dayElement = eventElement.closest(".day");
    if (dayElement) {
      newDueDate = dayElement.dataset.date;
      targetContainerElement = dayElement.querySelector(".task-container");
    } else if (eventElement.closest(".inbox")) {
      newDueDate = null;
      targetContainerElement = inboxDiv.querySelector(
        ":scope > div:not(.inbox-header):not(.new-task-form)",
      );
    }
  } else {
    return;
  }

  if (targetContainerElement) {
    const indicator = targetContainerElement.querySelector(".drop-indicator");
    if (indicator) {
      indicator.remove();
    }
  }

  if (taskId && targetContainerElement) {
    try {
      const todayString = new Date().toLocaleDateString("en-CA");
      const wasTodayTask = currentlyDraggedTask.dataset.dueDate === todayString;
      const isTodayTask = newDueDate === todayString;

      await api.updateTask(taskId, { due_date: newDueDate });

      // Use the callback to update todayTasks
      if (wasTodayTask && !isTodayTask) {
        const newTodayTasks = todayTasks.filter(
          (task) => task.id !== parseInt(taskId),
        );
        updateTodayTasks(newTodayTasks); // CORRECT: Use the callback
      } else if (!wasTodayTask && isTodayTask) {
        const taskDetails = await api.fetchTaskDetails(taskId);
        if (taskDetails) {
          updateTodayTasks([...todayTasks, taskDetails]); // CORRECT: Use the callback. Use spread for immutability.
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
  await ui.refreshTodayTasks();
  ui.updateTabTitle();
}

// Corrected handleTaskCompletion
export async function handleTaskCompletion(
  taskId,
  completed,
  todayTasks,
  updateTodayTasks,
) {
  try {
    await api.updateTask(taskId, { completed: completed });

    // Update todayTasks array if the task is in it
    if (todayTasks && updateTodayTasks) {
      const updatedTodayTasks = todayTasks.map((task) => {
        if (task.id === taskId) {
          return { ...task, completed: completed };
        }
        return task;
      });
      await calendar.renderWeekCalendar(getDisplayedWeekStartDate());
      updateTodayTasks(updatedTodayTasks);
    }

    const taskElement = document.querySelector(
      `.event[data-task-id="${taskId}"]`,
    );
    if (taskElement) {
      ui.handleTaskCompletionUI(taskElement, completed);
    }
  } catch (error) {
    console.error("Error updating task completion:", error);
  }
  ui.updateTabTitle();
}

// Updates the visual order of tasks and syncs with the backend.
export async function updateTaskOrder(taskContainer) {
  const tasks = Array.from(taskContainer.children);
  const updates = tasks.map((task, index) => ({
    id: parseInt(task.dataset.taskId, 10),
    order: index,
  }));

  await api.updateTaskOrder(updates);
}

export async function renderAllTasks() {
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
  const inboxDiv = document.getElementById("inbox");

  for (const dayId of dayIds) {
    const dayDiv = dayElements[dayId];
    const taskContainer = dayDiv.querySelector(".task-container");
    if (!taskContainer) continue;

    const taskElements = Array.from(taskContainer.children);
    taskContainer.innerHTML = "";
    for (const taskElement of taskElements) {
      const taskId = taskElement.dataset.taskId;
      if (taskId) {
        const taskDetails = await api.fetchTaskDetails(taskId);
        if (taskDetails) {
          const newEvent = await createTaskElement(taskDetails);
          if (newEvent) {
            attachTaskEventListeners(newEvent, taskDetails.id);
            taskContainer.appendChild(newEvent);
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
        const taskDetails = await api.fetchTaskDetails(taskId);
        if (taskDetails) {
          const newEvent = await createTaskElement(taskDetails);
          if (newEvent) {
            attachTaskEventListeners(newEvent, taskDetails.id);
            inboxTaskContainer.appendChild(newEvent);
          }
        }
      }
    }
  }
}

export function handleDragLeave(event) {
  let dropTarget = event.target;
  const inboxDiv = document.getElementById("inbox");
  let targetContainerElement = null;

  if (dropTarget.classList.contains("day")) {
    targetContainerElement = dropTarget.querySelector(".task-container");
  } else if (dropTarget.classList.contains("inbox")) {
    targetContainerElement = inboxDiv.querySelector(
      ":scope > div:not(.inbox-header):not(.new-task-form)",
    );
  } else if (
    dropTarget.classList.contains("day-header") ||
    dropTarget.classList.contains("day-number") ||
    dropTarget.classList.contains("day-weekday")
  ) {
    dropTarget = dropTarget.closest(".day");
    if (!dropTarget) return;
    targetContainerElement = dropTarget.querySelector(".task-container");
  } else if (dropTarget.closest(".day")) {
    targetContainerElement = dropTarget
      .closest(".day")
      .querySelector(".task-container");
  } else if (dropTarget.closest(".inbox")) {
    targetContainerElement = inboxDiv.querySelector(
      ":scope > div:not(.inbox-header):not(.new-task-form)",
    );
  }

  if (targetContainerElement) {
    const indicator = targetContainerElement.querySelector(".drop-indicator");
    if (indicator) {
      indicator.remove();
    }
  }
}
