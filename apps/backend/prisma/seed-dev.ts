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

async function main() {
  await seedReferenceData(prisma);

  const hash = await bcrypt.hash(PASSWORD, 10);

  const tuBerlin = await prisma.university.findUnique({ where: { domain: "tu-berlin.de" } });
  const uniId = tuBerlin!.id;

  // ── Users ────────────────────────────────────────────────────────────────

  const free = await prisma.user.upsert({
    where: { email: "free@tu-berlin.de" },
    update: {},
    create: {
      email: "free@tu-berlin.de",
      passwordHash: hash,
      firstName: "Alex",
      lastName: "Müller",
      studyProgramme: "Computer Science",
      semester: 3,
      languages: ["German", "English"],
      isVerified: true,
      universityId: uniId,
      subscription: { create: { status: "free" } },
    },
  });

  const premium = await prisma.user.upsert({
    where: { email: "premium@tu-berlin.de" },
    update: {},
    create: {
      email: "premium@tu-berlin.de",
      passwordHash: hash,
      firstName: "Jana",
      lastName: "Schmidt",
      studyProgramme: "Mechanical Engineering",
      semester: 5,
      languages: ["German", "English", "French"],
      isVerified: true,
      universityId: uniId,
      subscription: {
        create: {
          status: "premium",
          startDate: new Date("2026-01-01"),
          endDate: new Date("2027-01-01"),
        },
      },
    },
  });

  console.log("✓ Users: free@tu-berlin.de | premium@tu-berlin.de  (password: Test1234!)");

  // ── Badges ───────────────────────────────────────────────────────────────

  const badges = await prisma.badge.findMany();
  const b = Object.fromEntries(badges.map((x) => [x.name, x]));

  const premiumBadgeNames = [
    "First Reply",
    "Getting Started",
    "Active Helper",
    "Community Builder",
    "Helpful Contributor",
    "Trusted Helper",
    "Solution Provider",
  ];
  for (const name of premiumBadgeNames) {
    if (!b[name]) continue;
    await prisma.userBadge.upsert({
      where: { userId_badgeId: { userId: premium.id, badgeId: b[name].id } },
      update: {},
      create: { userId: premium.id, badgeId: b[name].id },
    });
  }

  await prisma.userBadge.upsert({
    where: { userId_badgeId: { userId: free.id, badgeId: b["First Reply"]!.id } },
    update: {},
    create: { userId: free.id, badgeId: b["First Reply"]!.id },
  });

  console.log("✓ Badges awarded");

  // ── Posts ────────────────────────────────────────────────────────────────

  const postData = [
    {
      content: "Does anyone have good resources for learning Linear Algebra? I'm struggling with eigenvalues and eigenvectors.",
      category: "Academic" as const,
      isUrgent: false,
      authorId: free.id,
    },
    {
      content: "URGENT: The exam for Algorithms & Data Structures has been moved to next Monday! Has anyone confirmed this with the professor?",
      category: "Academic" as const,
      isUrgent: true,
      authorId: free.id,
    },
    {
      content: "Looking for a study group for the upcoming Thermodynamics exam. Anyone interested in meeting at the library twice a week?",
      category: "Academic" as const,
      isUrgent: false,
      authorId: premium.id,
    },
    {
      content: "Anyone want to grab coffee at the campus cafeteria this Thursday afternoon? Would be nice to meet some new people!",
      category: "Social" as const,
      isUrgent: false,
      authorId: premium.id,
    },
    {
      content: "International students meetup this Saturday at 3pm in front of the main library. Everyone welcome!",
      category: "Social" as const,
      isUrgent: false,
      authorId: free.id,
    },
    {
      content: "Looking for people to join a casual football game on Sunday morning at the campus sports field. We need at least 10 players!",
      category: "Sport" as const,
      isUrgent: false,
      authorId: premium.id,
    },
    {
      content: "Anyone interested in starting a running group? I usually run 5km around the park near campus on Tuesday and Thursday mornings.",
      category: "Sport" as const,
      isUrgent: false,
      authorId: free.id,
    },
    {
      content: "What's the best supermarket near TU Berlin campus? Just moved here and still figuring out the area.",
      category: "DailyLifeSupport" as const,
      isUrgent: false,
      authorId: free.id,
    },
    {
      content: "Has anyone dealt with the Bürgeramt registration recently? I've been waiting 6 weeks for an appointment — any tips?",
      category: "DailyLifeSupport" as const,
      isUrgent: false,
      authorId: premium.id,
    },
    {
      content: "Recommendations for affordable student apartments near campus? My current WG ends in June and I'm panicking a bit.",
      category: "DailyLifeSupport" as const,
      isUrgent: true,
      authorId: free.id,
    },
  ];

  const posts = [];
  for (const d of postData) {
    posts.push(await prisma.post.create({ data: d }));
  }

  console.log(`✓ ${posts.length} posts created`);

  // ── Replies ───────────────────────────────────────────────────────────────

  const linearAlgebraPost = posts[0]!;
  const burgeramtPost = posts[8]!;
  const supermarketPost = posts[7]!;
  const coffeePost = posts[3]!;
  const apartmentPost = posts[9]!;

  const r1 = await prisma.reply.create({
    data: {
      content: "3Blue1Brown on YouTube has an amazing series called 'Essence of Linear Algebra' — completely changed how I understand eigenvalues. Highly recommend!",
      authorId: premium.id,
      postId: linearAlgebraPost.id,
      isSolution: true,
    },
  });
  const r2 = await prisma.reply.create({
    data: {
      content: "Gilbert Strang's lectures on MIT OpenCourseWare are also fantastic and the textbook is free to download.",
      authorId: premium.id,
      postId: linearAlgebraPost.id,
    },
  });
  const r3 = await prisma.reply.create({
    data: {
      content: "Khan Academy's linear algebra section is great for building intuition from scratch before diving into the heavy stuff.",
      authorId: free.id,
      postId: linearAlgebraPost.id,
    },
  });

  const r4 = await prisma.reply.create({
    data: {
      content: "Try the online Anmeldung form — some districts accept it without an in-person appointment. Worked for me in Mitte!",
      authorId: free.id,
      postId: burgeramtPost.id,
      isSolution: true,
    },
  });
  const r5 = await prisma.reply.create({
    data: {
      content: "Use the Bürgeramt Berlin app to get notified when cancellations open up. I got an appointment within a day that way.",
      authorId: premium.id,
      postId: burgeramtPost.id,
    },
  });

  const r6 = await prisma.reply.create({
    data: {
      content: "There's a Lidl 5 minutes walk from the main building on Marchstraße. Also a Rewe a bit further but with more variety.",
      authorId: premium.id,
      postId: supermarketPost.id,
    },
  });
  const r7 = await prisma.reply.create({
    data: {
      content: "ALDI on Ernst-Reuter-Platz is the cheapest. For organic, check the farmers market on Saturdays near Tiergarten.",
      authorId: premium.id,
      postId: supermarketPost.id,
      isSolution: true,
    },
  });

  const r8 = await prisma.reply.create({
    data: {
      content: "I'm in! Should we meet at the Mensa or the smaller café near Building A?",
      authorId: free.id,
      postId: coffeePost.id,
    },
  });

  const r9 = await prisma.reply.create({
    data: {
      content: "Check WG-Gesucht — lots of options near campus. Also the student union (AStA) has a housing board with cheaper listings.",
      authorId: premium.id,
      postId: apartmentPost.id,
      isSolution: true,
    },
  });
  const r10 = await prisma.reply.create({
    data: {
      content: "Facebook group 'Wohnungen Berlin Studenten' has tons of listings — I found my current place there in 3 days.",
      authorId: free.id,
      postId: apartmentPost.id,
    },
  });

  console.log("✓ Replies created");

  // ── Upvotes ───────────────────────────────────────────────────────────────

  const upvoteMatrix: Array<{ voterId: string; replyId: string }> = [
    { voterId: free.id, replyId: r1.id },
    { voterId: free.id, replyId: r2.id },
    { voterId: free.id, replyId: r5.id },
    { voterId: free.id, replyId: r6.id },
    { voterId: free.id, replyId: r7.id },
    { voterId: free.id, replyId: r9.id },
    { voterId: premium.id, replyId: r3.id },
    { voterId: premium.id, replyId: r4.id },
    { voterId: premium.id, replyId: r8.id },
    { voterId: premium.id, replyId: r10.id },
  ];

  for (const { voterId, replyId } of upvoteMatrix) {
    await prisma.upvote.upsert({
      where: { userId_replyId: { userId: voterId, replyId } },
      update: {},
      create: { userId: voterId, replyId },
    });
  }

  console.log("✓ Upvotes created");

  // ── Notification preferences ──────────────────────────────────────────────

  for (const category of ["Academic", "DailyLifeSupport"] as const) {
    await prisma.notificationPreference.upsert({
      where: { userId_category: { userId: premium.id, category } },
      update: {},
      create: { userId: premium.id, category },
    });
  }
  await prisma.notificationPreference.upsert({
    where: { userId_category: { userId: free.id, category: "Social" } },
    update: {},
    create: { userId: free.id, category: "Social" },
  });

  // ── Notifications ─────────────────────────────────────────────────────────

  await prisma.notification.createMany({
    data: [
      { userId: free.id, type: "REPLY_TO_POST", postId: linearAlgebraPost.id, replyId: r1.id },
      { userId: free.id, type: "REPLY_TO_POST", postId: linearAlgebraPost.id, replyId: r2.id },
      { userId: free.id, type: "BADGE_AWARDED" },
      { userId: premium.id, type: "REPLY_TO_POST", postId: burgeramtPost.id, replyId: r4.id },
      { userId: premium.id, type: "REPLY_UPVOTED", replyId: r1.id },
      { userId: premium.id, type: "REPLY_UPVOTED", replyId: r2.id },
      { userId: premium.id, type: "REPLY_MARKED_SOLUTION", replyId: r7.id },
      { userId: premium.id, type: "BADGE_AWARDED" },
    ],
  });

  console.log("✓ Notifications created");
  console.log("\nDone! Test accounts:");
  console.log("  free@tu-berlin.de    — free tier, 1 badge");
  console.log("  premium@tu-berlin.de — premium tier, all 7 badges");
  console.log("  Password for both:   Test1234!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
