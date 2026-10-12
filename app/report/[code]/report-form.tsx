"use client";

import Script from "next/script";
import { useActionState, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { CheckIcon } from "@/components/ui/icons";
import { compressPhoto } from "@/lib/client/compress-photo";

import { submitPublicReport, type SubmitReportState } from "./actions";

const initialState: SubmitReportState = {};
const MAX_LENGTH = 2000;
const MAX_PHOTOS = 2;

type PhotoStatus = "sending" | "sent" | "failed";

async function uploadPhoto(
  reportId: string,
  uploadToken: string,
  slot: number,
  file: File,
) {
  const body = new FormData();
  body.set("reportId", reportId);
  body.set("uploadToken", uploadToken);
  body.set("slot", String(slot));
  body.set("photo", await compressPhoto(file), `photo-${slot}.jpg`);

  const response = await fetch("/api/public-reports/photos", {
    method: "POST",
    body,
  });

  return response.ok;
}

export function ReportForm({
  code,
  turnstileSiteKey,
}: Readonly<{ code: string; turnstileSiteKey: string | null }>) {
  const [requestId] = useState(() => crypto.randomUUID());
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoStatus, setPhotoStatus] = useState<PhotoStatus[]>([]);
  const [state, action, pending] = useActionState(
    submitPublicReport,
    initialState,
  );
  const uploadStarted = useRef(false);
  const report = state.report;

  // The text report is already saved when this runs; photos follow it and a
  // failed photo never undoes the report.
  useEffect(() => {
    if (!report || uploadStarted.current || photos.length === 0) {
      return;
    }

    uploadStarted.current = true;

    void (async () => {
      setPhotoStatus(photos.map(() => "sending"));

      for (const [index, file] of photos.entries()) {
        const ok = await uploadPhoto(report.id, report.uploadToken, index + 1, file)
          .catch(() => false);

        setPhotoStatus((current) =>
          current.map((status, i) => (i === index ? (ok ? "sent" : "failed") : status)),
        );
      }
    })();
  }, [report, photos]);

  if (report) {
    const sending =
      photos.length > 0 &&
      (photoStatus.length === 0 || photoStatus.includes("sending"));
    const failed = photoStatus.filter((status) => status === "failed").length;

    return (
      <div role="status" className="mt-6">
        <span className="flex size-12 items-center justify-center rounded-full bg-primary text-white">
          <CheckIcon className="size-6" />
        </span>
        <h2 className="mt-4 text-2xl font-semibold tracking-tight">
          Report sent
        </h2>
        <p className="mt-2 leading-7 text-muted">
          Thank you. The café owner has been given your report and will review
          it.
        </p>
        {photos.length > 0 ? (
          <p className="mt-3 text-sm leading-6 text-muted">
            {sending
              ? "Sending your photos… please keep this page open."
              : failed === 0
                ? `${photos.length === 1 ? "Your photo was" : "Your photos were"} attached.`
                : `Your description was sent, but ${failed === 1 ? "a photo" : "the photos"} could not be attached.`}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <form action={action} className="mt-6 space-y-5">
      <input type="hidden" name="code" value={code} />
      <input type="hidden" name="requestId" value={requestId} />
      {/* Honeypot: hidden from people, tempting to simple bots. */}
      <div aria-hidden="true" className="absolute -left-[9999px] size-px overflow-hidden">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <label className="block">
        <span className="text-sm font-semibold">What is wrong?</span>
        <textarea
          name="description"
          required
          rows={5}
          maxLength={MAX_LENGTH}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="For example: no steam from the left wand, and water is leaking underneath."
          className={`${inputClasses} resize-y py-3 leading-6`}
        />
        <span className="mt-1.5 block text-right text-xs tabular-nums text-muted">
          {description.length} / {MAX_LENGTH}
        </span>
      </label>

      <div>
        <label className="block">
          <span className="text-sm font-semibold">
            Photos <span className="font-normal text-muted">(optional, up to {MAX_PHOTOS})</span>
          </span>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(event) =>
              setPhotos(Array.from(event.target.files ?? []).slice(0, MAX_PHOTOS))
            }
            className="mt-2 block w-full text-sm text-muted file:mr-3 file:min-h-11 file:cursor-pointer file:rounded-lg file:border file:border-solid file:border-border file:bg-white file:px-4 file:text-sm file:font-semibold file:text-foreground"
          />
        </label>
        {photos.length > 0 ? (
          <p className="mt-2 text-sm text-muted">
            {photos.length === 1 ? "1 photo" : `${photos.length} photos`} ready
            to send.
          </p>
        ) : null}
      </div>

      {turnstileSiteKey ? (
        <>
          <Script
            src="https://challenges.cloudflare.com/turnstile/v0/api.js"
            strategy="afterInteractive"
          />
          <div className="cf-turnstile" data-sitekey={turnstileSiteKey} />
        </>
      ) : null}

      {state.error ? <FormMessage tone="error">{state.error}</FormMessage> : null}

      <Button type="submit" size="lg" fullWidth disabled={pending}>
        {pending ? "Sending…" : "Send report"}
      </Button>
      <p className="text-center text-xs leading-5 text-muted">
        No account needed. Your report goes privately to the café owner.
      </p>
    </form>
  );
}
