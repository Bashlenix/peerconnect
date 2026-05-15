import { Prisma } from "../generated/prisma/client.js";
import type { PrismaClient } from "../generated/prisma/client.js";

export interface RetrievedPost {
  id: string;
  content: string;
  category: string;
  author: { firstName: string | null; lastName: string | null };
  acceptedSolution: { content: string; author: { firstName: string | null; lastName: string | null } } | null;
}

interface RawRow {
  id: string;
  content: string;
  category: string;
  authorFirstName: string | null;
  authorLastName: string | null;
}

async function queryPosts(prisma: PrismaClient, tsQuery: string, limit: number): Promise<RawRow[]> {
  return prisma.$queryRaw<RawRow[]>`
    SELECT
      p.id,
      p.content,
      p.category::text AS category,
      u."firstName" AS "authorFirstName",
      u."lastName"  AS "authorLastName"
    FROM posts p
    JOIN users u ON u.id = p."authorId"
    WHERE p.search_vector @@ websearch_to_tsquery('english', ${tsQuery})
    ORDER BY ts_rank(p.search_vector, websearch_to_tsquery('english', ${tsQuery})) DESC
    LIMIT ${Prisma.raw(String(limit))}
  `;
}

// Build a fallback OR query from the significant words in the input.
// Conversational openers ("hey", "any idea about") add noise terms that
// the AND query requires — the OR fallback finds posts matching ANY topic word.
function buildOrQuery(query: string): string {
  return query
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(-8)          // focus on the tail — that's usually the actual topic
    .join(" | ");
}

export async function retrieveRelevantPosts(
  prisma: PrismaClient,
  query: string,
  limit = 5
): Promise<RetrievedPost[]> {
  // First pass: strict AND — exact for clean keyword queries (e.g. from /ask)
  let rows = await queryPosts(prisma, query, limit);

  // Second pass: OR fallback — handles conversational input like
  // "Hey any idea about python course" where AND requires all terms
  if (rows.length === 0) {
    const orQuery = buildOrQuery(query);
    if (orQuery) rows = await queryPosts(prisma, orQuery, limit);
  }

  if (rows.length === 0) return [];

  const postIds = rows.map((r) => r.id);

  const solutions = await prisma.reply.findMany({
    where: { postId: { in: postIds }, isSolution: true },
    select: {
      postId: true,
      content: true,
      author: { select: { firstName: true, lastName: true } },
    },
  });

  const solutionByPostId = new Map(solutions.map((s) => [s.postId, s]));

  return rows.map((row) => {
    const solution = solutionByPostId.get(row.id) ?? null;
    return {
      id: row.id,
      content: row.content,
      category: row.category,
      author: { firstName: row.authorFirstName, lastName: row.authorLastName },
      acceptedSolution: solution
        ? {
            content: solution.content,
            author: { firstName: solution.author.firstName, lastName: solution.author.lastName },
          }
        : null,
    };
  });
}
