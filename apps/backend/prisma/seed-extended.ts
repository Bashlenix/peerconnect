import "dotenv/config";
import bcrypt from "bcrypt";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { seedReferenceData } from "./seed-data.js";

const pool = new Pool({ connectionString: process.env["DATABASE_URL"] });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const PASSWORD = "Test1234!";

// One user per university domain, alternating free/premium
const USER_DEFS = [
  { email: "alice@uni-dortmund.de",  firstName: "Alice",  lastName: "Weber",   domain: "uni-dortmund.de",  plan: "free",    programme: "Mathematics",            semester: 2 },
  { email: "bob@tu-berlin.de",       firstName: "Bob",    lastName: "Fischer", domain: "tu-berlin.de",    plan: "free",    programme: "Computer Science",       semester: 4 },
  { email: "carol@lmu.de",           firstName: "Carol",  lastName: "Bauer",   domain: "lmu.de",          plan: "premium", programme: "Biology",                semester: 6 },
  { email: "dan@uni-heidelberg.de",  firstName: "Dan",    lastName: "Richter", domain: "uni-heidelberg.de",plan: "free",    programme: "History",                semester: 3 },
  { email: "eva@rwth-aachen.de",     firstName: "Eva",    lastName: "Klein",   domain: "rwth-aachen.de",  plan: "premium", programme: "Mechanical Engineering", semester: 5 },
  { email: "frank@uni-hamburg.de",   firstName: "Frank",  lastName: "Wolf",    domain: "uni-hamburg.de",  plan: "free",    programme: "Economics",              semester: 1 },
  { email: "greta@hu-berlin.de",     firstName: "Greta",  lastName: "Braun",   domain: "hu-berlin.de",    plan: "premium", programme: "Law",                    semester: 7 },
  { email: "hans@uni-koeln.de",      firstName: "Hans",   lastName: "Koch",    domain: "uni-koeln.de",    plan: "free",    programme: "Psychology",             semester: 3 },
  { email: "ida@uni-frankfurt.de",   firstName: "Ida",    lastName: "Meyer",   domain: "uni-frankfurt.de",plan: "premium", programme: "Physics",                semester: 4 },
  { email: "jan@uni-stuttgart.de",   firstName: "Jan",    lastName: "Schäfer", domain: "uni-stuttgart.de",plan: "free",    programme: "Civil Engineering",      semester: 2 },
  { email: "kai@stud.th-deg.de",     firstName: "Kai",    lastName: "Hoffmann",domain: "stud.th-deg.de",  plan: "free",    programme: "Business Informatics",   semester: 1 },
] as const;

