/**
 * Gets the start of the week (Monday) for a given date.
 * @param {Date} date - The input date.
 * @returns {Date} - The Date object set to the start of the Monday of that week (00:00:00).
 */
export function getStartOfWeek(date) {
  const newDate = new Date(date); // Clone to avoid modifying the original date
  const day = newDate.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  // Calculate the difference to get to the previous Monday.
  // If day is Sunday (0), we need to go back 6 days.
  // If day is Monday (1), diff is 0.
  // If day is Tuesday (2), diff is -1, etc.
  const diff = newDate.getDate() - day + (day === 0 ? -6 : 1);
  newDate.setHours(0, 0, 0, 0); // Reset time to the beginning of the day
  newDate.setDate(diff);
  return newDate;
}

/**
 * Adds a specified number of days to a date.
 * @param {Date} date - The input date.
 * @param {number} days - The number of days to add (can be negative).
 * @returns {Date} - A new Date object with the days added.
 */
export function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Checks if a given date falls within the current week (Monday to Sunday).
 * @param {Date} date - The date to check.
 * @returns {boolean} - True if the date is in the current week, false otherwise.
 */
export function isDateCurrentWeek(date) {
  const now = new Date();
  const firstDayOfQueryWeek = getStartOfWeek(new Date(date)); // Use consistent start of week
  const firstDayOfCurrentWeek = getStartOfWeek(now);

  // Compare year, month, and date of the start of the weeks
  return (
    firstDayOfQueryWeek.getFullYear() === firstDayOfCurrentWeek.getFullYear() &&
    firstDayOfQueryWeek.getMonth() === firstDayOfCurrentWeek.getMonth() &&
    firstDayOfQueryWeek.getDate() === firstDayOfCurrentWeek.getDate()
  );
}

/**
 * Gets an array of Date objects representing the 7 days of the week (Mon-Sun) containing the given date.
 * @param {Date} date - A date within the desired week.
 * @returns {Date[]} - An array of 7 Date objects, starting from Monday.
 */
export function getWeekDates(date) {
  const monday = getStartOfWeek(new Date(date)); // Get the Monday of the week
  const dates = [];
  for (let i = 0; i < 7; i++) {
    dates.push(addDays(monday, i)); // Add 0 to 6 days to get Mon-Sun
  }
  return dates;
}

/**
 * Parses a "YYYY-MM-DD" string into a Date object set to UTC midnight.
 * IMPORTANT: This avoids timezone issues by explicitly using UTC.
 * @param {string} dateString - The date string in "YYYY-MM-DD" format.
 * @returns {Date} - The Date object representing midnight UTC on that day, or Invalid Date if format is wrong.
 */
export function parseDateUTC(dateString) {
  if (
    !dateString ||
    typeof dateString !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(dateString)
  ) {
    // Return an invalid date or throw an error if the format is wrong
    console.warn(
      "Invalid date string format passed to parseDateUTC:",
      dateString,
    );
    return new Date(NaN); // Return Invalid Date
  }
  const parts = dateString.split("-");
  // Month is 0-indexed in Date constructor, so subtract 1
  return new Date(
    Date.UTC(
      parseInt(parts[0], 10),
      parseInt(parts[1], 10) - 1,
      parseInt(parts[2], 10),
    ),
  );
}

/**
 * Formatting options for displaying dates in the UI (e.g., date picker input).
 * Uses UTC to ensure consistency regardless of user's local timezone.
 */
export const datePickerFormatOptions = {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "UTC", // Crucial for consistency
};

/**
 * Calculates the next occurrence date based on a start date, period, and interval.
 * All calculations are done in UTC.
 * @param {Date} startDateUTC - The starting date (must be a valid Date object, preferably UTC midnight).
 * @param {string} period - 'daily', 'weekly', 'monthly', 'yearly'.
 * @param {number} interval - The repetition interval (e.g., every 2 weeks, must be >= 1).
 * @returns {Date|null} - The next occurrence date in UTC, or null if input is invalid.
 */
export function calculateNextRecurrence(startDateUTC, period, interval) {
  if (
    !startDateUTC ||
    isNaN(startDateUTC.getTime()) ||
    !interval ||
    interval < 1
  ) {
    console.warn("Invalid input to calculateNextRecurrence:", {
      startDateUTC,
      period,
      interval,
    });
    return null; // Invalid start date or interval
  }

  let nextDate = new Date(startDateUTC); // Clone to avoid modifying original

  switch (period) {
    case "": // Handle empty string as no recurrence
      console.warn(
        "Empty period passed to calculateNextRecurrence, returning null.",
      );
      return null;
    case null:
    case undefined:
      return null;
    case "daily":
      nextDate.setUTCDate(nextDate.getUTCDate() + interval);
      break;
    case "weekly":
      nextDate.setUTCDate(nextDate.getUTCDate() + 7 * interval);
      break;
    case "monthly":
      const originalDay = nextDate.getUTCDate();
      // Set month first
      nextDate.setUTCMonth(nextDate.getUTCMonth() + interval);
      // Check if the day rolled over (e.g., Jan 31 + 1 month -> March 3 instead of Feb 28/29)
      // If the day is now less than the original day, it means we went past the end of the target month.
      // Set the date to 0 to get the last day of the *previous* month (which is our target month).
      if (nextDate.getUTCDate() < originalDay) {
        nextDate.setUTCDate(0);
      }
      break;
    case "yearly":
      const originalMonth = nextDate.getUTCMonth();
      const originalYearDay = nextDate.getUTCDate();
      nextDate.setUTCFullYear(nextDate.getUTCFullYear() + interval);
      // Handle leap year case for Feb 29 explicitly
      // If the original was Feb 29, but the new date's month isn't February, set it back to Feb 28.
      if (
        originalMonth === 1 &&
        originalYearDay === 29 &&
        nextDate.getUTCMonth() !== 1
      ) {
        // It was Feb 29th, but the resulting year is not a leap year or calculation landed in March
        nextDate.setUTCMonth(1); // Ensure month is February
        nextDate.setUTCDate(28); // Set day to 28th
      }
      break;
    default:
      console.warn("Invalid recurrence period:", period);
      return null; // Invalid period
  }

  // Ensure the time part remains at midnight UTC (important due to potential DST shifts if local time were used)
  nextDate.setUTCHours(0, 0, 0, 0);
  return nextDate;
}
