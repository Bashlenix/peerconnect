import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, MessageSquare, Loader2 } from "lucide-react";
import { logout } from "@/api/auth";
import { getPosts, createPost, type PostCategory, type Post } from "@/api/posts";
import { useAuthStore } from "@/store/auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";

const CATEGORIES: { value: PostCategory; label: string }[] = [
  { value: "Academic", label: "Academic" },
  { value: "Social", label: "Social" },
  { value: "Sport", label: "Sport" },
  { value: "DailyLifeSupport", label: "Daily Life Support" },
];

const CATEGORY_COLORS: Record<PostCategory, string> = {
  Academic: "bg-blue-100 text-blue-800",
  Social: "bg-green-100 text-green-800",
  Sport: "bg-orange-100 text-orange-800",
  DailyLifeSupport: "bg-purple-100 text-purple-800",
};

function formatTimeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function authorName(author: Post["author"]): string {
  if (author.firstName && author.lastName) return `${author.firstName} ${author.lastName}`;
  if (author.firstName) return author.firstName;
  return "Anonymous";
}

function PostCard({ post }: { post: Post }) {
  return (
    <Link to={`/posts/${post.id}`} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg">
      <Card className={`hover:shadow-md transition-shadow cursor-pointer ${post.isUrgent ? "border-red-400" : ""}`}>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-900">{authorName(post.author)}</span>
              <span className="text-xs text-gray-400">{formatTimeAgo(post.createdAt)}</span>
            </div>
            <div className="flex items-center gap-2">
              {post.isUrgent && (
                <span className="flex items-center gap-1 text-xs font-semibold text-red-600">
                  <AlertCircle className="w-3 h-3" />
                  Urgent
                </span>
              )}
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLORS[post.category]}`}
              >
                {CATEGORIES.find((c) => c.value === post.category)?.label ?? post.category}
              </span>
            </div>
          </div>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{post.content}</p>
          {post.editedAt && (
            <p className="text-xs text-gray-400 mt-1">edited {formatTimeAgo(post.editedAt)}</p>
          )}
          <div className="flex items-center gap-1 mt-3 text-xs text-gray-500">
            <MessageSquare className="w-3.5 h-3.5" />
            <span>{post.replyCount} {post.replyCount === 1 ? "reply" : "replies"}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function CreatePostForm({ onSuccess }: { onSuccess: () => void }) {
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<PostCategory>("Academic");
  const [isUrgent, setIsUrgent] = useState(false);

  const mutation = useMutation({
    mutationFn: createPost,
    onSuccess: () => {
      setContent("");
      setIsUrgent(false);
      onSuccess();
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    mutation.mutate({ content: content.trim(), category, isUrgent });
  }

  return (
    <Card>
      <CardContent className="pt-4">
        <form onSubmit={handleSubmit} className="space-y-3">
          <Textarea
            placeholder="What do you need help with?"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            disabled={mutation.isPending}
          />
          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as PostCategory)}
              className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
              disabled={mutation.isPending}
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={isUrgent}
                onChange={(e) => setIsUrgent(e.target.checked)}
                disabled={mutation.isPending}
                className="rounded border-gray-300"
              />
              Mark as urgent
            </label>
            <Button
              type="submit"
              disabled={mutation.isPending || !content.trim()}
              className="ml-auto"
            >
              {mutation.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Posting…</>
              ) : (
                "Post"
              )}
            </Button>
          </div>
          {mutation.isError && (
            <p className="text-sm text-red-600">{mutation.error.message}</p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

export default function FeedPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, clearAuth } = useAuthStore();

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      clearAuth();
      queryClient.clear();
      navigate("/login", { replace: true });
    },
  });

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["posts"],
    queryFn: () => getPosts({ limit: 50 }),
  });

  function invalidateFeed() {
    queryClient.invalidateQueries({ queryKey: ["posts"] });
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">PeerConnect</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">{user?.email}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
          >
            {logoutMutation.isPending ? "Signing out…" : "Sign out"}
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8 space-y-4">
        <CreatePostForm onSuccess={invalidateFeed} />

        {isLoading && (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        )}

        {isError && (
          <p className="text-center text-sm text-red-600">{(error as Error).message}</p>
        )}

        {data && data.posts.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-8">
            No posts yet. Be the first to ask something!
          </p>
        )}

        {data && data.posts.map((post) => <PostCard key={post.id} post={post} />)}
      </main>
    </div>
  );
}
