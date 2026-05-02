import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type Notification,
  type NotificationType,
} from "@/api/notifications";
import { Button } from "@/components/ui/button";

const TYPE_LABELS: Record<NotificationType, string> = {
  NEW_POST_IN_CATEGORY: "New post in subscribed category",
  REPLY_TO_POST: "Someone replied to your post",
  REPLY_UPVOTED: "Your reply was upvoted",
  REPLY_MARKED_SOLUTION: "Your reply was marked as a solution",
  BADGE_AWARDED: "You earned a badge",
};

function formatTimeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

interface NotificationItemProps {
  notification: Notification;
  onRead: () => void;
}

function NotificationItem({ notification, onRead }: NotificationItemProps) {
  const navigate = useNavigate();

  function handleClick() {
    if (!notification.isRead) {
      markNotificationRead(notification.id).then(onRead).catch(() => {});
    }
    if (notification.postId) navigate(`/posts/${notification.postId}`);
  }

  return (
    <button
      type="button"
      className={`w-full text-left px-4 py-3 border-b last:border-b-0 hover:bg-gray-50 transition-colors ${
        notification.isRead ? "opacity-60" : "bg-blue-50/40"
      }`}
      onClick={handleClick}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-gray-800 leading-snug">
          {TYPE_LABELS[notification.type] ?? notification.type}
        </p>
        {!notification.isRead && (
          <span className="mt-0.5 flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full" />
        )}
      </div>
      <p className="text-xs text-gray-400 mt-0.5">{formatTimeAgo(notification.createdAt)}</p>
    </button>
  );
}

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => getNotifications({ limit: 20 }),
  });

  // SSE connection — invalidate queries on notification and badge events
  useEffect(() => {
    const es = new EventSource("/api/notifications/stream", { withCredentials: true });
    es.addEventListener("notification", () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    });
    es.addEventListener("badge_awarded", () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
      void queryClient.invalidateQueries({ queryKey: ["publicProfile"] });
    });
    es.onerror = () => es.close();
    return () => es.close();
  }, [queryClient]);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    function handleOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [isOpen]);

  const unreadCount = data?.unreadCount ?? 0;
  const notifications = data?.notifications ?? [];

  function handleMarkAllRead() {
    markAllNotificationsRead()
      .then(() => queryClient.invalidateQueries({ queryKey: ["notifications"] }))
      .catch(() => {});
  }

  function handleRead() {
    void queryClient.invalidateQueries({ queryKey: ["notifications"] });
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="ghost"
        size="sm"
        className="relative p-2"
        onClick={() => setIsOpen((v) => !v)}
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[1.1rem] h-[1.1rem] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-80 bg-white rounded-lg border shadow-lg z-50">
          <div className="flex items-center justify-between px-4 py-2.5 border-b">
            <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-6 text-blue-600 hover:text-blue-800"
                onClick={handleMarkAllRead}
              >
                Mark all read
              </Button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No notifications yet</p>
            ) : (
              notifications.map((n) => (
                <NotificationItem key={n.id} notification={n} onRead={handleRead} />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
