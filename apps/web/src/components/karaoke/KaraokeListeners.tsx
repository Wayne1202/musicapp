import { Users } from "lucide-react";
import type { KaraokeMemberDTO } from "@musicapp/shared";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { avatarColorClass } from "@/lib/avatarColor";

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

/**
 * Who's listening — same avatar/initials treatment as the listening room's OnlineUsers, so a
 * singer/listener can actually see who's in the room instead of just a headcount. Deliberately
 * no action button yet (e.g. a future "tip the singer") — just making listener identity visible
 * is the whole scope of this pass; see the memory note on holding monetization until asked.
 */
export function KaraokeListeners({ members }: { members: KaraokeMemberDTO[] }) {
  const listeners = members.filter((m) => m.role === "LISTENER");

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-primary" />
        <h3 className="font-semibold">Listeners</h3>
        <span className="text-sm text-muted-foreground">({listeners.length})</span>
      </div>

      {listeners.length === 0 ? (
        <p className="text-sm text-muted-foreground">No one's listening yet — share the room code.</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {listeners.map((listener) => (
            <li key={listener.id} className="flex items-center gap-3">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className={`${avatarColorClass(listener.id)} text-white`}>
                  {initials(listener.displayName)}
                </AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1 truncate text-sm">{listener.displayName}</span>
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${listener.isOnline ? "bg-primary" : "bg-muted-foreground/50"}`}
                title={listener.isOnline ? "Online" : "Offline"}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
