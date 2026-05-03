import type { Ad } from "@/api/ads";
import { Card, CardContent } from "@/components/ui/card";
import { ExternalLink } from "lucide-react";

interface AdCardProps {
  ad: Ad;
}

export function AdCard({ ad }: AdCardProps) {
  return (
    <a
      href={ad.linkUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block no-underline"
    >
      <Card className="border-amber-200 bg-amber-50/40 hover:shadow-md transition-shadow cursor-pointer">
        <CardContent className="pt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-amber-600 uppercase tracking-wide">
              Sponsored
            </span>
            <span className="text-xs text-gray-500">{ad.advertiserName}</span>
          </div>

          {ad.imageUrl && (
            <img
              src={ad.imageUrl}
              alt={ad.title}
              className="w-full h-32 object-cover rounded-md mb-3"
            />
          )}

          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-gray-900">{ad.title}</p>
              <p className="text-sm text-gray-600 mt-0.5">{ad.body}</p>
            </div>
            <ExternalLink className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          </div>
        </CardContent>
      </Card>
    </a>
  );
}
