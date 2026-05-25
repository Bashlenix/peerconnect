import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CheckCircle,
  Loader2,
  MessageSquare,
  ThumbsUp,
  AlertCircle,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  getPosts,
  getReplies,
  createReply,
  upvoteReply,
  removeUpvote,
  updateReply,
  deleteReply,
  setSolution,
  removeSolution,
  updatePost,
  deletePost,
  type Post,
  type Reply,
  type PostCategory,
} from "@/api/posts";
import { useAuthStore } from "@/store/auth";
import { NotificationBell } from "@/components/NotificationBell";
import { AvatarDropdown } from "@/components/AvatarDropdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";

const CATEGORY_COLORS: Record<PostCategory, string> = {
  Academic: "bg-blue-100 text-blue-800",
  Social: "bg-green-100 text-green-800",
  Sport: "bg-orange-100 text-orange-800",
  DailyLifeSupport: "bg-purple-100 text-purple-800",
};

const CATEGORY_LABELS: Record<PostCategory, string> = {
  Academic: "Academic",
  Social: "Social",
  Sport: "Sport",
  DailyLifeSupport: "Daily Life Support",
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

interface ReplyCardProps {
  reply: Reply;
  postId: string;
  postAuthorId: string;
  currentUserId: string;
  onUpdated: () => void;
}

function ReplyCard({ reply, postId, postAuthorId, currentUserId, onUpdated }: ReplyCardProps) {
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(reply.content);

  const isAuthor = reply.author.id === currentUserId;
  const isPostAuthor = postAuthorId === currentUserId;

  const upvoteMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      if (reply.hasUpvoted) {
        await removeUpvote(reply.id);
      } else {
        await upvoteReply(reply.id);
      }
    },
    onSuccess: () => onUpdated(),
  });

  const editMutation = useMutation({
    mutationFn: (content: string) => updateReply(reply.id, content),
    onSuccess: () => {
      setEditing(false);
      onUpdated();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteReply(reply.id),
    onSuccess: () => onUpdated(),
  });

  const solutionMutation = useMutation({
    mutationFn: () =>
      reply.isSolution ? removeSolution(postId) : setSolution(postId, reply.id),
    onSuccess: () => onUpdated(),
  });

  function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editContent.trim()) return;
    editMutation.mutate(editContent.trim());
  }

  return (
    <Card className={reply.isSolution ? "border-green-400" : ""}>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900">{authorName(reply.author)}</span>
            <span className="text-xs text-gray-400">{formatTimeAgo(reply.createdAt)}</span>
          </div>
          <div className="flex items-center gap-2">
            {reply.isSolution && (
              <span className="flex items-center gap-1 text-xs font-semibold text-green-600">
                <CheckCircle className="w-3.5 h-3.5" />
                Accepted solution
              </span>
            )}
            {isPostAuthor && (
              <Button
                variant="ghost"
                size="sm"
                className={`text-xs h-7 px-2 ${reply.isSolution ? "text-green-600" : "text-gray-500"}`}
                onClick={() => solutionMutation.mutate()}
                disabled={solutionMutation.isPending}
              >
                {reply.isSolution ? "Unmark" : "Mark as solution"}
              </Button>
            )}
            {isAuthor && !editing && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-gray-400 hover:text-gray-600"
                  onClick={() => {
                    setEditContent(reply.content);
                    setEditing(true);
                  }}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                {!reply.isSolution && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-gray-400 hover:text-red-500"
                    onClick={() => deleteMutation.mutate()}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {editing ? (
          <form onSubmit={handleEditSubmit} className="space-y-2">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={3}
              disabled={editMutation.isPending}
            />
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditing(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={editMutation.isPending || !editContent.trim()}
              >
                {editMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save"}
              </Button>
            </div>
            {editMutation.isError && (
              <p className="text-xs text-red-600">{editMutation.error.message}</p>
            )}
          </form>
        ) : (
          <>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{reply.content}</p>
            {reply.editedAt && (
              <p className="text-xs text-gray-400 mt-1">edited {formatTimeAgo(reply.editedAt)}</p>
            )}
          </>
        )}

        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={() => upvoteMutation.mutate()}
            disabled={upvoteMutation.isPending}
            className={`flex items-center gap-1 text-xs rounded px-1.5 py-0.5 transition-colors ${
              reply.hasUpvoted
                ? "text-blue-600 bg-blue-50 hover:bg-blue-100"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
            }`}
          >
            <ThumbsUp className={`w-3.5 h-3.5 ${reply.hasUpvoted ? "fill-current" : ""}`} />
            <span>{reply.upvoteCount}</span>
          </button>
          {deleteMutation.isError && (
            <span className="text-xs text-red-600">{deleteMutation.error.message}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ReplyForm({ postId, onSuccess }: { postId: string; onSuccess: () => void }) {
  const [content, setContent] = useState("");

  const mutation = useMutation({
    mutationFn: (input: { content: string }) => createReply(postId, input),
    onSuccess: () => {
      setContent("");
      onSuccess();
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    mutation.mutate({ content: content.trim() });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      if (content.trim() && !mutation.isPending) {
        mutation.mutate({ content: content.trim() });
      }
    }
  }

  return (
    <Card>
      <CardContent className="pt-4">
        <form onSubmit={handleSubmit} className="space-y-3">
          <Textarea
            placeholder="Write your reply… (Cmd/Ctrl+Enter to submit)"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={4}
            disabled={mutation.isPending}
          />
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={mutation.isPending || !content.trim()}
            >
              {mutation.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Replying…</>
              ) : (
                "Reply"
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

export default function PostDetailPage() {
  const { id: postId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);

  const [editingPost, setEditingPost] = useState(false);
  const [editPostContent, setEditPostContent] = useState("");
  const [confirmDeletePost, setConfirmDeletePost] = useState(false);

  const { data: feedData, isLoading: feedLoading } = useQuery({
    queryKey: ["posts"],
    queryFn: () => getPosts({ limit: 100 }),
  });

  const {
    data: repliesData,
    isLoading: repliesLoading,
    isError: repliesError,
  } = useQuery({
    queryKey: ["replies", postId],
    queryFn: () => getReplies(postId!),
    enabled: !!postId,
  });

  const post = feedData?.posts.find((p) => p.id === postId);

  const editPostMutation = useMutation({
    mutationFn: (content: string) => updatePost(postId!, content),
    onSuccess: () => {
      setEditingPost(false);
      void queryClient.invalidateQueries({ queryKey: ["posts"] });
    },
  });

  const deletePostMutation = useMutation({
    mutationFn: () => deletePost(postId!),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["posts"] });
      navigate("/feed", { replace: true });
    },
  });

  function invalidateReplies() {
    void queryClient.invalidateQueries({ queryKey: ["replies", postId] });
    void queryClient.invalidateQueries({ queryKey: ["posts"] });
  }

  if (feedLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
        <p className="text-gray-500">Post not found.</p>
        <Button variant="outline" onClick={() => navigate("/feed")}>
          Back to feed
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white px-6 py-4 flex items-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate("/feed")}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Feed
        </Button>
        <h1 className="text-xl font-semibold">Thread</h1>
        <div className="ml-auto flex items-center gap-3">
          <NotificationBell />
          <AvatarDropdown />
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8 space-y-4">
        {/* Post */}
        <Card className={post.isUrgent ? "border-red-400" : ""}>
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
                  {CATEGORY_LABELS[post.category] ?? post.category}
                </span>
                {currentUser?.id === post.author.id && !editingPost && !confirmDeletePost && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-gray-400 hover:text-gray-600"
                      onClick={() => { setEditPostContent(post.content); setEditingPost(true); }}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`h-7 w-7 p-0 text-gray-400 hover:text-red-500 ${post.replyCount > 0 ? "opacity-40 cursor-not-allowed" : ""}`}
                      onClick={() => { if (post.replyCount === 0) setConfirmDeletePost(true); }}
                      title={post.replyCount > 0 ? "Cannot delete a post with replies" : "Delete post"}
                      disabled={post.replyCount > 0}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </>
                )}
              </div>
            </div>

            {editingPost ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!editPostContent.trim()) return;
                  editPostMutation.mutate(editPostContent.trim());
                }}
                className="space-y-2"
              >
                <Textarea
                  value={editPostContent}
                  onChange={(e) => setEditPostContent(e.target.value)}
                  rows={4}
                  disabled={editPostMutation.isPending}
                />
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" size="sm" onClick={() => setEditingPost(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" disabled={editPostMutation.isPending || !editPostContent.trim()}>
                    {editPostMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save"}
                  </Button>
                </div>
                {editPostMutation.isError && (
                  <p className="text-xs text-red-600">{editPostMutation.error.message}</p>
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

            {confirmDeletePost && (
              <div className="mt-3 flex items-center gap-3">
                <span className="text-sm text-gray-700">Delete this post?</span>
                <Button variant="outline" size="sm" onClick={() => setConfirmDeletePost(false)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => deletePostMutation.mutate()}
                  disabled={deletePostMutation.isPending}
                >
                  {deletePostMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Delete"}
                </Button>
                {deletePostMutation.isError && (
                  <span className="text-xs text-red-600">{deletePostMutation.error.message}</span>
                )}
              </div>
            )}

            {!editingPost && (
              <div className="flex items-center gap-1 mt-3 text-xs text-gray-500">
                <MessageSquare className="w-3.5 h-3.5" />
                <span>{post.replyCount} {post.replyCount === 1 ? "reply" : "replies"}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Replies */}
        {repliesLoading && (
          <div className="flex justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        )}

        {repliesError && (
          <p className="text-center text-sm text-red-600">Failed to load replies.</p>
        )}

        {repliesData && repliesData.replies.length === 0 && (
          <p className="text-center text-sm text-gray-400 py-4">
            No replies yet. Be the first to help!
          </p>
        )}

        {repliesData && currentUser && repliesData.replies.map((reply) => (
          <ReplyCard
            key={reply.id}
            reply={reply}
            postId={post.id}
            postAuthorId={post.author.id}
            currentUserId={currentUser.id}
            onUpdated={invalidateReplies}
          />
        ))}

        {/* Reply form */}
        <ReplyForm postId={postId!} onSuccess={invalidateReplies} />
      </main>
    </div>
  );
}
