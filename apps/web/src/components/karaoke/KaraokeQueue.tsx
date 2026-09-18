import { X } from "lucide-react";
import type { KaraokeQueueItemDTO } from "@musicapp/shared";
import { Button } from "@/components/ui/button";

interface KaraokeQueueProps {
  queue: KaraokeQueueItemDTO[];
  /** Present only for the singer — enables per-item remove. Omit for the listener's read-only view. */
  onRemove?: (itemId: string) => void;
  removingId?: string | null;
}

/** The singer's "up next" list — shown singer-editable in SingerControls and read-only to
 *  listeners so everyone can see what's coming. */
export function KaraokeQueue({ queue, onRemove, removingId }: KaraokeQueueProps) {
  if (queue.length === 0) {
    return <p className="text-sm text-muted-foreground">Nothing queued yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {queue.map((item, index) => (
        <li key={item.id} className="flex items-center gap-2 text-sm">
          <span className="w-4 shrink-0 text-xs text-muted-foreground">{index + 1}</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.thumbnail} alt="" className="h-8 w-8 shrink-0 rounded object-cover" />
          <span className="min-w-0 flex-1 truncate">{item.title}</span>
          {onRemove && (
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 shrink-0"
              disabled={removingId === item.id}
              onClick={() => onRemove(item.id)}
              aria-label={`Remove ${item.title} from the queue`}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}
