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
  title: string;
  description: string;
  artistId: string;
  venueId: string;
  startTime: string;
  endTime: string;
  status: 'DRAFT' | 'PUBLISHED' | 'CANCELLED';
  bannerUrl?: string;
  createdAt: string;
  updatedAt: string;
  
  // Relations
  artist?: Artist;
  venue?: Venue;
}
