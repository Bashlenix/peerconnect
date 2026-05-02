import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { updateProfile, getPublicProfile, type UpdateProfileInput } from "@/api/users";
import { useAuthStore } from "@/store/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

export default function ProfilePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [studyProgramme, setStudyProgramme] = useState("");
  const [semester, setSemester] = useState("");
  const [languagesRaw, setLanguagesRaw] = useState("");
  const [saved, setSaved] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => getPublicProfile(user!.id),
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (!profile) return;
    setFirstName(profile.firstName ?? "");
    setLastName(profile.lastName ?? "");
    setStudyProgramme(profile.studyProgramme ?? "");
    setSemester(profile.semester != null ? String(profile.semester) : "");
    setLanguagesRaw(profile.languages.join(", "));
  }, [profile]);

  const mutation = useMutation({
    mutationFn: (input: UpdateProfileInput) => updateProfile(input),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["publicProfile", user?.id] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      // Keep form state in sync
      setFirstName(updated.firstName ?? "");
      setLastName(updated.lastName ?? "");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const input: UpdateProfileInput = {};
    if (firstName !== (profile?.firstName ?? "")) input.firstName = firstName || undefined;
    if (lastName !== (profile?.lastName ?? "")) input.lastName = lastName || undefined;
    if (studyProgramme !== (profile?.studyProgramme ?? ""))
      input.studyProgramme = studyProgramme || undefined;

    const semesterNum = semester ? parseInt(semester, 10) : undefined;
    if (semesterNum !== profile?.semester) input.semester = semesterNum;

    const langs = languagesRaw
      .split(",")
      .map((l) => l.trim())
      .filter(Boolean);
    if (JSON.stringify(langs) !== JSON.stringify(profile?.languages)) input.languages = langs;

    mutation.mutate(input);
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <button
          onClick={() => navigate("/feed")}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to feed
        </button>

        <h1 className="text-2xl font-bold text-gray-900 mb-6">My Profile</h1>

        <Card>
          <CardContent className="pt-6">
            <div className="mb-4 text-sm text-gray-500">
              <span className="font-medium text-gray-700">Email:</span> {user?.email}
              <span className="ml-2 text-xs">(not editable)</span>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="firstName">First name</Label>
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Your first name"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="lastName">Last name</Label>
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Your last name"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="studyProgramme">Study programme</Label>
                <Input
                  id="studyProgramme"
                  value={studyProgramme}
                  onChange={(e) => setStudyProgramme(e.target.value)}
                  placeholder="e.g. Computer Science"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="semester">Semester</Label>
                <Input
                  id="semester"
                  type="number"
                  min={1}
                  value={semester}
                  onChange={(e) => setSemester(e.target.value)}
                  placeholder="e.g. 3"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="languages">Languages (comma-separated)</Label>
                <Input
                  id="languages"
                  value={languagesRaw}
                  onChange={(e) => setLanguagesRaw(e.target.value)}
                  placeholder="e.g. English, German"
                />
              </div>

              {mutation.error && (
                <p className="text-sm text-red-600">{(mutation.error as Error).message}</p>
              )}

              <Button type="submit" disabled={mutation.isPending} className="w-full">
                {mutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {saved ? "Saved!" : "Save changes"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {profile && profile.badges.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold text-gray-800 mb-3">Badges</h2>
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
          </div>
        )}
      </div>
    </div>
  );
}
