import Link from "next/link";
import { ArrowRight, Mic2, Music2 } from "lucide-react";
import { CreateRoomForm } from "@/components/home/CreateRoomForm";
import { JoinRoomForm } from "@/components/home/JoinRoomForm";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-16">
      <div className="mb-10 flex flex-col items-center gap-4 text-center">
        <div className="relative flex h-20 w-20 items-center justify-center">
          {/* A soft glow ring behind the icon badge instead of a flat tinted square — the icon
              reads as the source of light, not just decoration. */}
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/30 to-primary/0 blur-xl" />
          <div className="relative flex h-16 w-16 items-center justify-center rounded-3xl border border-primary/20 bg-gradient-to-b from-primary/20 to-primary/5 shadow-lg shadow-primary/10">
            <Music2 className="h-8 w-8 text-primary" />
          </div>
        </div>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Listen <span className="bg-gradient-to-r from-primary to-emerald-300 bg-clip-text text-transparent">together</span>
        </h1>
        <p className="max-w-md text-muted-foreground">
          Queue YouTube songs, stay in sync with friends, and keep the music playing while you browse or game.
        </p>
      </div>

      <div className="grid w-full max-w-3xl gap-6 sm:grid-cols-2">
        <CreateRoomForm />
        <JoinRoomForm />
      </div>

      <Link
        href="/karaoke"
        className="group mt-8 flex items-center gap-2 rounded-full border border-white/10 bg-gradient-to-b from-card to-card/60 px-5 py-2.5 text-sm font-medium text-muted-foreground shadow-md shadow-black/20 transition-all hover:border-primary/30 hover:text-foreground hover:shadow-lg"
      >
        <Mic2 className="h-4 w-4 text-primary" />
        Try Karaoke
        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </Link>
    </main>
  );
}
