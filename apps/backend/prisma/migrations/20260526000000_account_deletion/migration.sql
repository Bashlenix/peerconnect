-- AlterTable: make Post.authorId nullable (was NOT NULL)
ALTER TABLE "posts" ALTER COLUMN "authorId" DROP NOT NULL;

-- AlterTable: make Reply.authorId nullable (was NOT NULL)
ALTER TABLE "replies" ALTER COLUMN "authorId" DROP NOT NULL;

-- Re-create FK on posts with SET NULL
ALTER TABLE "posts" DROP CONSTRAINT IF EXISTS "posts_authorId_fkey";
ALTER TABLE "posts" ADD CONSTRAINT "posts_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Re-create FK on replies with SET NULL
ALTER TABLE "replies" DROP CONSTRAINT IF EXISTS "replies_authorId_fkey";
ALTER TABLE "replies" ADD CONSTRAINT "replies_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
