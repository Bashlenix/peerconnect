import { Prisma } from "../generated/prisma/client.js";
import type { PrismaClient, PostCategory } from "../generated/prisma/client.js";
import type { SinceFilter } from "./feed-query.js";
import { sinceDate } from "./feed-query.js";

export interface SearchParams {
  q: string;
  category?: PostCategory;
  since?: SinceFilter;
  limit: number;
  offset: number;
}

export interface SearchPost {
  id: string;
  content: string;
  category: string;
  isUrgent: boolean;
  createdAt: Date;
  editedAt: Date | null;
  author: { id: string; firstName: string | null; lastName: string | null };
  replyCount: number;
}

interface RawRow {
  id: string;
  content: string;
  category: string;
  isUrgent: boolean;
  createdAt: Date;
  editedAt: Date | null;
  authorId: string;
  authorFirstName: string | null;
  authorLastName: string | null;
  replyCount: number | bigint;
}

export async function searchPosts(prisma: PrismaClient, params: SearchParams): Promise<SearchPost[]> {
  const { q, category, since, limit, offset } = params;

  const categoryFilter = category
    ? Prisma.sql`AND p.category::text = ${category}`
    : Prisma.empty;

  const sinceFilter = since
    ? Prisma.sql`AND p."createdAt" >= ${sinceDate(since)}`
    : Prisma.empty;

  const rows = await prisma.$queryRaw<RawRow[]>`
    SELECT
      p.id,
      p.content,
      p.category::text AS category,
      p."isUrgent",
      p."createdAt",
      p."editedAt",
      u.id AS "authorId",
      u."firstName" AS "authorFirstName",
      u."lastName" AS "authorLastName",
      CAST(COUNT(r.id) AS int) AS "replyCount"
    FROM posts p
    JOIN users u ON u.id = p."authorId"
    LEFT JOIN replies r ON r."postId" = p.id
    WHERE p.search_vector @@ websearch_to_tsquery('english', ${q})
    ${categoryFilter}
    ${sinceFilter}
    GROUP BY p.id, u.id
    ORDER BY ts_rank(p.search_vector, websearch_to_tsquery('english', ${q})) DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  return rows.map((row) => ({
    id: row.id,
    content: row.content,
    category: row.category,
    isUrgent: row.isUrgent,
    createdAt: row.createdAt,
    editedAt: row.editedAt,
    author: {
      id: row.authorId,
      firstName: row.authorFirstName,
      lastName: row.authorLastName,
    },
    replyCount: Number(row.replyCount),
  }));
}
