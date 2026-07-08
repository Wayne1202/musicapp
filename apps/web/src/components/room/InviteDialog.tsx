"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Check, Copy, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function InviteDialog({ roomCode, roomName }: { roomCode: string; roomName: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  // A plain useRef wouldn't work here: DialogContent mounts into a Radix portal, so the canvas
  // node doesn't exist in the DOM yet on the same render pass where `open` flips true — a
  // ref-callback re-renders this component the moment the node actually attaches instead.
  const [canvasEl, setCanvasEl] = useState<HTMLCanvasElement | null>(null);

  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  useEffect(() => {
    if (!open || !canvasEl) return;
    const inviteUrl = `${window.location.origin}/room/${roomCode}`;
    QRCode.toCanvas(canvasEl, inviteUrl, {
      width: 176,
      margin: 1,
      color: { dark: "#09090b", light: "#ffffff" },
    }).catch(() => {});
  }, [open, roomCode, canvasEl]);

  const copyLink = async () => {
    await navigator.clipboard.writeText(`${window.location.origin}/room/${roomCode}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const share = () => {
    navigator
      .share({
        title: `Join "${roomName}"`,
        text: `Join my music room "${roomName}" — code ${roomCode}`,
        url: `${window.location.origin}/room/${roomCode}`,
      })
      .catch(() => {});
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Copy className="mr-1.5 h-3.5 w-3.5" />
          Invite
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Invite friends to &quot;{roomName}&quot;</DialogTitle>
          <DialogDescription>Share the code, link, or QR code below.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-3">
          <Badge variant="secondary" className="px-4 py-1.5 font-mono text-lg tracking-[0.3em]">
            {roomCode}
          </Badge>
          <canvas ref={setCanvasEl} className="rounded-md bg-white p-2" />
        </div>

        <div className="flex flex-col gap-2">
          <Button variant="outline" onClick={copyLink}>
            {copied ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
            {copied ? "Link copied" : "Copy invite link"}
          </Button>
          {canShare && (
            <Button variant="outline" onClick={share}>
              <Share2 className="mr-1.5 h-3.5 w-3.5" />
              Share
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
