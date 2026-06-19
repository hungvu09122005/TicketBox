import ConcertDetailClient from './ConcertDetailClient';

export default async function ConcertDetailPage({
  params,
}: Readonly<{
  params: Promise<{ id: string }>;
}>) {
  const { id } = await params;
  return <ConcertDetailClient id={id} />;
}
