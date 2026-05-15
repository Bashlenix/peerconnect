import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, MessageSquare, Loader2, Pencil, Trash2, Filter, Search, X } from "lucide-react";
import { logout } from "@/api/auth";
import { askAI } from "@/api/ai";
import type { AiAskResponse } from "@peerconnect/shared";
import { getPosts, searchPosts, createPost, updatePost, deletePost, type PostCategory, type SinceFilter, type Post } from "@/api/posts";
import { getAds, type Ad } from "@/api/ads";
import { useAuthStore } from "@/store/auth";
import { NotificationBell } from "@/components/NotificationBell";
import { AdCard } from "@/components/AdCard";
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

interface PostCardProps {
  post: Post;
  currentUserId: string | undefined;
  onUpdated: () => void;
}

function PostCard({ post, currentUserId, onUpdated }: PostCardProps) {
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isAuthor = currentUserId === post.author.id;

  const editMutation = useMutation({
    mutationFn: (content: string) => updatePost(post.id, content),
    onSuccess: () => {
      setEditing(false);
      onUpdated();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deletePost(post.id),
    onSuccess: () => {
      setConfirmDelete(false);
      onUpdated();
    },
  });

  function handleCardClick() {
    if (!editing && !confirmDelete) navigate(`/posts/${post.id}`);
  }

  function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editContent.trim()) return;
    editMutation.mutate(editContent.trim());
  }

  return (
    <Card
      className={`hover:shadow-md transition-shadow ${!editing && !confirmDelete ? "cursor-pointer" : ""} ${post.isUrgent ? "border-red-400" : ""}`}
      onClick={handleCardClick}
    >
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
            {isAuthor && !editing && !confirmDelete && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-gray-400 hover:text-gray-600"
                  onClick={(e) => { e.stopPropagation(); setEditContent(post.content); setEditing(true); }}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`h-7 w-7 p-0 text-gray-400 hover:text-red-500 ${post.replyCount > 0 ? "opacity-40 cursor-not-allowed" : ""}`}
                  onClick={(e) => { e.stopPropagation(); if (post.replyCount === 0) setConfirmDelete(true); }}
                  title={post.replyCount > 0 ? "Cannot delete a post with replies" : "Delete post"}
                  disabled={post.replyCount > 0}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </>
            )}
          </div>
        </div>

        {editing ? (
          <form onSubmit={handleEditSubmit} className="space-y-2" onClick={(e) => e.stopPropagation()}>
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={3}
              disabled={editMutation.isPending}
            />
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" size="sm" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={editMutation.isPending || !editContent.trim()}>
                {editMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save"}
              </Button>
            </div>
            {editMutation.isError && (
              <p className="text-xs text-red-600">{editMutation.error.message}</p>
            )}
          </form>
        ) : (
          <>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{post.content}</p>
            {post.editedAt && (
              <p className="text-xs text-gray-400 mt-1">edited {formatTimeAgo(post.editedAt)}</p>
            )}
          </>
        )}

        {confirmDelete && (
          <div className="mt-3 flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
            <span className="text-sm text-gray-700">Delete this post?</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmDelete(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Delete"}
            </Button>
            {deleteMutation.isError && (
              <span className="text-xs text-red-600">{deleteMutation.error.message}</span>
            )}
          </div>
        )}

        {!editing && (
          <div className="flex items-center gap-1 mt-3 text-xs text-gray-500">
            <MessageSquare className="w-3.5 h-3.5" />
            <span>{post.replyCount} {post.replyCount === 1 ? "reply" : "replies"}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CreatePostForm({ onSuccess }: { onSuccess: () => void }) {
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<PostCategory>("Academic");
  const [isUrgent, setIsUrgent] = useState(false);
  const [aiResult, setAiResult] = useState<AiAskResponse | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    if (content.trim().length < 20) {
      setAiResult(null);
      setAiLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      setAiLoading(true);
      try {
        const result = await askAI(content);
        setAiResult(result);
      } catch {
        // Silently ignore AI errors — never surface them to the user
      } finally {
        setAiLoading(false);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [content]);

  const mutation = useMutation({
    mutationFn: createPost,
    onSuccess: () => {
      setContent("");
      setIsUrgent(false);
      setAiResult(null);
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
          {aiLoading && (
            <p className="text-xs text-gray-400">
              <Loader2 className="w-3 h-3 animate-spin inline mr-1" />
              Checking previous answers…
            </p>
          )}
          {!aiLoading && aiResult && aiResult.confidence !== "none" && (
            <div className="rounded-md bg-blue-50 border border-blue-100 p-3 text-sm space-y-2">
              {aiResult.confidence === "high" && (
                <p className="text-gray-700">{aiResult.answer}</p>
              )}
              {aiResult.confidence === "low" && (
                <p className="text-gray-500 text-xs">
                  Partial matches found — post if this doesn't help
                </p>
              )}
              {aiResult.sources.length > 0 && (
                <div className="flex flex-col gap-1">
                  {aiResult.sources.slice(0, 3).map((source) => {
                    const name =
                      source.author.firstName && source.author.lastName
                        ? `${source.author.firstName} ${source.author.lastName}`
                        : source.author.firstName ?? "Anonymous";
                    return (
                      <Link
                        key={source.id}
                        to={"/posts/" + source.id}
                        className="text-blue-600 hover:underline text-xs"
                      >
                        See post by {name} →
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}
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

const SINCE_OPTIONS: { value: SinceFilter; label: string }[] = [
  { value: "24h", label: "Last 24h" },
  { value: "3d", label: "Last 3 days" },
  { value: "7d", label: "Last 7 days" },
];

interface FeedFilters {
  category: PostCategory | "";
  since: SinceFilter | "";
  subscribed: boolean;
}

function FilterPanel({
  filters,
  onChange,
}: {
  filters: FeedFilters;
  onChange: (filters: FeedFilters) => void;
}) {
  const hasActiveFilter = filters.category !== "" || filters.since !== "" || filters.subscribed;

  return (
    <Card className={hasActiveFilter ? "border-blue-300 bg-blue-50/40" : ""}>
      <CardContent className="pt-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Filters</span>
          {hasActiveFilter && (
            <button
              className="ml-auto text-xs text-blue-600 hover:underline"
              onClick={() => onChange({ category: "", since: "", subscribed: false })}
            >
              Clear all
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <select
            value={filters.category}
            onChange={(e) => onChange({ ...filters, category: e.target.value as PostCategory | "" })}
            className="h-8 rounded-md border border-gray-300 bg-white px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
          >
            <option value="">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>

          <select
            value={filters.since}
            onChange={(e) => onChange({ ...filters, since: e.target.value as SinceFilter | "" })}
            className="h-8 rounded-md border border-gray-300 bg-white px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
          >
            <option value="">Any time</option>
            {SINCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.subscribed}
              onChange={(e) => onChange({ ...filters, subscribed: e.target.checked })}
              className="rounded border-gray-300"
            />
            My subscriptions only
          </label>
        </div>
      </CardContent>
    </Card>
  );
}

export default function FeedPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, clearAuth } = useAuthStore();

  const [filters, setFilters] = useState<FeedFilters>({ category: "", since: "", subscribed: false });
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const searchActive = searchQuery !== "";

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      clearAuth();
      queryClient.clear();
      navigate("/login", { replace: true });
    },
  });

  const feedQueryResult = useQuery({
    queryKey: ["posts", filters],
    queryFn: () =>
      getPosts({
        limit: 50,
        category: filters.category || undefined,
        since: filters.since || undefined,
        subscribed: filters.subscribed || undefined,
      }),
    enabled: !searchActive,
  });

  const searchQueryResult = useQuery({
    queryKey: ["posts", "search", searchQuery],
    queryFn: () => searchPosts({ q: searchQuery, limit: 50 }),
    enabled: searchActive,
  });

  const adsQueryResult = useQuery({
    queryKey: ["ads"],
    queryFn: getAds,
    staleTime: 5 * 60 * 1000,
  });

  const { data, isLoading, isError, error } = searchActive ? searchQueryResult : feedQueryResult;

  const ads: Ad[] = (!searchActive && adsQueryResult.data?.ads) ? adsQueryResult.data.ads : [];

  function invalidateFeed() {
    queryClient.invalidateQueries({ queryKey: ["posts"] });
  }

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && searchInput.trim()) {
      setSearchQuery(searchInput.trim());
    } else if (e.key === "Escape") {
      setSearchInput("");
      setSearchQuery("");
    }
  }

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSearchInput(e.target.value);
    if (e.target.value === "") {
      setSearchQuery("");
    }
  }

  function clearSearch() {
    setSearchInput("");
    setSearchQuery("");
  }

  const hasActiveFilter = filters.category !== "" || filters.since !== "" || filters.subscribed;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white px-6 py-4 flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold shrink-0">PeerConnect</h1>
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search posts… (Enter to search)"
            value={searchInput}
            onChange={handleSearchChange}
            onKeyDown={handleSearchKeyDown}
            className="w-full pl-8 pr-8 h-9 rounded-md border border-gray-300 bg-white text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          {searchInput && (
            <button
              onClick={clearSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-sm text-gray-600">{user?.email}</span>
          <NotificationBell />
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

        {!searchActive && <FilterPanel filters={filters} onChange={setFilters} />}

        {searchActive && (
          <p className="text-sm text-gray-500">
            Search results for <span className="font-medium text-gray-800">"{searchQuery}"</span>
          </p>
        )}

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
            {searchActive
              ? `No posts found for "${searchQuery}".`
              : hasActiveFilter
              ? "No posts match the current filters."
              : "No posts yet. Be the first to ask something!"}
          </p>
        )}

        {data && (() => {
          const posts = data.posts;
          const shouldInjectAds = ads.length > 0 && posts.length >= 5;
          const items: React.ReactNode[] = [];
          let adSlot = 0;

          posts.forEach((post, i) => {
            items.push(
              <PostCard
                key={post.id}
                post={post}
                currentUserId={user?.id}
                onUpdated={invalidateFeed}
              />
            );
            if (shouldInjectAds && (i + 1) % 5 === 0) {
              const ad = ads[adSlot % ads.length]!;
              items.push(<AdCard key={`ad-${adSlot}-${ad.id}`} ad={ad} />);
              adSlot++;
            }
          });

          return items;
        })()}
      </main>
    </div>
  );
}
