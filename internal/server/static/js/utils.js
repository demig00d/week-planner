// Get the start of the week (Monday) for a given date
export function getStartOfWeek(date) {
  const newDate = new Date(date); //Clone
  const day = newDate.getDay();
  const diff = newDate.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  newDate.setHours(0, 0, 0, 0);
  newDate.setDate(diff);
  return newDate;
}

// Add days to a date
export function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function isDateCurrentWeek(date) {
  const now = new Date();
  const firstDayCurrentWeek = new Date(
    now.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1)),
  );
  const firstDayCurrentWeek_start = getStartOfWeek(firstDayCurrentWeek);
  const date_start = getStartOfWeek(new Date(date));

  return (
    firstDayCurrentWeek_start.getFullYear() === date_start.getFullYear() &&
    firstDayCurrentWeek_start.getMonth() === date_start.getMonth() &&
    firstDayCurrentWeek_start.getDate() === date_start.getDate()
  );
}

export function getWeekDates(date) {
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
