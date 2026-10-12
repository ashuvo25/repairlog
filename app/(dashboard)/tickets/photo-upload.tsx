"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { FormMessage } from "@/components/ui/form-message";
import { compressPhoto } from "@/lib/client/compress-photo";

export function TicketPhotoUpload({
  ticketId,
  remaining,
}: Readonly<{ ticketId: string; remaining: number }>) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(files: FileList | null) {
    const selected = Array.from(files ?? []).slice(0, remaining);
    if (!selected.length) {
      return;
    }

    setBusy(true);
    setError(null);

    for (const file of selected) {
      const body = new FormData();
      body.set("ticketId", ticketId);
      body.set("photo", await compressPhoto(file), "photo.jpg");

      const response = await fetch("/api/tickets/photos", { method: "POST", body }).catch(
        () => null,
      );

      if (!response?.ok) {
        const message = await response
          ?.json()
          .then((result: { message?: string }) => result.message)
          .catch(() => undefined);
        setError(message ?? "The photo could not be added. Please try again.");
        break;
      }
    }

    setBusy(false);
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <label className="inline-flex min-h-11 cursor-pointer items-center rounded-lg border border-border bg-white px-4 text-sm font-semibold hover:border-border-strong hover:bg-subtle has-[:disabled]:cursor-wait has-[:disabled]:opacity-60">
        {busy ? "Adding photo…" : remaining === 2 ? "Add photos" : "Add a photo"}
        <input
          type="file"
          accept="image/*"
          multiple={remaining > 1}
          disabled={busy}
          onChange={(event) => {
            void upload(event.target.files);
            event.target.value = "";
          }}
          className="sr-only"
        />
      </label>
      <p className="text-xs text-muted">Up to {remaining} more.</p>
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
    </div>
  );
}
