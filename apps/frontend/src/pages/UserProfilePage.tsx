import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, MessageSquare, CheckCircle } from "lucide-react";
import { getPublicProfile } from "@/api/users";
import { Card, CardContent } from "@/components/ui/card";

export default function UserProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

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
      </div>
    </div>
  );
}
