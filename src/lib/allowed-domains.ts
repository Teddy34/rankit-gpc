import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { allowedDomains } from "@/db/schema";
import { normalizeDomain, REQUIRED_ALLOWED_DOMAINS } from "@/domain/email-domain";

export function configuredAllowedDomains(): Set<string> {
  return new Set([
    ...REQUIRED_ALLOWED_DOMAINS,
    ...(process.env.INITIAL_ALLOWED_DOMAINS ?? "").split(",").map(normalizeDomain).filter(Boolean),
  ]);
}

export function isRequiredDomain(domain: string): boolean {
  return REQUIRED_ALLOWED_DOMAINS.includes(normalizeDomain(domain) as typeof REQUIRED_ALLOWED_DOMAINS[number]);
}

export function isDomainAllowed(domain: string): boolean {
  const normalized = normalizeDomain(domain);
  return configuredAllowedDomains().has(normalized) || Boolean(
    db.select({ id: allowedDomains.id }).from(allowedDomains).where(eq(allowedDomains.domain, normalized)).get(),
  );
}
