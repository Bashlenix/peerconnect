import { useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { verifyEmail } from "@/api/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["verify-email", token],
    queryFn: () => verifyEmail(token),
    enabled: token.length > 0,
    retry: false,
  });

  useEffect(() => {
    if (!token) return;
  }, [token]);

  if (!token) {
    return (
      <VerifyCard
        icon="⚠️"
        title="Invalid link"
        description="The verification link is missing a token. Please use the link from your email."
        action={<Button asChild className="w-full"><Link to="/register">Register again</Link></Button>}
      />
    );
  }

  if (isLoading) {
    return (
      <VerifyCard icon="⏳" title="Verifying…" description="Please wait while we verify your email address." />
    );
  }

  if (isError) {
    return (
      <VerifyCard
        icon="❌"
        title="Verification failed"
        description={(error as Error).message}
        action={
          <Button asChild className="w-full">
            <Link to="/register">Register again</Link>
          </Button>
        }
      />
    );
  }

  return (
    <VerifyCard
      icon="✅"
      title="Email verified!"
      description={data?.message ?? "Your account is now active."}
      action={
        <Button asChild className="w-full">
          <Link to="/login">Sign in</Link>
        </Button>
      }
    />
  );
}

function VerifyCard({
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
