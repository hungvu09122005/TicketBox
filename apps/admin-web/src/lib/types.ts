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

export interface TicketType {
  id: string;
  concertId: string;
  name: string;
  price: number;
  totalQuantity: number;
  soldQuantity: number;
  heldQuantity: number;
  maxPerUser: number;
  saleStartsAt?: string | null;
  saleEndsAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface SeatZone {
  id: string;
  name: string;
  svgObjectKey?: string | null;
  ticketTypeId?: string | null;
  createdAt?: string;
}

export interface SeatMapResponse {
  svgUrl: string | null;
  zones: SeatZone[];
}
