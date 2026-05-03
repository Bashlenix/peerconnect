-- DropIndex
DROP INDEX "posts_search_vector_idx";

-- AlterTable
ALTER TABLE "posts" ALTER COLUMN "search_vector" DROP DEFAULT;
