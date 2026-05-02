import { prisma } from "../db.js";

export interface UniversityInfo {
  id: string;
  name: string;
  domain: string;
}

export type DomainValidationResult =
  | { valid: true; university: UniversityInfo }
  | { valid: false };

export async function validateEmailDomain(
  email: string
): Promise<DomainValidationResult> {
  const atIndex = email.indexOf("@");
  // Malformed: no @, @ at start, or multiple @
  if (atIndex <= 0 || email.indexOf("@", atIndex + 1) !== -1) {
    return { valid: false };
  }

  const domain = email.slice(atIndex + 1).toLowerCase();

  // Domain must contain at least one dot and no invalid chars
  if (!domain.includes(".") || domain.startsWith(".") || domain.endsWith(".")) {
    return { valid: false };
  }

  const university = await prisma.university.findFirst({
    where: { domain, isActive: true },
    select: { id: true, name: true, domain: true },
  });

  return university ? { valid: true, university } : { valid: false };
}
