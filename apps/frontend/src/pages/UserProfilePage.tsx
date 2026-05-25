import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, MessageSquare, CheckCircle, AlertCircle, Pencil, Trash2 } from "lucide-react";
import { getPublicProfile } from "@/api/users";
import { getPosts, updatePost, deletePost, type Post } from "@/api/posts";
import { useAuthStore } from "@/store/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

// ─── Shared helpers (mirrored from FeedPage) ─────────────────────────────────

const CATEGORIES = [
  { value: "Academic" as const, label: "Academic" },
  { value: "Social" as const, label: "Social" },
  { value: "Sport" as const, label: "Sport" },
  { value: "DailyLifeSupport" as const, label: "Daily Life Support" },
];

const CATEGORY_COLORS: Record<string, string> = {
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

// ─── PostCard (lightweight version for profile tab) ──────────────────────────

const PAGE_SIZE = 10;

interface ProfilePostCardProps {
  post: Post;
  currentUserId: string | undefined;
  onUpdated: () => void;
}

function ProfilePostCard({ post, currentUserId, onUpdated }: ProfilePostCardProps) {
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
              className={`px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLORS[post.category] ?? ""}`}
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
            <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>
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

// ─── Posts tab ────────────────────────────────────────────────────────────────

function PostsTab({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [page, setPage] = useState(1);
  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [hasMore, setHasMore] = useState(true);

  const { isLoading, isError, error, isFetching } = useQuery({
    queryKey: ["profilePosts", userId, page],
    queryFn: async () => {
      const result = await getPosts({ authorId: userId, page, limit: PAGE_SIZE });
      setAllPosts((prev) => {
        // Deduplicate by id in case of refetch
        const existingIds = new Set(prev.map((p) => p.id));
        const newPosts = result.posts.filter((p) => !existingIds.has(p.id));
        return page === 1 ? result.posts : [...prev, ...newPosts];
      });
      setHasMore(result.posts.length === PAGE_SIZE);
      return result;
    },
  });

  function invalidatePosts() {
    // Reset to page 1 and clear accumulated posts
    setAllPosts([]);
    setPage(1);
    void queryClient.invalidateQueries({ queryKey: ["profilePosts", userId] });
  }

  function loadMore() {
    setPage((p) => p + 1);
  }

  if (isLoading && page === 1) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (isError) {
    return (
      <p className="text-center text-sm text-red-600 py-8">
        {(error as Error).message}
      </p>
    );
  }

  if (allPosts.length === 0) {
    return (
      <p className="text-center text-sm text-gray-400 py-8">No posts yet.</p>
    );
  }

  return (
    <div className="space-y-4">
      {allPosts.map((post) => (
        <ProfilePostCard
          key={post.id}
          post={post}
          currentUserId={user?.id}
          onUpdated={invalidatePosts}
        />
      ))}

      {hasMore ? (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadMore}
            disabled={isFetching}
          >
            {isFetching ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> Loading…</>
            ) : (
              "Load more"
            )}
          </Button>
        </div>
      ) : (
        <p className="text-center text-xs text-gray-400 pt-2">No more posts.</p>
      )}
    </div>
  );
}

// ─── About tab ────────────────────────────────────────────────────────────────

type ProfileData = Awaited<ReturnType<typeof getPublicProfile>>;

function AboutTab({ profile }: { profile: ProfileData }) {
  return (
    <>
      <Card className="mb-6">
        <CardContent className="pt-6 space-y-3">
          {profile.studyProgramme && (
            <div className="text-sm">
              <span className="font-medium text-gray-700">Study programme:</span>{" "}
              <span className="text-gray-600">{profile.studyProgramme}</span>
            </div>
          )}
          {profile.semester != null && (
            <div className="text-sm">
              <span className="font-medium text-gray-700">Semester:</span>{" "}
              <span className="text-gray-600">{profile.semester}</span>
            </div>
          )}
          {profile.languages.length > 0 && (
            <div className="text-sm">
              <span className="font-medium text-gray-700">Languages:</span>{" "}
              <span className="text-gray-600">{profile.languages.join(", ")}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <MessageSquare className="h-5 w-5 text-blue-500" />
            <div>
              <p className="text-2xl font-bold text-gray-900">{profile.replyCount}</p>
              <p className="text-xs text-gray-500">Replies</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <div>
              <p className="text-2xl font-bold text-gray-900">{profile.solutionCount}</p>
              <p className="text-xs text-gray-500">Solutions accepted</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Badges</h2>
        {profile.badges.length === 0 ? (
          <p className="text-sm text-gray-400">No badges earned yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {profile.badges.map((badge) => (
              <div
                key={badge.name}
                title={badge.description}
                className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium cursor-default"
              >
                {badge.name}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = "posts" | "about";

export default function UserProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("posts");

  const { data: profile, isLoading, isError } = useQuery({
    queryKey: ["publicProfile", id],
    queryFn: () => getPublicProfile(id!),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (isError || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">User not found.</p>
          <button
            onClick={() => navigate(-1)}
            className="text-sm text-blue-600 hover:underline"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  const displayName =
    profile.firstName && profile.lastName
      ? `${profile.firstName} ${profile.lastName}`
      : profile.firstName ?? profile.lastName ?? "Anonymous";

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <h1 className="text-2xl font-bold text-gray-900 mb-6">{displayName}</h1>

        {/* Tab bar */}
        <div className="flex border-b border-gray-200 mb-6">
          {(["posts", "about"] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px transition-colors ${
                activeTab === tab
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab === "posts" ? "Posts" : "About"}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "posts" && <PostsTab userId={id!} />}
        {activeTab === "about" && <AboutTab profile={profile} />}
      </div>
    </div>
  );
}
