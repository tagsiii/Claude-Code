import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  parseISO,
  differenceInDays,
  addDays,
  addHours,
  isWithinInterval,
  isBefore,
  isAfter,
} from 'date-fns';

export function getWeekRange(date: Date): { start: Date; end: Date } {
  return {
    start: startOfWeek(date, { weekStartsOn: 1 }),
    end: endOfWeek(date, { weekStartsOn: 1 }),
  };
}

export function getDaysInRange(start: string, end: string): Date[] {
  return eachDayOfInterval({
    start: parseISO(start),
    end: parseISO(end),
  });
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'yyyy-MM-dd');
}

export function formatTime(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'HHmm');
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'dd MMM yyyy HHmm');
}

export function daysUntil(dateStr: string): number {
  return differenceInDays(parseISO(dateStr), new Date());
}

export function isDateInRange(date: string, start: string, end: string): boolean {
  return isWithinInterval(parseISO(date), {
    start: parseISO(start),
    end: parseISO(end),
  });
}

export function daysFromNow(days: number): string {
  return formatDate(addDays(new Date(), days));
}

export function hoursFromDate(dateStr: string, hours: number): string {
  return addHours(parseISO(dateStr), hours).toISOString();
}

export { parseISO, differenceInDays, isBefore, isAfter, format, addDays, addHours };
