import { AlertCircleIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "Email or password is incorrect",
  "not-staff": "This account does not have staff access",
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const { error } = await searchParams;
  const message = typeof error === "string" ? ERROR_MESSAGES[error] : undefined;

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted px-4 py-12">
      <Card className="w-full max-w-sm">
        <CardHeader className="justify-items-center text-center">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary font-semibold text-primary-foreground">
            B
          </div>
          <CardTitle className="mt-2 text-xl">
            <h1>Sign in</h1>
          </CardTitle>
          <CardDescription>Butter &amp; Scotch admin</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={signIn} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </div>

            {message ? (
              <Alert variant="destructive" role="alert">
                <AlertCircleIcon />
                <AlertDescription>{message}</AlertDescription>
              </Alert>
            ) : null}

            <Button type="submit" size="lg" className="w-full">
              Sign in
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
