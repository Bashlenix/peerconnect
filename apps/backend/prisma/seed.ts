import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

const pool = new Pool({ connectionString: process.env["DATABASE_URL"] });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const UNIVERSITIES = [
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

const BADGES = [
  { name: "First Reply", description: "Posted your first reply" },
  { name: "Getting Started", description: "Posted 3 replies" },
  { name: "Active Helper", description: "Posted 10 or more replies" },
  {
    name: "Community Builder",
    description: "Posted 10 or more replies in Social or Sport categories",
  },
  {
    name: "Helpful Contributor",
    description: "Received 5 upvotes on your replies",
  },
  {
    name: "Trusted Helper",
    description: "Received 15 upvotes on your replies",
  },
  {
    name: "Solution Provider",
    description: "Had 5 replies marked as the accepted solution",
  },
];

async function main() {
  console.log("Seeding universities...");
  for (const uni of UNIVERSITIES) {
    await prisma.university.upsert({
      where: { domain: uni.domain },
      update: {},
      create: uni,
    });
  }
  console.log(`Seeded ${UNIVERSITIES.length} universities.`);

  console.log("Seeding badges...");
  for (const badge of BADGES) {
    await prisma.badge.upsert({
      where: { name: badge.name },
      update: {},
      create: badge,
    });
  }
  console.log(`Seeded ${BADGES.length} badges.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
