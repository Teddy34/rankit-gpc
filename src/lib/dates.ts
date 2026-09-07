export function dateInBrussels(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Brussels", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(date);
}

export function todayInBrussels(): string {
  return dateInBrussels(new Date());
}

export function timeInBrussels(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Brussels", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(date);
}

export function nowInBrussels(): string {
  return timeInBrussels(new Date());
}
