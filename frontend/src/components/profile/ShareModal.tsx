import { useState } from "react";
import { toast } from "sonner";
import { Check, Copy, Share2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ShareModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  username: string;
  name: string;
}

export function ShareModal({ open, onOpenChange, username, name }: ShareModalProps) {
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}/u/${username}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Profile link copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy — long-press the link instead");
    }
  };

  const nativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: `${name} on AURA`, url });
      } catch {
        // user dismissed the share sheet
      }
    } else {
      void copy();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm" data-testid="share-modal">
        <DialogHeader>
          <DialogTitle className="font-heading">Share {name}'s profile</DialogTitle>
          <DialogDescription>Send it, post it, or scan the code.</DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2">
          <Input readOnly value={url} aria-label="Profile URL" data-testid="share-url-input" />
          <Button
            size="icon"
            variant="secondary"
            onClick={() => void copy()}
            aria-label="Copy profile link"
            data-testid="share-copy-button"
          >
            {copied ? <Check className="size-4 text-emerald-500" /> : <Copy className="size-4" />}
          </Button>
        </div>
        <div className="flex flex-col items-center gap-3 py-2">
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(url)}`}
            alt={`QR code for ${username}'s profile`}
            width={180}
            height={180}
            className="rounded-xl border bg-white p-2"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
            data-testid="share-qr-image"
          />
          <Button
            variant="outline"
            className="w-full"
            onClick={() => void nativeShare()}
            data-testid="share-native-button"
          >
            <Share2 className="size-4" /> Share via device
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
