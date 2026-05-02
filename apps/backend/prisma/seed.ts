import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { UNIVERSITIES, BADGES } from "./seed-data.js";

const pool = new Pool({ connectionString: process.env["DATABASE_URL"] });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding universities...");
  await Promise.all(
    UNIVERSITIES.map((uni) =>
      prisma.university.upsert({ where: { domain: uni.domain }, update: {}, create: uni })
    )
  );
  console.log(`Seeded ${UNIVERSITIES.length} universities.`);

  console.log("Seeding badges...");
  await Promise.all(
    BADGES.map((badge) =>
      prisma.badge.upsert({ where: { name: badge.name }, update: {}, create: badge })
    )
  );
  console.log(`Seeded ${BADGES.length} badges.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
