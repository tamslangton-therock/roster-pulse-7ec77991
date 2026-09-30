import { Link } from "@tanstack/react-router";
import { ShieldOff } from "lucide-react";

export function AccessNotice({
  title = "No access to this page",
  message,
}: {
  title?: string;
  message?: string;
}) {
  return (
    <div className="p-6">
      <div className="rounded-xl border bg-card p-8 text-center max-w-md mx-auto mt-16">
        <ShieldOff className="h-8 w-8 mx-auto text-muted-foreground" />
        <h1 className="mt-3 text-lg font-semibold">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {message ??
            "Your login doesn't include this section. Ask the admin to switch it on for you."}
        </p>
        <Link
          to="/"
          className="mt-4 inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
