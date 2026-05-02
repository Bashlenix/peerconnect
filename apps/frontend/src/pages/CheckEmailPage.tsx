import { useLocation, Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function CheckEmailPage() {
  const location = useLocation();
  const email = (location.state as { email?: string } | null)?.email;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-4xl">
            ✉️
          </div>
          <CardTitle className="text-2xl">Check your email</CardTitle>
          <CardDescription>
            {email ? (
              <>
                We sent a verification link to <span className="font-medium text-gray-900">{email}</span>.
              </>
            ) : (
              "We sent a verification link to your email address."
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-500">
            Click the link in the email to activate your account. The link expires in 24 hours.
          </p>
          <p className="text-sm text-gray-500">
            Didn&apos;t receive it? Check your spam folder.
          </p>
          <Button variant="outline" asChild className="w-full">
            <Link to="/register">Back to sign up</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
