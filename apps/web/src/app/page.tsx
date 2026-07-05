import { Music2 } from "lucide-react";
import { CreateRoomForm } from "@/components/home/CreateRoomForm";
import { JoinRoomForm } from "@/components/home/JoinRoomForm";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-16">
      <div className="mb-10 flex flex-col items-center gap-3 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
          <Music2 className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Listen together</h1>
        <p className="max-w-md text-muted-foreground">
          Queue YouTube songs, stay in sync with friends, and keep the music playing while you browse or game.
        </p>
      </div>

      <div className="grid w-full max-w-3xl gap-6 sm:grid-cols-2">
        <CreateRoomForm />
        <JoinRoomForm />
      </div>
    </main>
  );
}
