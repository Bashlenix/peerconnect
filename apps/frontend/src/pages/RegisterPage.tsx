import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { register, authErrorMessage } from "@/api/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function RegisterPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [studyProgramme, setStudyProgramme] = useState("");
  const [semester, setSemester] = useState("");
  const [languagesRaw, setLanguagesRaw] = useState("");

  const mutation = useMutation({
    mutationFn: () => {
      const languages = languagesRaw
        .split(",")
        .map((l) => l.trim())
        .filter(Boolean);

      return register({
        email,
        password,
        firstName,
        lastName,
        studyProgramme: studyProgramme || undefined,
        semester: semester ? parseInt(semester, 10) : undefined,
        languages: languages.length > 0 ? languages : undefined,
      });
    },
    onSuccess: () => {
      navigate("/check-email", { state: { email } });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    mutation.mutate();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Create your account</CardTitle>
          <CardDescription>
            Use your university email to get started with PeerConnect.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="firstName">First name</Label>
                <Input
                  id="firstName"
                  placeholder="Your first name"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  disabled={mutation.isPending}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastName">Last name</Label>
                <Input
                  id="lastName"
                  placeholder="Your last name"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  disabled={mutation.isPending}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">University email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@university.de"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={mutation.isPending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="At least 8 characters"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={mutation.isPending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="studyProgramme">Study programme (optional)</Label>
              <Input
                id="studyProgramme"
                value={studyProgramme}
                onChange={(e) => setStudyProgramme(e.target.value)}
                placeholder="e.g. Computer Science"
                disabled={mutation.isPending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="semester">Semester (optional)</Label>
              <Input
                id="semester"
                type="number"
                min={1}
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                placeholder="e.g. 3"
                disabled={mutation.isPending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="languages">Languages (optional, comma-separated)</Label>
              <Input
                id="languages"
                value={languagesRaw}
                onChange={(e) => setLanguagesRaw(e.target.value)}
                placeholder="e.g. English, German"
                disabled={mutation.isPending}
              />
            </div>
            {mutation.isError && (
              <p className="text-sm text-red-600">{authErrorMessage(mutation.error)}</p>
            )}
            <Button type="submit" className="w-full" disabled={mutation.isPending}>
              {mutation.isPending ? "Creating account…" : "Create account"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-gray-500">
            Already have an account?{" "}
            <Link to="/login" className="text-blue-600 hover:underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
