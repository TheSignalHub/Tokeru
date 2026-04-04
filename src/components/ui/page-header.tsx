import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export function PageHeader({ title, description, backHref, backLabel }: {
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="py-4 mb-4">
      <div className="flex items-center gap-1">
        {backHref && (
          <Link href={backHref} className="inline-flex items-center gap-0.5 text-xs text-muted hover:text-foreground transition-colors shrink-0">
            <ChevronLeft className="h-3.5 w-3.5" />
            <span>{backLabel || "Back"}</span>
          </Link>
        )}
        {backHref && <span className="text-border mx-1.5">|</span>}
        <h1 className="text-xl font-bold">{title}</h1>
      </div>
      {description && <p className="text-sm text-muted mt-1">{description}</p>}
    </div>
  );
}
