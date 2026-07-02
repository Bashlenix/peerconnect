import { Link } from "react-router-dom";
import {
  MessageSquare,
  Footprints,
  Users,
  Zap,
  ThumbsUp,
  CheckCircle,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { BADGE_METADATA } from "@peerconnect/shared";
import type { PostAuthor } from "@/api/posts";

const BADGE_ICONS: Record<string, LucideIcon> = {
  MessageSquare,
  Footprints,
  Users,
  Zap,
  ThumbsUp,
  CheckCircle,
  ShieldCheck,
};

function authorName(author: PostAuthor | null): string {
  if (!author) return "Deleted User";
  if (author.firstName && author.lastName) return `${author.firstName} ${author.lastName}`;
  if (author.firstName) return author.firstName;
  return "Anonymous";
}

interface AuthorLineProps {
  author: PostAuthor | null;
  nameClassName?: string;
}

export function AuthorLine({ author, nameClassName }: AuthorLineProps) {
  const name = authorName(author);

  if (!author) {
    return <span className={nameClassName}>{name}</span>;
  }

  const badge = author.topBadgeName ? BADGE_METADATA[author.topBadgeName] : undefined;
  const Icon = badge ? BADGE_ICONS[badge.icon] : undefined;

  return (
    <span className="inline-flex items-center gap-1">
      <Link to={`/users/${author.id}`} className={`hover:underline ${nameClassName ?? ""}`}>
        {name}
      </Link>
      {badge && Icon && (
        <Link
          to={`/users/${author.id}`}
          title={`${author.topBadgeName} — ${badge.description}`}
          className="text-yellow-600 hover:text-yellow-700"
        >
          <Icon className="w-3.5 h-3.5" />
        </Link>
      )}
    </span>
  );
}
