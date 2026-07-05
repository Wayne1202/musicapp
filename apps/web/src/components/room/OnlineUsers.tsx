import { Users } from "lucide-react";
import type { UserSessionDTO } from "@musicapp/shared";
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

interface OnlineUsersProps {
  users: UserSessionDTO[];
  currentSessionId: string | null;
  typingUsers?: Record<string, string>;
}

export function OnlineUsers({ users, currentSessionId, typingUsers = {} }: OnlineUsersProps) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-primary" />
        <h3 className="font-semibold">Online users</h3>
        <span className="text-sm text-muted-foreground">({users.length})</span>
      </div>

      <ul className="flex flex-col gap-2.5">
        {users.map((user) => {
          const isTyping = Boolean(typingUsers[user.id]);
          return (
            <li key={user.id} className="flex items-center gap-3">
              <Avatar className="h-8 w-8">
                <AvatarFallback className={`${avatarColorClass(user.id)} text-white`}>
                  {initials(user.displayName)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <span className="truncate text-sm">
                  {user.displayName}
                  {user.id === currentSessionId && <span className="text-muted-foreground"> (you)</span>}
                </span>
                {isTyping && <p className="text-xs text-muted-foreground">adding a song…</p>}
              </div>
              <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-primary" />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
