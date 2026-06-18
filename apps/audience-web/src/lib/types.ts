export interface PublicConcertArtist {
  id: string;
  name: string;
  avatarUrl?: string | null;
}

export interface PublicConcert {
  id: string;
  name: string;
  description?: string | null;
  startsAt: string;
  endsAt: string;
  saleStartsAt?: string | null;
  saleEndsAt?: string | null;
  venue?: string | null;
  status: 'DRAFT' | 'PUBLISHED' | 'CANCELLED' | 'COMPLETED';
  bannerUrl?: string | null;
  artist: PublicConcertArtist;
}
