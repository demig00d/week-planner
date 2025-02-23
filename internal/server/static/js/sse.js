import * as ui from "./ui.js";
import * as calendar from "./calendar.js";
import * as tasks from "./tasks.js";

export function setupSSE() {
  const eventSource = new EventSource("/api/events");

  eventSource.onopen = () => {
    // console.log("SSE connection opened");
  };

  eventSource.onerror = (error) => {
    console.error("SSE error:", error);
    if (eventSource.readyState === EventSource.CLOSED) {
      setTimeout(setupSSE, 5000); // Reconnect after 5 seconds
    }
  };

  eventSource.addEventListener("date-change", async (event) => {
    await ui.refreshTodayTasks();
    ui.updateTabTitle();
    let displayedWeekStartDate = calendar.displayedWeekStartDate;
    calendar.renderWeekCalendar(displayedWeekStartDate);
  });
}