async function main() {
  await seedReferenceData(prisma);

  const hash = await bcrypt.hash(PASSWORD, 10);

  // ── Upsert users ────────────────────────────────────────────────────────────

  const uniMap = Object.fromEntries(
    (await prisma.university.findMany()).map((u) => [u.domain, u.id])
  );

  const users: Record<string, { id: string; email: string; plan: string }> = {};

  for (const def of USER_DEFS) {
    const uniId = uniMap[def.domain];
    if (!uniId) throw new Error(`University not found for domain: ${def.domain}`);

    const user = await prisma.user.upsert({
      where: { email: def.email },
      update: {},
      create: {
        email: def.email,
        passwordHash: hash,
        firstName: def.firstName,
        lastName: def.lastName,
        studyProgramme: def.programme,
        semester: def.semester,
        languages: ["German", "English"],
        isVerified: true,
        universityId: uniId,
        subscription: {
          create: {
            status: def.plan,
            startDate: def.plan === "premium" ? new Date("2026-01-01") : new Date(),
            endDate:   def.plan === "premium" ? new Date("2027-01-01") : null,
          },
        },
      },
    });

    // Ensure subscription exists for users created in a previous run
    await prisma.subscription.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        status: def.plan,
        startDate: def.plan === "premium" ? new Date("2026-01-01") : new Date(),
        endDate:   def.plan === "premium" ? new Date("2027-01-01") : null,
      },
    });

    users[def.email] = { id: user.id, email: def.email, plan: def.plan };
  }

  console.log(`✓ ${USER_DEFS.length} users upserted`);

  // ── Posts — delete seed posts then recreate (idempotent) ───────────────────

  const seedUserIds = Object.values(users).map((u) => u.id);

  await prisma.post.deleteMany({ where: { authorId: { in: seedUserIds } } });

  const posts = await prisma.post.createManyAndReturn({
    data: [
      // Academic (6)
      { content: "Can anyone recommend a good textbook for Real Analysis? Our lecturer goes way too fast and I need something self-contained.", category: "Academic", isUrgent: false, authorId: users["alice@uni-dortmund.de"]!.id },
      { content: "Study group for the OS exam next week? I'm looking for 3–4 people max, planning to meet in the library every evening.", category: "Academic", isUrgent: false, authorId: users["bob@tu-berlin.de"]!.id },
      { content: "URGENT: Prof. Müller moved the Biochemistry midterm to this Friday — check your emails! The new room is H5.", category: "Academic", isUrgent: true, authorId: users["carol@lmu.de"]!.id },
      { content: "Anyone else confused by the grading rubric for the History essay? The wording around 'secondary sources' is super vague.", category: "Academic", isUrgent: false, authorId: users["dan@uni-heidelberg.de"]!.id },
      { content: "Looking for someone who took Thermodynamics II last year and can share their notes. Happy to exchange my Fluid Mechanics notes.", category: "Academic", isUrgent: false, authorId: users["eva@rwth-aachen.de"]!.id },
      { content: "Is the intro Python course worth it for non-CS students? I'm an Econ major and thinking of taking it as an elective.", category: "Academic", isUrgent: false, authorId: users["frank@uni-hamburg.de"]!.id },
      // Social (4)
      { content: "Board game night at the student lounge this Friday at 7pm. Settlers of Catan, Ticket to Ride, and more. Bring snacks!", category: "Social", isUrgent: false, authorId: users["greta@hu-berlin.de"]!.id },
      { content: "Anyone up for a language exchange? I'm a native German speaker learning Spanish. Happy to meet weekly over coffee.", category: "Social", isUrgent: false, authorId: users["hans@uni-koeln.de"]!.id },
      { content: "Organising a small farewell dinner for international students leaving after summer. DM me if you want to join!", category: "Social", isUrgent: false, authorId: users["ida@uni-frankfurt.de"]!.id },
      { content: "Movie screening in the courtyard tonight at 9pm — 'Parasite' with German subtitles. Free entry, just bring a blanket.", category: "Social", isUrgent: false, authorId: users["jan@uni-stuttgart.de"]!.id },
      // Sport (3)
      { content: "Basketball 3v3 every Tuesday at 6pm at the outdoor court near the gym. All skill levels welcome — just show up!", category: "Sport", isUrgent: false, authorId: users["kai@stud.th-deg.de"]!.id },
      { content: "Looking for a tennis partner, intermediate level. I have a court booked at the uni sports centre on Wednesday afternoons.", category: "Sport", isUrgent: false, authorId: users["alice@uni-dortmund.de"]!.id },
      { content: "Yoga sessions every Sunday 8am at the green area behind building C. Beginner-friendly, free of charge.", category: "Sport", isUrgent: false, authorId: users["carol@lmu.de"]!.id },
      // DailyLifeSupport (5)
      { content: "Best place to print and bind a thesis near campus? The uni library queue is weeks out.", category: "DailyLifeSupport", isUrgent: false, authorId: users["eva@rwth-aachen.de"]!.id },
      { content: "URGENT: Lost my student ID card. How long does it take to get a replacement and is there a fee?", category: "DailyLifeSupport", isUrgent: true, authorId: users["frank@uni-hamburg.de"]!.id },
      { content: "Any tips for finding a part-time job near campus? Preferably something flexible around lectures.", category: "DailyLifeSupport", isUrgent: false, authorId: users["hans@uni-koeln.de"]!.id },
      { content: "What health insurance do most students use here? AOK, TK, or Barmer? Starting next semester and need to enrol.", category: "DailyLifeSupport", isUrgent: false, authorId: users["jan@uni-stuttgart.de"]!.id },
      { content: "Anyone know a good, cheap bike repair shop near campus? My chain broke and I need it fixed before the weekend.", category: "DailyLifeSupport", isUrgent: false, authorId: users["kai@stud.th-deg.de"]!.id },
    ],
  });

  console.log(`✓ ${posts.length} posts created`);

  // ── Replies ─────────────────────────────────────────────────────────────────

  const [realAnalysisPost, osMidtermPost, , , , pythonPost, boardGamePost, , , , , , , printPost, lostIdPost] = posts;

  const replies = await Promise.all([
    prisma.reply.create({ data: { content: "Rudin's 'Principles of Mathematical Analysis' is the classic. Pair it with Abbott's 'Understanding Analysis' which is much gentler.", authorId: users["eva@rwth-aachen.de"]!.id, postId: realAnalysisPost!.id, isSolution: true } }),
    prisma.reply.create({ data: { content: "Terence Tao has free lecture notes on his website — really well-written and rigorous.", authorId: users["ida@uni-frankfurt.de"]!.id, postId: realAnalysisPost!.id } }),
    prisma.reply.create({ data: { content: "I'm in for the OS study group! Which days work for you? I'm free Mon, Wed, Thu evenings.", authorId: users["frank@uni-hamburg.de"]!.id, postId: osMidtermPost!.id } }),
    prisma.reply.create({ data: { content: "Count me in too. Can we use Notion or a shared Google Doc to coordinate topics?", authorId: users["dan@uni-heidelberg.de"]!.id, postId: osMidtermPost!.id, isSolution: true } }),
    prisma.reply.create({ data: { content: "Totally worth it even as an Econ student — automate your data cleaning and econometrics in Python later. One of the best decisions I made.", authorId: users["greta@hu-berlin.de"]!.id, postId: pythonPost!.id, isSolution: true } }),
    prisma.reply.create({ data: { content: "The intro course at our uni uses Jupyter notebooks which makes it very practical. Highly recommend.", authorId: users["carol@lmu.de"]!.id, postId: pythonPost!.id } }),
    prisma.reply.create({ data: { content: "Sounds great! Is it okay to come solo or should I bring friends?", authorId: users["kai@stud.th-deg.de"]!.id, postId: boardGamePost!.id } }),
    prisma.reply.create({ data: { content: "There's a Copy Shop on the main street about 10 min from campus. They do same-day binding and are much cheaper than the library.", authorId: users["bob@tu-berlin.de"]!.id, postId: printPost!.id, isSolution: true } }),
    prisma.reply.create({ data: { content: "Replacement costs €10 and takes about 3–5 working days. Go to the student services office in building A, ground floor.", authorId: users["carol@lmu.de"]!.id, postId: lostIdPost!.id, isSolution: true } }),
    prisma.reply.create({ data: { content: "You can also use your student app as a temporary ID while waiting for the physical one.", authorId: users["alice@uni-dortmund.de"]!.id, postId: lostIdPost!.id } }),
  ]);

  console.log(`✓ ${replies.length} replies created`);

  // ── Upvotes ──────────────────────────────────────────────────────────────────

  const upvotes: Array<{ voterId: string; replyId: string }> = [
    { voterId: users["alice@uni-dortmund.de"]!.id, replyId: replies[0]!.id },
    { voterId: users["bob@tu-berlin.de"]!.id,      replyId: replies[0]!.id },
    { voterId: users["dan@uni-heidelberg.de"]!.id, replyId: replies[1]!.id },
    { voterId: users["carol@lmu.de"]!.id,          replyId: replies[2]!.id },
    { voterId: users["alice@uni-dortmund.de"]!.id, replyId: replies[3]!.id },
    { voterId: users["hans@uni-koeln.de"]!.id,     replyId: replies[4]!.id },
    { voterId: users["frank@uni-hamburg.de"]!.id,  replyId: replies[4]!.id },
    { voterId: users["jan@uni-stuttgart.de"]!.id,  replyId: replies[5]!.id },
    { voterId: users["ida@uni-frankfurt.de"]!.id,  replyId: replies[7]!.id },
    { voterId: users["kai@stud.th-deg.de"]!.id,    replyId: replies[8]!.id },
    { voterId: users["eva@rwth-aachen.de"]!.id,    replyId: replies[9]!.id },
  ];

  for (const v of upvotes) {
    await prisma.upvote.upsert({
      where: { userId_replyId: { userId: v.voterId, replyId: v.replyId } },
      update: {},
      create: { userId: v.voterId, replyId: v.replyId },
    });
  }

  console.log(`✓ ${upvotes.length} upvotes created`);

  // ── Summary ──────────────────────────────────────────────────────────────────

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  Test accounts (password for all: Test1234!)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  FREE users:");
  console.log("    alice@uni-dortmund.de   — TU Dortmund,    Mathematics, sem 2");
  console.log("    bob@tu-berlin.de        — TU Berlin,       CS, sem 4");
  console.log("    dan@uni-heidelberg.de   — Heidelberg,      History, sem 3");
  console.log("    frank@uni-hamburg.de    — Hamburg,         Economics, sem 1");
  console.log("    hans@uni-koeln.de       — Cologne,         Psychology, sem 3");
  console.log("    jan@uni-stuttgart.de    — Stuttgart,       Civil Eng, sem 2");
  console.log("    kai@stud.th-deg.de      — THD,             Business IT, sem 1");
  console.log("  PREMIUM users:");
  console.log("    carol@lmu.de            — LMU Munich,      Biology, sem 6");
  console.log("    eva@rwth-aachen.de      — RWTH Aachen,     Mech Eng, sem 5");
  console.log("    greta@hu-berlin.de      — Humboldt Berlin, Law, sem 7");
  console.log("    ida@uni-frankfurt.de    — Frankfurt,       Physics, sem 4");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
