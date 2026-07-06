import WaitingRoomClient from './WaitingRoomClient';

export default async function WaitingRoomPage({
  params,
}: Readonly<{
  params: Promise<{ id: string }>;
}>) {
  const { id } = await params;
  return <WaitingRoomClient concertId={id} />;
}
