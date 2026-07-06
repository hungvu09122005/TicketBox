export interface PublicConcertArtist {
  id: string;
  name: string;
  avatarUrl?: string | null;
}

export interface PublicArtistDetail {
  id: string;
  name: string;
  description?: string | null;
  shortBio?: string | null;
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
  artists: PublicConcertArtist[];
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

export interface PublicTicketType {
  id: string;
  name: string;
  price: number;
  maxPerUser: number;
  availableQuantity: number;
  status: 'AVAILABLE' | 'SOLD_OUT';
}

export interface TicketTypeAvailability {
  id: string;
  name: string;
  price: number;
  maxPerUser: number;
  soldQuantity?: number;
  heldQuantity?: number;
  totalQuantity?: number;
  availableQuantity: number;
  status: 'AVAILABLE' | 'SOLD_OUT';
}

export interface OrderSummary {
  id: string;
  concertId: string;
  ticketTypeId: string;
  quantity: number;
  totalAmount: number;
  status: 'PENDING_PAYMENT' | 'PAID' | 'EXPIRED' | 'PAYMENT_FAILED';
  createdAt: string;
  expiresAt: string;
}

export interface TicketSummary {
  id: string;
  orderId: string;
  ticketTypeId: string;
  userId: string;
  concertId: string;
  status: 'ACTIVE' | 'USED' | 'CANCELLED' | 'TRANSFERRED';
  createdAt: string;
}

export interface CreateOrderPayload {
  concertId: string;
  ticketTypeId: string;
  quantity: number;
  queueToken?: string;
}

export interface QueuedCheckoutResponse {
  status: 'QUEUED';
  message?: string;
  queueToken?: string;
}

export interface AudienceOrder {
  id: string;
  concertId: string;
  ticketTypeId: string;
  quantity: number;
  totalAmount: number;
  status: 'PENDING_PAYMENT' | 'PAID' | 'EXPIRED' | 'PAYMENT_FAILED';
  createdAt: string;
  expiresAt: string;
}

export interface AudienceTicket {
  id: string;
  orderId: string;
  ticketTypeId: string;
  userId: string;
  concertId: string;
  qrToken: string;
  status: 'ACTIVE' | 'USED' | 'CANCELLED' | 'TRANSFERRED';
  createdAt: string;
}

export type PaymentReturnStatus = 'pending' | 'success' | 'failed' | 'expired';

export interface PaymentInitiationResult {
  paymentUrl?: string | null;
  redirectUrl?: string | null;
  url?: string | null;
  orderId?: string | null;
  paymentId?: string | null;
  status?: string | null;
  message?: string | null;
}
