import { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { validateResetToken, resetPassword, authErrorMessage } from "@/api/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [matchError, setMatchError] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["reset-password-validate", token],
    queryFn: () => validateResetToken(token),
    enabled: token.length > 0,
    retry: false,
  });

  const mutation = useMutation({
    mutationFn: () => resetPassword(token, newPassword),
  });

  useEffect(() => {
    if (!mutation.isSuccess) return;
    const timer = setTimeout(() => navigate("/login", { replace: true }), 2000);
    return () => clearTimeout(timer);
  }, [mutation.isSuccess, navigate]);

  if (!token) {
    return (
      <ResetCard
        icon="⚠️"
        title="Invalid link"
        description="This link is missing a token. Please use the link from your email."
        action={<Button asChild className="w-full"><Link to="/forgot-password">Request a new link</Link></Button>}
      />
    );
  }

  if (isLoading) {
    return <ResetCard icon="⏳" title="Checking your link…" description="Please wait a moment." />;
  }

  if (isError || !data?.valid) {
    return (
      <ResetCard
        icon="❌"
        title="Link expired"
        description="This password reset link is invalid or has expired."
        action={<Button asChild className="w-full"><Link to="/forgot-password">Request a new link</Link></Button>}
      />
    );
  }

  if (mutation.isSuccess) {
    return (
      <ResetCard
        icon="✅"
        title="Password reset!"
        description="Your password has been updated. Redirecting you to sign in…"
        action={<Button asChild className="w-full"><Link to="/login">Sign in now</Link></Button>}
      />
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setMatchError(true);
      return;
    }
    setMatchError(false);
    mutation.mutate();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Choose a new password</CardTitle>
          <CardDescription>Enter a new password for your account.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="newPassword">New password</Label>
              <Input
                id="newPassword"
                type="password"
                placeholder="At least 8 characters"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={mutation.isPending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">Confirm new password</Label>
              <Input
                id="confirmPassword"
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={mutation.isPending}
              />
            </div>
            {matchError && <p className="text-sm text-red-600">Passwords don&apos;t match.</p>}
            {mutation.isError && (
              <p className="text-sm text-red-600">{authErrorMessage(mutation.error)}</p>
            )}
            <Button type="submit" className="w-full" disabled={mutation.isPending}>
              {mutation.isPending ? "Resetting…" : "Reset password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function ResetCard({
  icon,
  title,
  description,
  action,
}: {
  icon: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-4xl">
            {icon}
          </div>
          <CardTitle className="text-2xl">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        {action && <CardContent>{action}</CardContent>}
      </Card>
    </div>
  );
}
