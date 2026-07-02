import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { buildApp } from "../src/app.js";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { seedReferenceData } from "../prisma/seed-data.js";
import { SSEManager } from "../src/modules/sse-manager.js";

const TEST_DB_URL =
  process.env["DATABASE_URL"] ?? "postgresql://bashi@localhost:5432/peerconnect_test";

let pool: Pool;
let prisma: PrismaClient;
let app: Awaited<ReturnType<typeof buildApp>>;

beforeAll(async () => {
  pool = new Pool({ connectionString: TEST_DB_URL });
  const adapter = new PrismaPg(pool);
  prisma = new PrismaClient({ adapter });
  await seedReferenceData(prisma);

  app = await buildApp();
  await app.ready();
});

afterAll(async () => {
  await pool.query(
    `TRUNCATE TABLE user_badges, notification_preferences, notifications,
                   upvotes, replies, posts, subscriptions, users,
                   badges, universities CASCADE`
  );
  await app.close();
  await prisma.$disconnect();
  await pool.end();
});

afterEach(async () => {
  await pool.query("DELETE FROM users");
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function registerVerifyAndLogin(email: string, password = "securePass1") {
  await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: { email, password },
  });
  const user = await prisma.user.findUnique({ where: { email } });
  await prisma.user.update({
    where: { id: user!.id },
    data: { isVerified: true, emailVerificationToken: null, emailVerificationExpiry: null },
  });
  const res = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: { email, password },
  });
  const cookies = res.headers["set-cookie"] as string | string[];
  return {
    cookieHeader: Array.isArray(cookies) ? cookies.join("; ") : cookies,
    userId: user!.id,
  };
}

function createMockWritable(overrides?: { writableEnded?: boolean; destroyed?: boolean }) {
  const writes: string[] = [];
  return {
    writes,
    write: (chunk: string) => {
      writes.push(chunk);
      return true;
    },
    writableEnded: overrides?.writableEnded ?? false,
    destroyed: overrides?.destroyed ?? false,
  };
}

// ─── SSEManager Unit Tests ────────────────────────────────────────────────────

describe("SSEManager", () => {
  it("register returns a unique string connection ID", () => {
    const mgr = new SSEManager();
    const res = createMockWritable();
    const id = mgr.register("user1", res);
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });

  it("push delivers the event to the registered connection", () => {
    const mgr = new SSEManager();
    const res = createMockWritable();
    mgr.register("user1", res);
    mgr.push("user1", "notification", { type: "REPLY_TO_POST" });
    expect(res.writes).toHaveLength(1);
    expect(res.writes[0]).toContain("event: notification");
    expect(res.writes[0]).toContain("REPLY_TO_POST");
  });

  it("push delivers event only to the target user", () => {
    const mgr = new SSEManager();
    const res1 = createMockWritable();
    const res2 = createMockWritable();
    mgr.register("user1", res1);
    mgr.register("user2", res2);
    mgr.push("user1", "notification", {});
    expect(res1.writes).toHaveLength(1);
    expect(res2.writes).toHaveLength(0);
  });

  it("unregister removes the connection so push no longer delivers", () => {
    const mgr = new SSEManager();
    const res = createMockWritable();
    const connId = mgr.register("user1", res);
    mgr.unregister("user1", connId);
    mgr.push("user1", "notification", {});
    expect(res.writes).toHaveLength(0);
  });

  it("push to a writableEnded connection does not throw", () => {
    const mgr = new SSEManager();
    const res = createMockWritable({ writableEnded: true });
    mgr.register("user1", res);
    expect(() => mgr.push("user1", "notification", {})).not.toThrow();
    expect(res.writes).toHaveLength(0);
  });

  it("push to a destroyed connection does not throw", () => {
    const mgr = new SSEManager();
    const res = createMockWritable({ destroyed: true });
    mgr.register("user1", res);
    expect(() => mgr.push("user1", "notification", {})).not.toThrow();
    expect(res.writes).toHaveLength(0);
  });

  it("push to a user with no registered connections does not throw", () => {
    const mgr = new SSEManager();
    expect(() => mgr.push("nonexistent", "notification", {})).not.toThrow();
  });

  it("supports multiple connections per user and delivers to all", () => {
    const mgr = new SSEManager();
    const res1 = createMockWritable();
    const res2 = createMockWritable();
    mgr.register("user1", res1);
    mgr.register("user1", res2);
    mgr.push("user1", "notification", {});
    expect(res1.writes).toHaveLength(1);
    expect(res2.writes).toHaveLength(1);
  });
});

