/** Date and time utilities.
 * @module utils/dateTime
 */

const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

/**
 * Determine whether a year is a leap year in the Gregorian calendar.
 *
 * @param year - The year.
 * @returns Whether the year is a leap year.
 */
export function isGregorianLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
}

/**
 * Determine whether a YYYY-MM-DD string names a date that exists in the Gregorian calendar.
 *
 * @remarks
 *
 * Only the calendar is checked: the string must already have the YYYY-MM-DD shape. Century years
 * are leap years only when divisible by 400, so 2000-02-29 exists and 1900-02-29 does not.
 *
 * @param dateString - A date in YYYY-MM-DD form.
 * @returns Whether the date exists.
 */
export function isExistingGregorianDate(dateString: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString)
  if (match === null) {
    return false
  }
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12 || day < 1) {
    return false
  }
  const monthLength = month === 2 && isGregorianLeapYear(year) ? 29 : daysInMonth[month - 1]
  return day <= monthLength
}
