import { KaraokeRoomView } from "./KaraokeRoomView";

export default function KaraokeRoomPage({ params }: { params: { code: string } }) {
  return <KaraokeRoomView code={params.code.toUpperCase()} />;
}
