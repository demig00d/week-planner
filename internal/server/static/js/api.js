const API_BASE = "/api";

// Fetch tasks for a specific date range
export async function fetchTasksForWeek(startDate, endDate) {
  try {
    const response = await fetch(
      `${API_BASE}/tasks?start_date=${startDate}&end_date=${endDate}`,
    );
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Could not fetch tasks:", error);
    return [];
  }
}

// Fetch tasks for the inbox
export async function fetchInboxTasks() {
  try {
    const response = await fetch(`${API_BASE}/tasks?date=inbox`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Could not fetch inbox tasks:", error);
    return [];
  }
}

// Fetch the inbox title
export async function fetchInboxTitle() {
  try {
    const response = await fetch(`${API_BASE}/inbox_title`);
    if (!response.ok) {
      throw new Error(
        `HTTP error! status: ${response.status} fetching inbox title.`,
      );
    }
    const data = await response.json();
    return data.inbox_title || "📦 Inbox";
  } catch (error) {
    console.error("Could not fetch inbox title, using default:", error);
    return "📦 Inbox";
  }
}

// Create a new task
export async function createTask(taskData) {
  try {
    const response = await fetch(`${API_BASE}/tasks`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(taskData),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `HTTP error! status: ${response.status}, error: ${errorText}`,
      );
    }
    return await response.json();
  } catch (error) {
    console.error("Error creating task:", error);
    throw error; // Re-throw to handle in calling function
  }
}

// Fetch a single task by ID
export async function fetchTaskDetails(taskId) {
  try {
    const response = await fetch(`${API_BASE}/tasks/${taskId}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching task details:", error);
    return null;
  }
}

// Update a task
export async function updateTask(taskId, updates) {
  try {
    const response = await fetch(`${API_BASE}/tasks/${taskId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updates),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `HTTP error! status: ${response.status}, error: ${errorText}`,
      );
    }
    return true;
  } catch (error) {
    console.error("Error updating task:", error);
    return false;
  }
}

// Delete a task
export async function deleteTask(taskId) {
  try {
    const response = await fetch(`${API_BASE}/tasks/${taskId}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return true;
  } catch (error) {
    console.error("Error deleting task:", error);
    return false;
  }
}

// Update the order of multiple tasks
export async function updateTaskOrder(updates) {
  try {
    const response = await fetch(`${API_BASE}/tasks/bulk_update_order`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updates),
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return true;
  } catch (error) {
    console.error("Error updating task order:", error);
    return false;
  }
}

// Save the inbox title
export async function saveInboxTitle(newTitle) {
  try {
    const response = await fetch(`${API_BASE}/inbox_title`, {
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
    return;
  } catch (error) {
    console.error("Error updating inbox title:", error);
    throw error;
  }
}

// searchTasks performs a fuzzy search for tasks with pagination.
export async function searchTasks(query, pageSize, page) {
  try {
    const response = await fetch(
      `${API_BASE}/search_tasks?query=${encodeURIComponent(query)}&pageSize=${pageSize}&page=${page}`,
    );
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const tasks = await response.json();
    return tasks;
  } catch (error) {
    console.error("Error during fuzzy search:", error);
    return []; // Return an empty array on error
  }
}

/**
 * Checks and creates recurring tasks on the server.
 * @returns {Promise<boolean>} True if successful, false otherwise.
 */
export async function checkRecurringTasks() {
  try {
    const response = await fetch(`${API_BASE}/check_recurring_tasks`, {
      method: "POST",
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    console.log("Checked and created recurring tasks");
    return true;
  } catch (error) {
    console.error("Could not check/create recurring tasks:", error);
    return false;
  }
}

// Fetch Today tasks
export async function fetchTodayTasks() {
  const todayString = new Date().toLocaleDateString("en-CA");
  try {
    const tasks = await fetchTasksForWeek(todayString, todayString);
    return tasks;
  } catch (error) {
    console.error("Error fetching today's tasks:", error);
    return [];
  }
}
