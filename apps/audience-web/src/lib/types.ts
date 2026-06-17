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

export interface TicketTypeAvailability {
  id: string;
  name: string;
  price: number;
  maxPerUser: number;
  availableQuantity: number;
  status: 'AVAILABLE' | 'SOLD_OUT';
}

export interface AudienceOrder {
  id: string;
  userId?: string;
  concertId: string;
  ticketTypeId: string;
  quantity: number;
  totalAmount: number;
  status: 'PENDING_PAYMENT' | 'PAID' | 'EXPIRED' | 'PAYMENT_FAILED';
  expiresAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AudienceTicket {
  id: string;
  orderId: string;
  ticketTypeId: string;
  concertId: string;
  qrToken: string;
  status: 'ACTIVE' | 'USED' | 'CANCELLED' | 'TRANSFERRED';
  createdAt?: string;
  updatedAt?: string;
}

export interface PaymentInitiationResult {
  paymentUrl?: string | null;
  orderId?: string;
  paymentId?: string;
  status?: 'PENDING' | 'SUCCESS' | 'FAILED' | 'EXPIRED';
  message?: string;
}

export type PaymentReturnStatus = 'pending' | 'success' | 'failed' | 'expired';
