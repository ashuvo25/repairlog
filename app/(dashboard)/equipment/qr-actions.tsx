"use client";

import { buttonClasses, Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { PrinterIcon } from "@/components/ui/icons";

export function QrActions({
  reportUrl,
  qrDataUrl,
  fileName,
}: Readonly<{ reportUrl: string; qrDataUrl: string; fileName: string }>) {
  return (
    <div className="qr-screen-actions mt-5 space-y-2">
      <Button fullWidth onClick={() => window.print()}>
        <PrinterIcon />
        Print QR label
      </Button>
      <div className="grid gap-2 sm:grid-cols-2">
        <a
          href={qrDataUrl}
          download={fileName}
          className={buttonClasses({ variant: "secondary" })}
        >
          Download PNG
        </a>
        <CopyButton value={reportUrl} label="Copy link" />
      </div>
    </div>
  );
}
