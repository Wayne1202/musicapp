import { RoomView } from "./RoomView";

export default function RoomPage({ params }: { params: { code: string } }) {
  return <RoomView code={params.code.toUpperCase()} />;
}
