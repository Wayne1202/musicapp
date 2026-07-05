import { Users } from "lucide-react";
import type { UserSessionDTO } from "@musicapp/shared";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function OnlineUsers({ users, currentSessionId }: { users: UserSessionDTO[]; currentSessionId: string | null }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-primary" />
        <h3 className="font-semibold">Online users</h3>
        <span className="text-sm text-muted-foreground">({users.length})</span>
      </div>

      <ul className="flex flex-col gap-2">
        {users.map((user) => (
          <li key={user.id} className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback>{initials(user.displayName)}</AvatarFallback>
            </Avatar>
            <span className="truncate text-sm">
              {user.displayName}
              {user.id === currentSessionId && <span className="text-muted-foreground"> (you)</span>}
            </span>
            <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-primary" />
          </li>
        ))}
      </ul>
    </div>
  );
}
