-- Restore GIN index on search_vector (dropped in post_implementation migration)
CREATE INDEX "posts_search_vector_idx" ON "posts" USING GIN ("search_vector");
