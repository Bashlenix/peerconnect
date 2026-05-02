import { PrismaClient } from "../src/generated/prisma/client.js";

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
];

export const BADGES = [
  { name: "First Reply", description: "Posted your first reply" },
  { name: "Getting Started", description: "Posted 3 replies" },
  { name: "Active Helper", description: "Posted 10 or more replies" },
  { name: "Community Builder", description: "Posted 10 or more replies in Social or Sport categories" },
  { name: "Helpful Contributor", description: "Received 5 upvotes on your replies" },
  { name: "Trusted Helper", description: "Received 15 upvotes on your replies" },
  { name: "Solution Provider", description: "Had 5 replies marked as the accepted solution" },
];

export async function seedReferenceData(prisma: PrismaClient): Promise<void> {
  await Promise.all([
    prisma.university.createMany({ data: UNIVERSITIES, skipDuplicates: true }),
    prisma.badge.createMany({ data: BADGES, skipDuplicates: true }),
  ]);
}
