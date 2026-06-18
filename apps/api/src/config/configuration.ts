import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.API_PORT ?? '3001', 10),
  frontendAudienceUrl: process.env.FRONTEND_AUDIENCE_URL ?? 'http://localhost:3000',
  frontendAdminUrl: process.env.FRONTEND_ADMIN_URL ?? 'http://localhost:3002',

  database: {
    host: process.env.DATABASE_HOST ?? 'localhost',
    port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
    username: process.env.DATABASE_USERNAME ?? 'ticketbox',
    password: process.env.DATABASE_PASSWORD ?? 'ticketbox_dev',
    name: process.env.DATABASE_NAME ?? 'ticketbox',

    poolMin: parseInt(process.env.DATABASE_POOL_MIN ?? '2', 10),
    poolMax: parseInt(process.env.DATABASE_POOL_MAX ?? '10', 10),
  },

  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    password: process.env.REDIS_PASSWORD ?? undefined,
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
  },

  minio: {
    endpoint: process.env.MINIO_ENDPOINT ?? 'localhost',
    port: parseInt(process.env.MINIO_PORT ?? '9000', 10),
    useSsl: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY ?? '',
    secretKey: process.env.MINIO_SECRET_KEY ?? '',
    bucketName: process.env.MINIO_BUCKET_NAME ?? 'ticketbox',
  },

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? '',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? '',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },

  qr: {
    secret: process.env.QR_TOKEN_SECRET ?? '',
  },

  payment: {
    vnpay: {
      tmnCode: process.env.VNPAY_TMN_CODE ?? '',
      hashSecret: process.env.VNPAY_HASH_SECRET ?? '',
      sandboxUrl: process.env.VNPAY_SANDBOX_URL ?? 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
      returnUrl: process.env.VNPAY_RETURN_URL ?? 'http://localhost:3000/payment/result',
      ipnUrl: process.env.VNPAY_IPN_URL ?? 'http://localhost:3001/api/v1/payments/callback/vnpay',
    },
  },

  ai: {
    openaiApiKey: process.env.OPENAI_API_KEY ?? '',
    openaiModel: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
    textMaxChars: parseInt(process.env.AI_TEXT_MAX_CHARS ?? '8000', 10),
  },

  email: {
    sendgridApiKey: process.env.SENDGRID_API_KEY ?? '',
    fromEmail: process.env.SENDGRID_FROM_EMAIL ?? 'noreply@ticketbox.example.com',
    fromName: process.env.SENDGRID_FROM_NAME ?? 'TicketBox',
  },

  order: {
    holdMinutes: parseInt(process.env.ORDER_HOLD_MINUTES ?? '10', 10),
  },

  cache: {
    concertListTtl: parseInt(process.env.CACHE_CONCERT_LIST_TTL ?? '60', 10),
    concertDetailTtl: parseInt(process.env.CACHE_CONCERT_DETAIL_TTL ?? '120', 10),
    availabilityTtl: parseInt(process.env.CACHE_AVAILABILITY_TTL ?? '10', 10),
    permissionTtl: parseInt(process.env.CACHE_PERMISSION_TTL ?? '300', 10),
  },
}));
