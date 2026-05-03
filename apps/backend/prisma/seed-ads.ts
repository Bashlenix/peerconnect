import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

const pool = new Pool({ connectionString: process.env["DATABASE_URL"] });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const ads = [
  {
    id: "ad-studentenrabatt",
    title: "10% Studentenrabatt auf alle Lehrbücher",
    body: "Spare bei jedem Lehrbuch mit deiner Uni-E-Mail. Über 50.000 Titel verfügbar – von Mathematik bis Medizin.",
    imageUrl: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=600",
    linkUrl: "https://example.com/studentenrabatt",
    advertiserName: "BuchDepot GmbH",
    isActive: true,
    startsAt: null,
    endsAt: null,
  },
  {
    id: "ad-wg-zimmer",
    title: "WG-Zimmer in Berlin ab 450 €/Monat",
    body: "Schnell verfügbare Zimmer in studentischen WGs – möbliert, inkl. Internet. Jetzt kostenlos inserieren oder suchen.",
    imageUrl: null,
    linkUrl: "https://example.com/wg-zimmer",
    advertiserName: "CampusWohnen.de",
    isActive: true,
    startsAt: null,
    endsAt: null,
  },
  {
    id: "ad-sommerfest",
    title: "Sommerfest 2026 – Tickets jetzt sichern!",
    body: "Das größte Studentenfest des Jahres. Live-Musik, Food-Trucks und jede Menge Networking. Nur noch wenige Tickets übrig.",
    imageUrl: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=600",
    linkUrl: "https://example.com/sommerfest",
    advertiserName: "Campus Events Berlin",
    isActive: true,
    startsAt: new Date("2026-05-01"),
    endsAt: new Date("2026-08-31"),
  },
  {
    id: "ad-nachhilfe",
    title: "Nachhilfe & Tutoring – Studenten helfen Studenten",
    body: "Finde erfahrene Tutoren für Mathe, Physik, Programmierung und mehr. Erste Stunde kostenlos probieren.",
    imageUrl: null,
    linkUrl: "https://example.com/nachhilfe",
    advertiserName: "StudyBuddy GmbH",
    isActive: true,
    startsAt: null,
    endsAt: new Date("2027-12-31"),
  },
];

async function main() {
  for (const ad of ads) {
    await prisma.ad.upsert({
      where: { id: ad.id },
      update: {},
      create: ad,
    });
  }

  console.log(`✓ ${ads.length} ads seeded`);
  console.log("  - BuchDepot: always-active, with image");
  console.log("  - CampusWohnen: always-active, no image");
  console.log("  - Campus Events: active until 2026-08-31, with image");
  console.log("  - StudyBuddy: active until 2027-12-31, no image");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
