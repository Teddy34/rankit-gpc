export const REQUIRED_ALLOWED_DOMAINS = ["geopostcodes.com"] as const;

export function normalizeDomain(value: string): string {
  return value.trim().toLocaleLowerCase("en-US");
}

export function isValidDomain(domain: string): boolean {
  return domain.length <= 253 && /^(?!-)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain);
}
