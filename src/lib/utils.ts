import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { differenceInDays, parseISO } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Checks if a given plan's start date is within the grace period for refunds.
 * @param startDateIso The ISO string of the plan's start date.
 * @param gracePeriodInDays The number of days for the grace period (e.g., 7).
 * @returns True if the plan is within the grace period, false otherwise.
 */
export function isWithinGracePeriod(startDateIso: string | undefined, gracePeriodInDays: number): boolean {
  if (!startDateIso) {
    return false;
  }
  try {
    const startDate = parseISO(startDateIso);
    const today = new Date();
    // We use differenceInDays which returns the number of full days.
    // If the difference is less than the grace period, it's valid.
    // e.g., Day 0-6 are valid for a 7-day period.
    return differenceInDays(today, startDate) < gracePeriodInDays;
  } catch (error) {
    console.error("Error parsing date for grace period check:", error);
    return false;
  }
}
