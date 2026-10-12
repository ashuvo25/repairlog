"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function Error({
  error,
  retry,
}: Readonly<{
  error: Error & { digest?: string };
  retry: () => void;
}>) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center px-5 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">
        Something went wrong
      </h1>
      <p className="mt-3 leading-7 text-muted">
        We could not load this page. Your data has not been changed. Please try
        again.
      </p>
      {error.digest ? (
        <p className="mt-3 font-mono text-xs text-muted">
          Reference: {error.digest}
        </p>
      ) : null}
      <div className="mt-8">
        <Button onClick={() => retry()}>Try again</Button>
      </div>
    </main>
  );
}
