export interface Artist {
  id: string;
  name: string;
  bio?: string;
  imageUrl?: string;
}

export interface Venue {
  id: string;
  name: string;
  address: string;
  capacity: number;
}

export interface Concert {
  id: string;
  name: string;
  description: string;
  artistId: string;
  startsAt: string;
  endsAt: string;
  saleStartsAt?: string | null;
  saleEndsAt?: string | null;
  venue?: string | null;
  status: 'DRAFT' | 'PUBLISHED' | 'CANCELLED' | 'COMPLETED';
  bannerUrl?: string;
  createdAt: string;
  updatedAt: string;
  
  // Relations
  artist?: Artist;
}
