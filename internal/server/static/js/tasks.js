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
    wrapTaskTitles = true; // Use initialWrapTaskTitles if defined
  }

  return new Promise((resolve) => {
    const eventDiv = document.createElement("div");
    if (!eventDiv) {
      resolve(null);
      return;
    }

    eventDiv.classList.add("event");
    eventDiv.dataset.taskId = task.id;
    if (task.color) eventDiv.dataset.taskColor = task.color;
    if (task.due_date) eventDiv.dataset.dueDate = task.due_date;
    eventDiv.draggable = true;
    eventDiv.style.backgroundColor = ui.getTaskBackgroundColor(task.color);

    const eventContent = document.createElement("div");
    eventContent.classList.add("event-content");

    const taskTextElement = document.createElement("span");
    taskTextElement.classList.add("task-text");
    taskTextElement.style.flexGrow = "1";
    taskTextElement.textContent = task.title;
    taskTextElement.classList.toggle("completed", task.completed === 1);
    taskTextElement.classList.toggle("wrap", wrapTaskTitles);
    taskTextElement.classList.toggle("no-wrap", !wrapTaskTitles);
    eventContent.appendChild(taskTextElement);

    // Description/Progress Icon Logic
    if (task.description) {
      const checkboxRegex = /^- \[([x ])\]/gm;
      const matches = task.description.match(checkboxRegex);
      if (matches && matches.length <= 9) {
        const total = matches.length;
        const checked = (task.description.match(/^- \[x\]/gm) || []).length;
        const progressElement = document.createElement("span");
        progressElement.classList.add("task-progress");
        progressElement.textContent = `${checked}/${total}`;
        eventContent.appendChild(progressElement);
      } else {
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

    // Done Button
    const doneButton = document.createElement("button");
    doneButton.classList.add("done-button");
    doneButton.innerHTML = '<i class="far fa-check-circle"></i>';
    doneButton.style.display = task.completed === 1 ? "none" : "inline-block";
    doneButton.addEventListener("click", (event) => {
      event.stopPropagation();
      handleTaskCompletion(task.id, 1, ui.todayTasks, (updatedTasks) => {
        ui.setTodayTasks(updatedTasks); // Use setter
        ui.updateTabTitle(); // Update favicon
      });
    });
    rightActionButtons.appendChild(doneButton);

    // Undone Button
    const undoneButton = document.createElement("button");
    undoneButton.classList.add("undone-button");
    undoneButton.innerHTML = '<i class="fas fa-check-circle"></i>';
    undoneButton.style.display = task.completed === 0 ? "none" : "inline-block";
    undoneButton.addEventListener("click", (event) => {
      event.stopPropagation();
      handleTaskCompletion(task.id, 0, ui.todayTasks, (updatedTasks) => {
        ui.setTodayTasks(updatedTasks); // Use setter
        ui.updateTabTitle(); // Update favicon
      });
    });
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
  if (!oldTaskElement) return; // Not currently rendered, nothing to do
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
    if (!event.target.closest("button")) {
      ui.openTaskDetails(taskId);
    } // Prevent opening on button click
  });
}

// Render a list of tasks into a container
export async function renderTasks(tasks, container) {
  if (!tasks || !container) return;
  container.innerHTML = "";

  // If lastDeletedTaskData exists, filter out the task with that ID temporarily
  const filteredTasks = tasks.filter(
    (task) => task.id !== ui.lastDeletedTaskData?.id,
  );

  // Render the filtered tasks
  for (const task of filteredTasks) {
    const eventDiv = await createTaskElement(task);
    if (eventDiv) {
      attachTaskEventListeners(eventDiv, task.id);
      container.appendChild(eventDiv);
    }
  }
}

// --- Drag and Drop Handlers ---

export function handleDragStart(event) {
  if (event.target.classList.contains("event")) {
    draggedTask = event.target;
    event.dataTransfer.effectAllowed = "move";
    setTimeout(() => {
      event.target.classList.add("dragging");
    }, 0);
  } else {
    event.preventDefault();
  }
}

export function handleDragEnd(event) {
  if (draggedTask) {
    draggedTask.classList.remove("dragging");
    draggedTask = null;
  }
  document
    .querySelectorAll(".drop-indicator")
    .forEach((indicator) => indicator.remove());
}

export function allowDrop(event) {
  event.preventDefault();
  if (!draggedTask) return;
  let dropTarget = event.target;
  let targetContainerElement = null;
  const inboxDiv = document.getElementById("inbox");
  const dayElement = dropTarget.closest(".day");
  const inboxElement = dropTarget.closest(".inbox");
  if (dayElement) {
    targetContainerElement = dayElement.querySelector(".task-container");
  } else if (inboxElement) {
    targetContainerElement = Array.from(inboxElement.children).find(
      (c) =>
        c.tagName === "DIV" &&
        !c.classList.contains("inbox-header") &&
        !c.classList.contains("new-task-form"),
    );
  }
  if (!targetContainerElement) return;
  let indicator = targetContainerElement.querySelector(".drop-indicator");
  if (!indicator) {
    indicator = document.createElement("div");
    indicator.className = "drop-indicator";
    targetContainerElement.appendChild(indicator);
  } else if (indicator.parentNode !== targetContainerElement) {
    targetContainerElement.appendChild(indicator);
  }
  const rect = targetContainerElement.getBoundingClientRect();
  const offsetY = event.clientY - rect.top;
  const tasks = Array.from(targetContainerElement.children).filter((c) =>
    c.classList.contains("event"),
  );
  let indicatorPosition = 0;
  if (tasks.length > 0) {
    let found = false;
    for (const task of tasks) {
      if (task === draggedTask) continue;
      const taskRect = task.getBoundingClientRect();
      const midY = taskRect.top - rect.top + taskRect.height / 2;
      if (offsetY < midY) {
        indicatorPosition = task.offsetTop;
        found = true;
        break;
      }
    }
    if (!found) {
      const last = tasks[tasks.length - 1];
      indicatorPosition = last.offsetTop + last.offsetHeight;
    }
  }
  indicator.style.top = `${indicatorPosition}px`;
}

export async function handleDrop(event, todayTasks, updateTodayTasks) {
  event.preventDefault();
  const inboxDiv = document.getElementById("inbox");
  const currentlyDraggedTask = draggedTask;
  document
    .querySelectorAll(".drop-indicator")
    .forEach((indicator) => indicator.remove());
  if (!currentlyDraggedTask) {
    console.warn("handleDrop: No task was being dragged.");
    return;
  }

  let dropTarget = event.target;
  const taskId = currentlyDraggedTask.dataset.taskId;
  let newDueDate = null;
  let targetContainerElement = null;
  const dayElement = dropTarget.closest(".day");
  const inboxElement = dropTarget.closest(".inbox");
  if (dayElement) {
    newDueDate = dayElement.dataset.date;
    targetContainerElement = dayElement.querySelector(".task-container");
  } else if (inboxElement) {
    newDueDate = null;
    targetContainerElement = Array.from(inboxElement.children).find(
      (c) =>
        c.tagName === "DIV" &&
        !c.classList.contains("inbox-header") &&
        !c.classList.contains("new-task-form"),
    );
  }
  if (!targetContainerElement) {
    const pDay = dropTarget.closest(".day");
    const pInbox = dropTarget.closest(".inbox");
    if (pDay) {
      newDueDate = pDay.dataset.date;
      targetContainerElement = pDay.querySelector(".task-container");
    } else if (pInbox) {
      newDueDate = null;
      targetContainerElement = Array.from(pInbox.children).find(
        (c) =>
          c.tagName === "DIV" &&
          !c.classList.contains("inbox-header") &&
          !c.classList.contains("new-task-form"),
      );
    }
  }
  if (!taskId || !targetContainerElement) {
    console.warn("handleDrop: Invalid drop target or task ID.", {
      taskId,
      targetContainerElement,
    });
    return;
  }

  try {
    const todayString = new Date().toLocaleDateString("en-CA");
    const wasTodayTask = currentlyDraggedTask.dataset.dueDate === todayString;
    const isTodayTask = newDueDate === todayString;
    const updates = { due_date: newDueDate };
    let recurrenceCleared = false;
    if (newDueDate === null) {
      updates.recurrence_rule = "";
      updates.recurrence_interval = 1;
      recurrenceCleared = true;
      console.log(`Task ${taskId} moved to Inbox. Clearing recurrence.`);
    }

    await api.updateTask(taskId, updates);
    console.log(
      `Task ${taskId} updated. Due date: ${newDueDate}, Recurrence cleared: ${recurrenceCleared}`,
    );

    if (todayTasks && updateTodayTasks) {
      let newTodayTasks = [...todayTasks];
      const taskIndex = newTodayTasks.findIndex(
        (t) => t.id === parseInt(taskId),
      );
      if (wasTodayTask && !isTodayTask && taskIndex > -1) {
        newTodayTasks.splice(taskIndex, 1);
        console.log(`Task ${taskId} removed from todayTasks array.`);
      } else if (
        (!wasTodayTask && isTodayTask && taskIndex === -1) ||
        taskIndex > -1
      ) {
        const taskDetails = await api.fetchTaskDetails(taskId);
        if (taskDetails) {
          if (taskIndex > -1) newTodayTasks[taskIndex] = taskDetails;
          else newTodayTasks.push(taskDetails);
          console.log(
            `Task ${taskId} details updated/added in todayTasks array.`,
          );
        }
      }
      updateTodayTasks(newTodayTasks); // Execute callback with updated state
    }

    const rect = targetContainerElement.getBoundingClientRect();
    const offsetY = event.clientY - rect.top;
    const tasksInContainer = Array.from(targetContainerElement.children).filter(
      (el) => el.classList.contains("event") && el !== currentlyDraggedTask,
    );
    let insertBeforeTask = null;
    for (const task of tasksInContainer) {
      const taskRect = task.getBoundingClientRect();
      const midY = taskRect.top - rect.top + taskRect.height / 2;
      if (offsetY < midY) {
        insertBeforeTask = task;
        break;
      }
    }
    if (insertBeforeTask)
      targetContainerElement.insertBefore(
        currentlyDraggedTask,
        insertBeforeTask,
      );
    else targetContainerElement.appendChild(currentlyDraggedTask);
    if (newDueDate) currentlyDraggedTask.dataset.dueDate = newDueDate;
    else delete currentlyDraggedTask.dataset.dueDate;

    await updateTaskOrder(targetContainerElement); // Update order after placement

    if (recurrenceCleared && ui.currentTaskBeingViewed === parseInt(taskId)) {
      ui.clearRecurrenceInPopup();
      console.log(`Recurrence UI cleared in popup for task ${taskId}.`);
    }
    ui.updateTabTitle(); // Update favicon
  } catch (error) {
    console.error("Error handling drop:", error);
    ui.showSnackbar("Error moving task.", true);
    await calendar.renderWeekCalendar(getDisplayedWeekStartDate());
    await calendar.renderInbox();
  }
}

export async function handleTaskCompletion(
  taskId,
  completed,
  todayTasks,
  updateTodayTasks,
) {
  let originalTaskDetails = null;
  try {
    // Fetch task details *before* update to check recurrence rule
    originalTaskDetails = await api.fetchTaskDetails(taskId);

    await api.updateTask(taskId, { completed: completed });

    if (todayTasks && updateTodayTasks) {
      let updatedTodayTasks = todayTasks
        .map((task) => {
          if (task.id === parseInt(taskId))
            return { ...task, completed: completed };
          return task;
        })
        .filter(Boolean);
      updateTodayTasks(updatedTodayTasks); // Execute callback

      // If a recurring task was marked complete, refresh calendar view
      if (
        completed === 1 &&
        originalTaskDetails &&
        originalTaskDetails.recurrence_rule
      ) {
        console.log("Recurring task completed, refreshing calendar view.");
        await calendar.renderWeekCalendar(getDisplayedWeekStartDate());
        await calendar.renderInbox(); // Also refresh inbox in case it was moved
      }
    }

    const taskElement = document.querySelector(
      `.event[data-task-id="${taskId}"]`,
    );
    if (taskElement) ui.handleTaskCompletionUI(taskElement, completed);
    if (ui.currentTaskBeingViewed === parseInt(taskId))
      ui.updateMarkAsDoneButton(completed === 1);
  } catch (error) {
    console.error("Error updating task completion:", error);
    ui.showSnackbar("Failed to update task status.", true);
  }
  // ui.updateTabTitle() is called by the callback now
}

export async function updateTaskOrder(taskContainer) {
  if (!taskContainer) {
    console.warn("updateTaskOrder: Invalid task container provided.");
    return;
  }
  const tasks = Array.from(taskContainer.children).filter((c) =>
    c.classList.contains("event"),
  );
  const updates = tasks.map((task, index) => ({
    id: parseInt(task.dataset.taskId, 10),
    order: index,
  }));
  if (updates.length > 0) {
    console.log("Updating task order:", updates);
    await api.updateTaskOrder(updates);
  }
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
    const el = document.getElementById(id);
    if (el) acc[id] = el;
    return acc;
  }, {});
  const inboxDiv = document.getElementById("inbox");

  for (const dayId of dayIds) {
    const dayDiv = dayElements[dayId];
    if (!dayDiv) continue;
    const taskContainer = dayDiv.querySelector(".task-container");
    if (!taskContainer) continue;
    const taskElements = Array.from(taskContainer.querySelectorAll(".event"));
    const tasksToRender = [];
    for (const taskElement of taskElements) {
      const taskId = taskElement.dataset.taskId;
      if (taskId) {
        const taskDetails = await api.fetchTaskDetails(taskId);
        if (taskDetails) tasksToRender.push(taskDetails);
      }
    }
    tasksToRender.sort((a, b) => a.order - b.order);
    await renderTasks(tasksToRender, taskContainer);
  }
  if (inboxDiv) {
    const inboxTaskContainer = Array.from(inboxDiv.children).find(
      (c) =>
        c.tagName === "DIV" &&
        !c.classList.contains("inbox-header") &&
        !c.classList.contains("new-task-form"),
    );
    if (inboxTaskContainer) {
      const inboxTaskElements = Array.from(
        inboxTaskContainer.querySelectorAll(".event"),
      );
      const tasksToRender = [];
      for (const taskElement of inboxTaskElements) {
        const taskId = taskElement.dataset.taskId;
        if (taskId) {
          const taskDetails = await api.fetchTaskDetails(taskId);
          if (taskDetails) tasksToRender.push(taskDetails);
        }
      }
      tasksToRender.sort((a, b) => a.order - b.order);
      await renderTasks(tasksToRender, inboxTaskContainer);
    }
  }
}

export function handleDragLeave(event) {
  let relatedTarget = event.relatedTarget;
  let currentTarget = event.currentTarget;
  // Check if the related target is outside the current target (the day/inbox container)
  if (!currentTarget.contains(relatedTarget)) {
    const indicator = currentTarget.querySelector(".drop-indicator");
    if (indicator) indicator.remove();
  }
}
