import { PrismaClient } from "../src/generated/prisma/client.js";
import { BADGE_RULES } from "@peerconnect/shared";

export const UNIVERSITIES = [
  { name: "TU Dortmund University", domain: "uni-dortmund.de" },
  { name: "TU Berlin", domain: "tu-berlin.de" },
  { name: "LMU Munich", domain: "lmu.de" },
  { name: "Heidelberg University", domain: "uni-heidelberg.de" },
  { name: "RWTH Aachen University", domain: "rwth-aachen.de" },
  { name: "University of Hamburg", domain: "uni-hamburg.de" },
  { name: "Humboldt University Berlin", domain: "hu-berlin.de" },
  { name: "University of Cologne", domain: "uni-koeln.de" },
  { name: "University of Frankfurt", domain: "uni-frankfurt.de" },
  { name: "University of Stuttgart", domain: "uni-stuttgart.de" },
  { name: "Technische Hochschule Deggendorf", domain: "stud.th-deg.de" },
];

export const BADGES = BADGE_RULES.map(({ name, description }) => ({ name, description }));

export async function seedReferenceData(prisma: PrismaClient): Promise<void> {
  await Promise.all([
    prisma.university.createMany({ data: UNIVERSITIES, skipDuplicates: true }),
    prisma.badge.createMany({ data: BADGES, skipDuplicates: true }),
  ]);
}
