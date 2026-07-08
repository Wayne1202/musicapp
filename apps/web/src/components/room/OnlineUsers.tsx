import { Crown, UserCog, Users } from "lucide-react";
import type { PresenceStateDTO, UserSessionDTO } from "@musicapp/shared";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { avatarColorClass } from "@/lib/avatarColor";

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

const ACTIVITY_LABEL: Record<string, string> = {
  typing_chat: "typing in chat…",
  adding_song: "adding a song…",
  editing_queue: "editing the queue…",
};

interface OnlineUsersProps {
  users: UserSessionDTO[];
  currentSessionId: string | null;
  hostSessionId: string | null;
  presence?: Record<string, PresenceStateDTO>;
  /** Present only when the current user is host — enables the "Make host" action per row. */
  onMakeHost?: (sessionId: string) => void;
}

export function OnlineUsers({ users, currentSessionId, hostSessionId, presence = {}, onMakeHost }: OnlineUsersProps) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-primary" />
        <h3 className="font-semibold">Online users</h3>
        <span className="text-sm text-muted-foreground">({users.length})</span>
      </div>

      <ul className="flex flex-col gap-2.5">
        {users.map((user) => {
          const isHostUser = user.id === hostSessionId;
          const away = presence[user.id]?.status === "away";
          const activity = presence[user.id]?.activity;
          const activityLabel = activity ? ACTIVITY_LABEL[activity] : undefined;

          return (
            <li key={user.id} className="flex items-center gap-3">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className={`${avatarColorClass(user.id)} text-white`}>
                  {initials(user.displayName)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 w-0 flex-1">
                <span className="flex items-center gap-1 truncate text-sm">
                  {isHostUser && <Crown className="h-3.5 w-3.5 shrink-0 text-amber-400" aria-label="Host" />}
                  <span className="truncate">
                    {user.displayName}
                    {user.id === currentSessionId && <span className="text-muted-foreground"> (you)</span>}
                  </span>
                </span>
                {activityLabel && <p className="truncate text-xs text-muted-foreground">{activityLabel}</p>}
                {!activityLabel && away && <p className="text-xs text-muted-foreground">away</p>}
              </div>
              {onMakeHost && !isHostUser && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 shrink-0"
                  title={`Make ${user.displayName} host`}
                  aria-label={`Make ${user.displayName} host`}
                  onClick={() => onMakeHost(user.id)}
                >
                  <UserCog className="h-3.5 w-3.5" />
                </Button>
              )}
              <span
                className={`ml-auto h-2 w-2 shrink-0 rounded-full ${away ? "bg-muted-foreground/50" : "bg-primary"}`}
                title={away ? "Away" : "Online"}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
