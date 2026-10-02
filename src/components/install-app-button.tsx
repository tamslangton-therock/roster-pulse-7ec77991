import { useEffect, useState } from "react";
import { Download, Share, SquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallAppButton() {
  const [ready, setReady] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [deferred, setDeferred] = useState<InstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setInstalled(standalone);
    setIsIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    setReady(true);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as InstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!ready || installed) return null;

  const onClick = async () => {
    if (deferred) {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
      setDeferred(null);
      return;
    }
    setShowHelp(true);
  };

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
        <div className="min-w-0">
          <div className="font-medium">Get The Rock Church app</div>
          <p className="text-sm text-muted-foreground">Add it to your phone’s home screen for one-tap access.</p>
        </div>
        <Button size="lg" onClick={onClick}>
          <Download />
          Install App
        </Button>
      </div>
      <Dialog open={showHelp} onOpenChange={setShowHelp}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-md">
          <DialogHeader>
            <DialogTitle>Add to your home screen</DialogTitle>
            <DialogDescription>Two quick steps:</DialogDescription>
          </DialogHeader>
          {isIos ? (
            <ol className="space-y-4 text-sm">
              <li className="flex items-start gap-3">
                <Share className="mt-0.5 h-6 w-6 shrink-0 text-primary" />
                <span>Tap the <b>Share</b> button at the bottom of Safari (a square with an arrow pointing up).</span>
              </li>
              <li className="flex items-start gap-3">
                <SquarePlus className="mt-0.5 h-6 w-6 shrink-0 text-primary" />
                <span>Scroll down and tap <b>Add to Home Screen</b>, then tap <b>Add</b>.</span>
              </li>
            </ol>
          ) : (
            <ol className="space-y-4 text-sm">
              <li>1. Tap the <b>⋮ menu</b> at the top-right of your browser.</li>
              <li>2. Tap <b>Install app</b> or <b>Add to Home screen</b>, then confirm.</li>
            </ol>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
