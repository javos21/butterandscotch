import Image from "next/image";
import { AlertCircleIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
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
          <Image
            src="/brand/logo-red-wide.png"
            alt="Butter and Scotch"
            width={471}
            height={238}
            className="h-12 w-auto"
            priority
          />
          <h1 className="sr-only">Sign in</h1>
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
        <CardFooter className="justify-center">
          <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            Powered by
            <Image src="/brand/chaconia-labs.png" alt="Chaconia Labs" width={360} height={98} className="h-6 w-auto" />
          </p>
        </CardFooter>
      </Card>
    </main>
  );
}
