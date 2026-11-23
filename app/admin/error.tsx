"use client";

import { useEffect } from "react";
import { AlertTriangleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Shown in place of an admin page when rendering throws. Reset retries the segment. */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <Card className="w-full max-w-md text-center">
        <CardHeader className="justify-items-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-status-danger-bg text-status-danger">
            <AlertTriangleIcon className="size-6" />
          </div>
          <CardTitle className="mt-2 text-lg">
            <h1>Something went wrong</h1>
          </CardTitle>
          <CardDescription>This page couldn&apos;t be loaded. Try again.</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Button type="button" onClick={() => reset()}>
            Try again
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
