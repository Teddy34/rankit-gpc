export function dateInBrussels(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Brussels", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(date);
}

export function todayInBrussels(): string {
  return dateInBrussels(new Date());
}