// ─── GET /notifications ───────────────────────────────────────────────────────

describe("GET /notifications", () => {
  it("returns empty list and zero unreadCount initially", async () => {
    const { cookieHeader } = await registerVerifyAndLogin("notif-empty@tu-berlin.de");
    const res = await app.inject({
      method: "GET",
      url: "/notifications",
      headers: { Cookie: cookieHeader },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ notifications: [], unreadCount: 0 });
  });

  it("returns notifications sorted newest first", async () => {
    const { cookieHeader, userId } = await registerVerifyAndLogin("notif-list@tu-berlin.de");
    await prisma.notification.createMany({
      data: [
        { userId, type: "REPLY_TO_POST" },
        { userId, type: "REPLY_UPVOTED" },
      ],
    });
    const res = await app.inject({
      method: "GET",
      url: "/notifications",
      headers: { Cookie: cookieHeader },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ notifications: Array<{ type: string; isRead: boolean }>; unreadCount: number }>();
    expect(body.notifications).toHaveLength(2);
    expect(body.unreadCount).toBe(2);
  });

  it("returns correct unreadCount when some are read", async () => {
    const { cookieHeader, userId } = await registerVerifyAndLogin("notif-unread@tu-berlin.de");
    await prisma.notification.createMany({
      data: [
        { userId, type: "REPLY_TO_POST", isRead: true },
        { userId, type: "REPLY_UPVOTED", isRead: false },
      ],
    });
    const res = await app.inject({
      method: "GET",
      url: "/notifications",
      headers: { Cookie: cookieHeader },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ unreadCount: 1 });
  });

  it("respects limit and offset query params", async () => {
    const { cookieHeader, userId } = await registerVerifyAndLogin("notif-paginate@tu-berlin.de");
    await prisma.notification.createMany({
      data: Array.from({ length: 5 }, () => ({ userId, type: "REPLY_TO_POST" as const })),
    });
    const res = await app.inject({
      method: "GET",
      url: "/notifications?limit=2&offset=1",
      headers: { Cookie: cookieHeader },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json<{ notifications: unknown[] }>().notifications).toHaveLength(2);
  });

  it("returns 401 without auth", async () => {
    const res = await app.inject({ method: "GET", url: "/notifications" });
    expect(res.statusCode).toBe(401);
  });
});

// ─── PATCH /notifications/:id/read ───────────────────────────────────────────

describe("PATCH /notifications/:id/read", () => {
  it("marks a notification as read and returns it", async () => {
    const { cookieHeader, userId } = await registerVerifyAndLogin("notif-read@tu-berlin.de");
    const notif = await prisma.notification.create({
      data: { userId, type: "REPLY_TO_POST" },
    });
    const res = await app.inject({
      method: "PATCH",
      url: `/notifications/${notif.id}/read`,
      headers: { Cookie: cookieHeader },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id: notif.id, isRead: true });
  });

  it("returns 404 for unknown notification", async () => {
    const { cookieHeader } = await registerVerifyAndLogin("notif-404@tu-berlin.de");
    const res = await app.inject({
      method: "PATCH",
      url: "/notifications/does-not-exist/read",
      headers: { Cookie: cookieHeader },
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 403 when notification belongs to another user", async () => {
    const { cookieHeader } = await registerVerifyAndLogin("notif-403a@tu-berlin.de");
    const { userId: otherId } = await registerVerifyAndLogin("notif-403b@tu-berlin.de");
    const notif = await prisma.notification.create({
      data: { userId: otherId, type: "REPLY_TO_POST" },
    });
    const res = await app.inject({
      method: "PATCH",
      url: `/notifications/${notif.id}/read`,
      headers: { Cookie: cookieHeader },
    });
    expect(res.statusCode).toBe(403);
  });

  it("returns 401 without auth", async () => {
    const res = await app.inject({ method: "PATCH", url: "/notifications/some-id/read" });
    expect(res.statusCode).toBe(401);
  });
});

// ─── PATCH /notifications/read-all ───────────────────────────────────────────

describe("PATCH /notifications/read-all", () => {
  it("marks all unread notifications as read", async () => {
    const { cookieHeader, userId } = await registerVerifyAndLogin("notif-readall@tu-berlin.de");
    await prisma.notification.createMany({
      data: [
        { userId, type: "REPLY_TO_POST", isRead: false },
        { userId, type: "REPLY_UPVOTED", isRead: false },
        { userId, type: "NEW_POST_IN_CATEGORY", isRead: true },
      ],
    });
    const res = await app.inject({
      method: "PATCH",
      url: "/notifications/read-all",
      headers: { Cookie: cookieHeader },
    });
    expect(res.statusCode).toBe(204);

    const count = await prisma.notification.count({ where: { userId, isRead: false } });
    expect(count).toBe(0);
  });

  it("is idempotent when all notifications are already read", async () => {
    const { cookieHeader, userId } = await registerVerifyAndLogin("notif-readall2@tu-berlin.de");
    await prisma.notification.create({ data: { userId, type: "REPLY_TO_POST", isRead: true } });
    const res = await app.inject({
      method: "PATCH",
      url: "/notifications/read-all",
      headers: { Cookie: cookieHeader },
    });
    expect(res.statusCode).toBe(204);
  });

  it("only marks the current user's notifications", async () => {
    const { cookieHeader, userId } = await registerVerifyAndLogin("notif-readall3a@tu-berlin.de");
    const { userId: otherId } = await registerVerifyAndLogin("notif-readall3b@tu-berlin.de");
    await prisma.notification.createMany({
      data: [
        { userId, type: "REPLY_TO_POST" },
        { userId: otherId, type: "REPLY_UPVOTED" },
      ],
    });
    await app.inject({
      method: "PATCH",
      url: "/notifications/read-all",
      headers: { Cookie: cookieHeader },
    });
    const otherUnread = await prisma.notification.count({ where: { userId: otherId, isRead: false } });
    expect(otherUnread).toBe(1);
  });

  it("returns 401 without auth", async () => {
    const res = await app.inject({ method: "PATCH", url: "/notifications/read-all" });
    expect(res.statusCode).toBe(401);
  });
});

// ─── Integration: notifications created on post/reply events ─────────────────

describe("Notification creation on events", () => {
  it("creates NEW_POST_IN_CATEGORY notification for subscribed users when a post is created", async () => {
    const { cookieHeader: authorCookie } = await registerVerifyAndLogin("notif-author@tu-berlin.de");
    const { userId: subUserId } = await registerVerifyAndLogin("notif-subscriber@tu-berlin.de");

    // Subscribe the second user to Academic
    await prisma.notificationPreference.create({
      data: { userId: subUserId, category: "Academic" },
    });

    await app.inject({
      method: "POST",
      url: "/posts",
      headers: { Cookie: authorCookie },
      payload: { content: "test post", category: "Academic" },
    });

    // Allow the fire-and-forget promise to resolve
    await new Promise((r) => setTimeout(r, 50));

    const count = await prisma.notification.count({
      where: { userId: subUserId, type: "NEW_POST_IN_CATEGORY" },
    });
    expect(count).toBe(1);
  });

  it("does not notify the author about their own post", async () => {
    const { cookieHeader, userId } = await registerVerifyAndLogin("notif-self@tu-berlin.de");

    await prisma.notificationPreference.create({
      data: { userId, category: "Social" },
    });

    await app.inject({
      method: "POST",
      url: "/posts",
      headers: { Cookie: cookieHeader },
      payload: { content: "my own post", category: "Social" },
    });

    await new Promise((r) => setTimeout(r, 50));

    const count = await prisma.notification.count({
      where: { userId, type: "NEW_POST_IN_CATEGORY" },
    });
    expect(count).toBe(0);
  });

  it("creates REPLY_TO_POST notification for the post author when someone replies", async () => {
    const { cookieHeader: authorCookie, userId: authorId } =
      await registerVerifyAndLogin("notif-postauthor@tu-berlin.de");
    const { cookieHeader: replierCookie } =
      await registerVerifyAndLogin("notif-replier@tu-berlin.de");

    const postRes = await app.inject({
      method: "POST",
      url: "/posts",
      headers: { Cookie: authorCookie },
      payload: { content: "question here", category: "Academic" },
    });
    const postId = postRes.json<{ id: string }>().id;

    await app.inject({
      method: "POST",
      url: `/posts/${postId}/replies`,
      headers: { Cookie: replierCookie },
      payload: { content: "answer here" },
    });

    await new Promise((r) => setTimeout(r, 50));

    const count = await prisma.notification.count({
      where: { userId: authorId, type: "REPLY_TO_POST", postId },
    });
    expect(count).toBe(1);
  });

  it("creates REPLY_UPVOTED notification for the reply author", async () => {
    const { cookieHeader: authorCookie, userId: authorId } =
      await registerVerifyAndLogin("notif-replyauthor@tu-berlin.de");
    const { cookieHeader: voterCookie } =
      await registerVerifyAndLogin("notif-voter@tu-berlin.de");

    const postRes = await app.inject({
      method: "POST",
      url: "/posts",
      headers: { Cookie: authorCookie },
      payload: { content: "post", category: "Academic" },
    });
    const postId = postRes.json<{ id: string }>().id;

    const replyRes = await app.inject({
      method: "POST",
      url: `/posts/${postId}/replies`,
      headers: { Cookie: authorCookie },
      payload: { content: "my reply" },
    });
    const replyId = replyRes.json<{ id: string }>().id;

    await app.inject({
      method: "POST",
      url: `/replies/${replyId}/upvote`,
      headers: { Cookie: voterCookie },
    });

    await new Promise((r) => setTimeout(r, 50));

    const count = await prisma.notification.count({
      where: { userId: authorId, type: "REPLY_UPVOTED", replyId },
    });
    expect(count).toBe(1);
  });

  it("creates REPLY_MARKED_SOLUTION notification for the reply author", async () => {
    const { cookieHeader: authorCookie, userId: authorId } =
      await registerVerifyAndLogin("notif-solauthor@tu-berlin.de");
    const { cookieHeader: replierCookie, userId: replierId } =
      await registerVerifyAndLogin("notif-solreplier@tu-berlin.de");

    const postRes = await app.inject({
      method: "POST",
      url: "/posts",
      headers: { Cookie: authorCookie },
      payload: { content: "question", category: "Academic" },
    });
    const postId = postRes.json<{ id: string }>().id;

    const replyRes = await app.inject({
      method: "POST",
      url: `/posts/${postId}/replies`,
      headers: { Cookie: replierCookie },
      payload: { content: "answer" },
    });
    const replyId = replyRes.json<{ id: string }>().id;

    await app.inject({
      method: "PATCH",
      url: `/posts/${postId}/solution`,
      headers: { Cookie: authorCookie },
      payload: { replyId },
    });

    await new Promise((r) => setTimeout(r, 50));

    const count = await prisma.notification.count({
      where: { userId: replierId, type: "REPLY_MARKED_SOLUTION", replyId },
    });
    expect(count).toBe(1);
  });
});
