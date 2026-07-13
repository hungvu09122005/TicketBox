BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  CREATE TYPE concerts_status_enum AS ENUM ('DRAFT', 'PUBLISHED', 'CANCELLED', 'COMPLETED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE orders_status_enum AS ENUM ('PENDING_PAYMENT', 'PAID', 'EXPIRED', 'PAYMENT_FAILED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE payments_status_enum AS ENUM ('PENDING', 'CONFIRMED', 'FAILED', 'REFUNDED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE tickets_status_enum AS ENUM ('ACTIVE', 'USED', 'CANCELLED', 'TRANSFERRED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE notification_logs_type_enum AS ENUM ('TICKET_CONFIRMATION', 'REMINDER_24H', 'CONCERT_UPDATE', 'VIP_WELCOME');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE notification_logs_channel_enum AS ENUM ('EMAIL');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE notification_logs_status_enum AS ENUM ('QUEUED', 'SENT', 'FAILED', 'BOUNCED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE checkin_logs_mode_enum AS ENUM ('ONLINE', 'OFFLINE', 'SYNCED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE checkin_logs_status_enum AS ENUM ('ACCEPTED', 'REJECTED', 'CONFLICT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE csv_import_jobs_status_enum AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'PARTIALLY_COMPLETED', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE csv_import_rows_status_enum AS ENUM ('SUCCESS', 'SKIPPED_DUPLICATE', 'ERROR');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE ai_bio_requests_status_enum AS ENUM ('PENDING', 'PROCESSING', 'DRAFT', 'PUBLISHED', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS permissions (
  id uuid PRIMARY KEY,
  name text NOT NULL UNIQUE,
  code text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY,
  name text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY,
  email text NOT NULL UNIQUE,
  name text NOT NULL,
  password_hash text NOT NULL,
  permission_version integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS role_permissions (
  "rolesId" uuid NOT NULL,
  "permissionsId" uuid NOT NULL,
  PRIMARY KEY ("rolesId", "permissionsId")
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id uuid NOT NULL,
  role_id uuid NOT NULL,
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS artists (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  "shortBio" text,
  avatar_object_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS concerts (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  organizer_id uuid NOT NULL,
  status concerts_status_enum NOT NULL DEFAULT 'DRAFT',
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  sale_starts_at timestamptz,
  sale_ends_at timestamptz,
  venue text,
  description text,
  banner_object_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS concert_artists (
  concert_id uuid NOT NULL,
  artist_id uuid NOT NULL,
  PRIMARY KEY (concert_id, artist_id)
);

CREATE TABLE IF NOT EXISTS ticket_types (
  id uuid PRIMARY KEY,
  concert_id uuid NOT NULL,
  name text NOT NULL,
  price numeric(15,2) NOT NULL,
  total_quantity integer NOT NULL DEFAULT 0,
  sold_quantity integer NOT NULL DEFAULT 0,
  held_quantity integer NOT NULL DEFAULT 0,
  max_per_user integer NOT NULL DEFAULT 4,
  sale_starts_at timestamptz,
  sale_ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS seat_zones (
  id uuid PRIMARY KEY,
  concert_id uuid NOT NULL,
  name text NOT NULL,
  svg_path text,
  svg_object_key text,
  ticket_type_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  concert_id uuid NOT NULL,
  ticket_type_id uuid NOT NULL,
  quantity integer NOT NULL,
  total_amount numeric(15,2) NOT NULL,
  expires_at timestamptz NOT NULL,
  status orders_status_enum NOT NULL DEFAULT 'PENDING_PAYMENT',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY,
  order_id uuid NOT NULL,
  ticket_type_id uuid NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric(15,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY,
  order_id uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  provider_tx_id text UNIQUE,
  provider text NOT NULL,
  amount numeric(15,2) NOT NULL,
  status payments_status_enum NOT NULL DEFAULT 'PENDING',
  raw_callback jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tickets (
  id uuid PRIMARY KEY,
  order_id uuid NOT NULL,
  ticket_type_id uuid NOT NULL,
  user_id uuid NOT NULL,
  concert_id uuid NOT NULL,
  qr_token text NOT NULL UNIQUE,
  status tickets_status_enum NOT NULL DEFAULT 'ACTIVE',
  manual_code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notification_logs (
  id uuid PRIMARY KEY,
  ticket_id uuid NOT NULL,
  user_id uuid NOT NULL,
  type notification_logs_type_enum NOT NULL,
  channel notification_logs_channel_enum NOT NULL,
  status notification_logs_status_enum NOT NULL DEFAULT 'QUEUED',
  sent_at timestamptz,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ticket_id, type, channel)
);

CREATE TABLE IF NOT EXISTS checkin_logs (
  id uuid PRIMARY KEY,
  ticket_id uuid NOT NULL,
  staff_id uuid,
  device_id text NOT NULL,
  mode checkin_logs_mode_enum NOT NULL DEFAULT 'ONLINE',
  status checkin_logs_status_enum NOT NULL,
  conflict_reason text,
  client_event_id text NOT NULL,
  scanned_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  sync_at timestamptz,
  UNIQUE (client_event_id, device_id)
);

CREATE TABLE IF NOT EXISTS csv_import_jobs (
  id uuid PRIMARY KEY,
  concert_id uuid NOT NULL,
  triggered_by uuid NOT NULL,
  object_key text NOT NULL,
  status csv_import_jobs_status_enum NOT NULL DEFAULT 'PENDING',
  total_rows integer NOT NULL DEFAULT 0,
  success_rows integer NOT NULL DEFAULT 0,
  error_rows integer NOT NULL DEFAULT 0,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS csv_import_rows (
  id uuid PRIMARY KEY,
  job_id uuid NOT NULL,
  row_number integer NOT NULL,
  status csv_import_rows_status_enum NOT NULL,
  error_reason text
);

CREATE TABLE IF NOT EXISTS vip_guests (
  id uuid PRIMARY KEY,
  concert_id uuid NOT NULL,
  ticket_type_id uuid NOT NULL,
  csv_import_job_id uuid NOT NULL,
  email text NOT NULL,
  phone text,
  name text NOT NULL,
  dedup_key text NOT NULL,
  ticket_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (concert_id, dedup_key)
);

CREATE TABLE IF NOT EXISTS ai_bio_requests (
  id uuid PRIMARY KEY,
  artist_id uuid NOT NULL,
  requested_by uuid NOT NULL,
  pdf_object_key text,
  status ai_bio_requests_status_enum NOT NULL DEFAULT 'PENDING',
  draft_content text,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE role_permissions
  ADD CONSTRAINT role_permissions_roles_fk
    FOREIGN KEY ("rolesId") REFERENCES roles(id) ON DELETE CASCADE,
  ADD CONSTRAINT role_permissions_permissions_fk
    FOREIGN KEY ("permissionsId") REFERENCES permissions(id) ON DELETE CASCADE;

ALTER TABLE user_roles
  ADD CONSTRAINT user_roles_user_fk
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  ADD CONSTRAINT user_roles_role_fk
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE;

ALTER TABLE concerts
  ADD CONSTRAINT concerts_organizer_fk
    FOREIGN KEY (organizer_id) REFERENCES users(id) ON DELETE RESTRICT;

ALTER TABLE concert_artists
  ADD CONSTRAINT concert_artists_concert_fk
    FOREIGN KEY (concert_id) REFERENCES concerts(id) ON DELETE CASCADE,
  ADD CONSTRAINT concert_artists_artist_fk
    FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE;

ALTER TABLE ticket_types
  ADD CONSTRAINT ticket_types_concert_fk
    FOREIGN KEY (concert_id) REFERENCES concerts(id) ON DELETE CASCADE,
  ADD CONSTRAINT ticket_types_quantity_check
    CHECK (sold_quantity + held_quantity <= total_quantity);

ALTER TABLE seat_zones
  ADD CONSTRAINT seat_zones_concert_fk
    FOREIGN KEY (concert_id) REFERENCES concerts(id) ON DELETE CASCADE,
  ADD CONSTRAINT seat_zones_ticket_type_fk
    FOREIGN KEY (ticket_type_id) REFERENCES ticket_types(id) ON DELETE SET NULL;

ALTER TABLE orders
  ADD CONSTRAINT orders_user_fk
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  ADD CONSTRAINT orders_concert_fk
    FOREIGN KEY (concert_id) REFERENCES concerts(id) ON DELETE CASCADE,
  ADD CONSTRAINT orders_ticket_type_fk
    FOREIGN KEY (ticket_type_id) REFERENCES ticket_types(id) ON DELETE RESTRICT;

ALTER TABLE order_items
  ADD CONSTRAINT order_items_order_fk
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  ADD CONSTRAINT order_items_ticket_type_fk
    FOREIGN KEY (ticket_type_id) REFERENCES ticket_types(id) ON DELETE RESTRICT;

ALTER TABLE payments
  ADD CONSTRAINT payments_order_fk
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;

ALTER TABLE tickets
  ADD CONSTRAINT tickets_order_fk
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  ADD CONSTRAINT tickets_ticket_type_fk
    FOREIGN KEY (ticket_type_id) REFERENCES ticket_types(id) ON DELETE RESTRICT,
  ADD CONSTRAINT tickets_user_fk
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  ADD CONSTRAINT tickets_concert_fk
    FOREIGN KEY (concert_id) REFERENCES concerts(id) ON DELETE CASCADE;

ALTER TABLE notification_logs
  ADD CONSTRAINT notification_logs_ticket_fk
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
  ADD CONSTRAINT notification_logs_user_fk
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE checkin_logs
  ADD CONSTRAINT checkin_logs_ticket_fk
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
  ADD CONSTRAINT checkin_logs_staff_fk
    FOREIGN KEY (staff_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE csv_import_jobs
  ADD CONSTRAINT csv_import_jobs_concert_fk
    FOREIGN KEY (concert_id) REFERENCES concerts(id) ON DELETE CASCADE,
  ADD CONSTRAINT csv_import_jobs_triggered_by_fk
    FOREIGN KEY (triggered_by) REFERENCES users(id) ON DELETE RESTRICT;

ALTER TABLE csv_import_rows
  ADD CONSTRAINT csv_import_rows_job_fk
    FOREIGN KEY (job_id) REFERENCES csv_import_jobs(id) ON DELETE CASCADE;

ALTER TABLE vip_guests
  ADD CONSTRAINT vip_guests_concert_fk
    FOREIGN KEY (concert_id) REFERENCES concerts(id) ON DELETE CASCADE,
  ADD CONSTRAINT vip_guests_ticket_type_fk
    FOREIGN KEY (ticket_type_id) REFERENCES ticket_types(id) ON DELETE RESTRICT,
  ADD CONSTRAINT vip_guests_job_fk
    FOREIGN KEY (csv_import_job_id) REFERENCES csv_import_jobs(id) ON DELETE CASCADE,
  ADD CONSTRAINT vip_guests_ticket_fk
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE SET NULL;

ALTER TABLE ai_bio_requests
  ADD CONSTRAINT ai_bio_requests_artist_fk
    FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE,
  ADD CONSTRAINT ai_bio_requests_requested_by_fk
    FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE RESTRICT;

-- RBAC
INSERT INTO permissions (id, name, code) VALUES
  ('10100000-0000-0000-0000-000000000001', 'concert:read_public', 'concert:read_public'),
  ('10100000-0000-0000-0000-000000000002', 'concert:read_own', 'concert:read_own'),
  ('10100000-0000-0000-0000-000000000003', 'concert:read_all', 'concert:read_all'),
  ('10100000-0000-0000-0000-000000000004', 'concert:create', 'concert:create'),
  ('10100000-0000-0000-0000-000000000005', 'concert:update_own', 'concert:update_own'),
  ('10100000-0000-0000-0000-000000000006', 'concert:update_all', 'concert:update_all'),
  ('10100000-0000-0000-0000-000000000007', 'concert:publish_own', 'concert:publish_own'),
  ('10100000-0000-0000-0000-000000000008', 'concert:publish_all', 'concert:publish_all'),
  ('10100000-0000-0000-0000-000000000009', 'concert:cancel_own', 'concert:cancel_own'),
  ('10100000-0000-0000-0000-000000000010', 'concert:cancel_all', 'concert:cancel_all'),
  ('10100000-0000-0000-0000-000000000011', 'artist:read', 'artist:read'),
  ('10100000-0000-0000-0000-000000000012', 'artist:create', 'artist:create'),
  ('10100000-0000-0000-0000-000000000013', 'artist:update', 'artist:update'),
  ('10100000-0000-0000-0000-000000000014', 'artist:delete', 'artist:delete'),
  ('10100000-0000-0000-0000-000000000015', 'venue:read', 'venue:read'),
  ('10100000-0000-0000-0000-000000000016', 'venue:create', 'venue:create'),
  ('10100000-0000-0000-0000-000000000017', 'venue:update', 'venue:update'),
  ('10100000-0000-0000-0000-000000000018', 'venue:delete', 'venue:delete'),
  ('10100000-0000-0000-0000-000000000019', 'ticket_type:read', 'ticket_type:read'),
  ('10100000-0000-0000-0000-000000000020', 'ticket_type:create', 'ticket_type:create'),
  ('10100000-0000-0000-0000-000000000021', 'ticket_type:update', 'ticket_type:update'),
  ('10100000-0000-0000-0000-000000000022', 'ticket_type:delete', 'ticket_type:delete'),
  ('10100000-0000-0000-0000-000000000023', 'seatmap:read', 'seatmap:read'),
  ('10100000-0000-0000-0000-000000000024', 'seatmap:update', 'seatmap:update'),
  ('10100000-0000-0000-0000-000000000025', 'seatmap:upload', 'seatmap:upload'),
  ('10100000-0000-0000-0000-000000000026', 'order:create', 'order:create'),
  ('10100000-0000-0000-0000-000000000027', 'order:read_own', 'order:read_own'),
  ('10100000-0000-0000-0000-000000000028', 'order:read_all', 'order:read_all'),
  ('10100000-0000-0000-0000-000000000029', 'order:refund', 'order:refund'),
  ('10100000-0000-0000-0000-000000000030', 'ticket:view_own', 'ticket:view_own'),
  ('10100000-0000-0000-0000-000000000031', 'ticket:validate', 'ticket:validate'),
  ('10100000-0000-0000-0000-000000000032', 'vip:import', 'vip:import'),
  ('10100000-0000-0000-0000-000000000033', 'ai:generate_bio', 'ai:generate_bio'),
  ('10100000-0000-0000-0000-000000000034', 'report:view', 'report:view'),
  ('10100000-0000-0000-0000-000000000035', 'report:export', 'report:export'),
  ('10100000-0000-0000-0000-000000000036', 'role:update_permissions', 'role:update_permissions'),
  ('10100000-0000-0000-0000-000000000037', 'permission:read', 'permission:read'),
  ('10100000-0000-0000-0000-000000000038', 'permission:create', 'permission:create'),
  ('10100000-0000-0000-0000-000000000039', 'rbac:manage', 'rbac:manage')
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name;

INSERT INTO roles (id, name) VALUES
  ('20100000-0000-0000-0000-000000000001', 'AUDIENCE'),
  ('20100000-0000-0000-0000-000000000002', 'ORGANIZER'),
  ('20100000-0000-0000-0000-000000000003', 'CHECKIN_STAFF'),
  ('20100000-0000-0000-0000-000000000004', 'SYSTEM_ADMIN')
ON CONFLICT (name) DO UPDATE
SET name = EXCLUDED.name;

INSERT INTO role_permissions ("rolesId", "permissionsId")
SELECT r.id, p.id
FROM (
  VALUES
    ('AUDIENCE', 'concert:read_public'),
    ('AUDIENCE', 'order:create'),
    ('AUDIENCE', 'user:read_own'),
    ('AUDIENCE', 'user:update_own'),
    ('AUDIENCE', 'order:read_own'),
    ('AUDIENCE', 'ticket:view_own'),
    ('ORGANIZER', 'concert:read_public'),
    ('ORGANIZER', 'concert:read_own'),
    ('ORGANIZER', 'concert:create'),
    ('ORGANIZER', 'concert:update_own'),
    ('ORGANIZER', 'concert:publish_own'),
    ('ORGANIZER', 'concert:cancel_own'),
    ('ORGANIZER', 'artist:read'),
    ('ORGANIZER', 'artist:create'),
    ('ORGANIZER', 'artist:update'),
    ('ORGANIZER', 'venue:read'),
    ('ORGANIZER', 'venue:create'),
    ('ORGANIZER', 'venue:update'),
    ('ORGANIZER', 'ticket_type:read'),
    ('ORGANIZER', 'ticket_type:create'),
    ('ORGANIZER', 'ticket_type:update'),
    ('ORGANIZER', 'seatmap:read'),
    ('ORGANIZER', 'seatmap:update'),
    ('ORGANIZER', 'seatmap:upload'),
    ('ORGANIZER', 'order:read_all'),
    ('ORGANIZER', 'order:refund'),
    ('ORGANIZER', 'vip:import'),
    ('ORGANIZER', 'ai:generate_bio'),
    ('ORGANIZER', 'report:view'),
    ('ORGANIZER', 'report:export'),
    ('CHECKIN_STAFF', 'concert:read_public'),
    ('CHECKIN_STAFF', 'ticket:validate'),
    ('SYSTEM_ADMIN', 'concert:read_public'),
    ('SYSTEM_ADMIN', 'concert:read_own'),
    ('SYSTEM_ADMIN', 'concert:read_all'),
    ('SYSTEM_ADMIN', 'concert:create'),
    ('SYSTEM_ADMIN', 'concert:update_own'),
    ('SYSTEM_ADMIN', 'concert:update_all'),
    ('SYSTEM_ADMIN', 'concert:publish_own'),
    ('SYSTEM_ADMIN', 'concert:publish_all'),
    ('SYSTEM_ADMIN', 'concert:cancel_own'),
    ('SYSTEM_ADMIN', 'concert:cancel_all'),
    ('SYSTEM_ADMIN', 'artist:read'),
    ('SYSTEM_ADMIN', 'artist:create'),
    ('SYSTEM_ADMIN', 'artist:update'),
    ('SYSTEM_ADMIN', 'artist:delete'),
    ('SYSTEM_ADMIN', 'venue:read'),
    ('SYSTEM_ADMIN', 'venue:create'),
    ('SYSTEM_ADMIN', 'venue:update'),
    ('SYSTEM_ADMIN', 'venue:delete'),
    ('SYSTEM_ADMIN', 'ticket_type:read'),
    ('SYSTEM_ADMIN', 'ticket_type:create'),
    ('SYSTEM_ADMIN', 'ticket_type:update'),
    ('SYSTEM_ADMIN', 'ticket_type:delete'),
    ('SYSTEM_ADMIN', 'seatmap:read'),
    ('SYSTEM_ADMIN', 'seatmap:update'),
    ('SYSTEM_ADMIN', 'seatmap:upload'),
    ('SYSTEM_ADMIN', 'order:create'),
    ('SYSTEM_ADMIN', 'order:read_own'),
    ('SYSTEM_ADMIN', 'order:read_all'),
    ('SYSTEM_ADMIN', 'order:refund'),
    ('SYSTEM_ADMIN', 'ticket:view_own'),
    ('SYSTEM_ADMIN', 'ticket:validate'),
    ('SYSTEM_ADMIN', 'vip:import'),
    ('SYSTEM_ADMIN', 'ai:generate_bio'),
    ('SYSTEM_ADMIN', 'report:view'),
    ('SYSTEM_ADMIN', 'report:export'),
    ('SYSTEM_ADMIN', 'role:update_permissions'),
    ('SYSTEM_ADMIN', 'permission:read'),
    ('SYSTEM_ADMIN', 'permission:create'),
    ('SYSTEM_ADMIN', 'rbac:manage')
) AS mapping(role_name, permission_code)
JOIN roles r ON r.name = mapping.role_name
JOIN permissions p ON p.code = mapping.permission_code
ON CONFLICT DO NOTHING;

INSERT INTO users (
  id, email, name, password_hash, permission_version, is_active, created_at, updated_at
) VALUES
  (
    '30100000-0000-0000-0000-000000000001',
    'admin@ticketbox.local',
    'System Admin',
    crypt('Admin@123456', gen_salt('bf', 12)),
    1,
    true,
    NOW(),
    NOW()
  ),
  (
    '30100000-0000-0000-0000-000000000002',
    'organizer@ticketbox.local',
    'Organizer User',
    crypt('Organizer@123456', gen_salt('bf', 12)),
    1,
    true,
    NOW(),
    NOW()
  ),
  (
    '30100000-0000-0000-0000-000000000003',
    'staff@ticketbox.local',
    'Check-in Staff',
    crypt('Staff@123456', gen_salt('bf', 12)),
    1,
    true,
    NOW(),
    NOW()
  ),
  (
    '30100000-0000-0000-0000-000000000004',
    'audience@ticketbox.local',
    'Audience User',
    crypt('Audience@123456', gen_salt('bf', 12)),
    1,
    true,
    NOW(),
    NOW()
  )
ON CONFLICT (email) DO UPDATE
SET
  name = EXCLUDED.name,
  password_hash = EXCLUDED.password_hash,
  permission_version = EXCLUDED.permission_version,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM (
  VALUES
    ('admin@ticketbox.local', 'SYSTEM_ADMIN'),
    ('organizer@ticketbox.local', 'ORGANIZER'),
    ('staff@ticketbox.local', 'CHECKIN_STAFF'),
    ('audience@ticketbox.local', 'AUDIENCE')
) AS mapping(email, role_name)
JOIN users u ON u.email = mapping.email
JOIN roles r ON r.name = mapping.role_name
ON CONFLICT DO NOTHING;

-- Core business data
INSERT INTO artists (id, name, "shortBio", avatar_object_key, created_at, updated_at) VALUES
  (
    '2c5d8d0f-3f58-4eb5-87ff-4fa0b622c501',
    'The Neon Waves',
    'Electronic pop band seeded for local development.',
    'artists/the-neon-waves/avatar.png',
    NOW(),
    NOW()
  ),
  (
    'd9b13f28-66d4-4f7d-9d8d-1c0a12ccf502',
    'Midnight Echo',
    'Acoustic duo used to populate the concert catalogue.',
    'artists/midnight-echo/avatar.png',
    NOW(),
    NOW()
  )
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  "shortBio" = EXCLUDED."shortBio",
  avatar_object_key = EXCLUDED.avatar_object_key,
  updated_at = NOW();

INSERT INTO concerts (
  id, name, organizer_id, status, starts_at, ends_at, sale_starts_at, sale_ends_at,
  venue, description, banner_object_key, created_at, updated_at
) VALUES
  (
    '8a4c2d40-3a12-4b7d-b851-3b6e5de4c601',
    'Summer Pulse Live 2026',
    '30100000-0000-0000-0000-000000000002',
    'PUBLISHED',
    '2026-08-15T12:00:00.000Z',
    '2026-08-15T15:00:00.000Z',
    '2026-07-01T00:00:00.000Z',
    '2026-08-10T23:59:59.000Z',
    'Saigon Exhibition and Convention Center',
    'Main seeded concert for audience and organizer workflows.',
    'concerts/summer-pulse-live-2026/banner.jpg',
    NOW(),
    NOW()
  ),
  (
    'f4d8b3c9-1f39-4c1d-ae18-9b0d2ff8c602',
    'Acoustic Night Session',
    '30100000-0000-0000-0000-000000000002',
    'DRAFT',
    '2026-10-20T11:00:00.000Z',
    '2026-10-20T13:00:00.000Z',
    '2026-09-01T00:00:00.000Z',
    '2026-10-15T23:59:59.000Z',
    'TicketBox Hall',
    'Secondary draft concert for management screens.',
    'concerts/acoustic-night-session/banner.jpg',
    NOW(),
    NOW()
  ),
  (
    '8a4c2d40-3a12-4b7d-b851-3b6e5de4c603',
    'Rock Arena 2026',
    '30100000-0000-0000-0000-000000000002',
    'PUBLISHED',
    '2026-09-05T18:00:00.000Z',
    '2026-09-05T21:00:00.000Z',
    '2026-07-01T00:00:00.000Z',
    '2026-09-01T23:59:59.000Z',
    'Hanoi Stadium',
    'Rock Arena concert for tests.',
    'concerts/rock-arena-2026/banner.jpg',
    NOW(),
    NOW()
  ),
  (
    '8a4c2d40-3a12-4b7d-b851-3b6e5de4c604',
    'Pop Deluxe Fest 2026',
    '30100000-0000-0000-0000-000000000002',
    'PUBLISHED',
    '2026-09-25T19:00:00.000Z',
    '2026-09-25T22:00:00.000Z',
    '2026-07-01T00:00:00.000Z',
    '2026-09-20T23:59:59.000Z',
    'Da Nang Center',
    'Pop Deluxe concert for tests.',
    'concerts/pop-deluxe-fest-2026/banner.jpg',
    NOW(),
    NOW()
  )
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  organizer_id = EXCLUDED.organizer_id,
  status = EXCLUDED.status,
  starts_at = EXCLUDED.starts_at,
  ends_at = EXCLUDED.ends_at,
  sale_starts_at = EXCLUDED.sale_starts_at,
  sale_ends_at = EXCLUDED.sale_ends_at,
  venue = EXCLUDED.venue,
  description = EXCLUDED.description,
  banner_object_key = EXCLUDED.banner_object_key,
  updated_at = NOW();

INSERT INTO concert_artists (concert_id, artist_id) VALUES
  ('8a4c2d40-3a12-4b7d-b851-3b6e5de4c601', '2c5d8d0f-3f58-4eb5-87ff-4fa0b622c501'),
  ('f4d8b3c9-1f39-4c1d-ae18-9b0d2ff8c602', 'd9b13f28-66d4-4f7d-9d8d-1c0a12ccf502')
ON CONFLICT DO NOTHING;

INSERT INTO ticket_types (
  id, concert_id, name, price, total_quantity, sold_quantity, held_quantity, max_per_user,
  sale_starts_at, sale_ends_at, created_at, updated_at
) VALUES
  (
    '6d6f0f4a-6d1d-42a4-9ac2-3bb74f0ac701',
    '8a4c2d40-3a12-4b7d-b851-3b6e5de4c601',
    'VIP',
    1800000,
    120,
    12,
    4,
    4,
    '2026-07-01T00:00:00.000Z',
    '2026-08-10T23:59:59.000Z',
    NOW(),
    NOW()
  ),
  (
    '8d6f0f4a-6d1d-42a4-9ac2-3bb74f0ac702',
    '8a4c2d40-3a12-4b7d-b851-3b6e5de4c601',
    'Standard',
    750000,
    400,
    180,
    25,
    6,
    '2026-07-01T00:00:00.000Z',
    '2026-08-10T23:59:59.000Z',
    NOW(),
    NOW()
  ),
  (
    '9d6f0f4a-6d1d-42a4-9ac2-3bb74f0ac703',
    'f4d8b3c9-1f39-4c1d-ae18-9b0d2ff8c602',
    'Backstage',
    2200000,
    50,
    0,
    0,
    2,
    '2026-09-01T00:00:00.000Z',
    '2026-10-15T23:59:59.000Z',
    NOW(),
    NOW()
  ),
  (
    '6d6f0f4a-6d1d-42a4-9ac2-3bb74f0ac703',
    '8a4c2d40-3a12-4b7d-b851-3b6e5de4c603',
    'VIP',
    2000000,
    100,
    0,
    0,
    4,
    '2026-07-01T00:00:00.000Z',
    '2026-09-01T23:59:59.000Z',
    NOW(),
    NOW()
  ),
  (
    '8d6f0f4a-6d1d-42a4-9ac2-3bb74f0ac704',
    '8a4c2d40-3a12-4b7d-b851-3b6e5de4c603',
    'Standard',
    800000,
    300,
    0,
    0,
    6,
    '2026-07-01T00:00:00.000Z',
    '2026-09-01T23:59:59.000Z',
    NOW(),
    NOW()
  ),
  (
    '6d6f0f4a-6d1d-42a4-9ac2-3bb74f0ac705',
    '8a4c2d40-3a12-4b7d-b851-3b6e5de4c604',
    'VIP',
    2500000,
    80,
    0,
    0,
    4,
    '2026-07-01T00:00:00.000Z',
    '2026-09-20T23:59:59.000Z',
    NOW(),
    NOW()
  ),
  (
    '8d6f0f4a-6d1d-42a4-9ac2-3bb74f0ac706',
    '8a4c2d40-3a12-4b7d-b851-3b6e5de4c604',
    'Standard',
    900000,
    250,
    0,
    0,
    6,
    '2026-07-01T00:00:00.000Z',
    '2026-09-20T23:59:59.000Z',
    NOW(),
    NOW()
  )
ON CONFLICT (id) DO UPDATE
SET
  concert_id = EXCLUDED.concert_id,
  name = EXCLUDED.name,
  price = EXCLUDED.price,
  total_quantity = EXCLUDED.total_quantity,
  sold_quantity = EXCLUDED.sold_quantity,
  held_quantity = EXCLUDED.held_quantity,
  max_per_user = EXCLUDED.max_per_user,
  sale_starts_at = EXCLUDED.sale_starts_at,
  sale_ends_at = EXCLUDED.sale_ends_at,
  updated_at = NOW();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'seat_zones'
      AND column_name = 'svg_path'
  ) THEN
    EXECUTE $sql$
      INSERT INTO seat_zones (
        id, concert_id, name, svg_path, ticket_type_id, created_at
      ) VALUES
        (
          '1b6b64d0-6f5f-4f7a-9f4f-21db06bbd801',
          '8a4c2d40-3a12-4b7d-b851-3b6e5de4c601',
          'Zone A',
          'seat-maps/summer-pulse-live-2026/zone-a.svg',
          '6d6f0f4a-6d1d-42a4-9ac2-3bb74f0ac701',
          NOW()
        ),
        (
          '1b6b64d0-6f5f-4f7a-9f4f-21db06bbd802',
          '8a4c2d40-3a12-4b7d-b851-3b6e5de4c601',
          'Zone B',
          'seat-maps/summer-pulse-live-2026/zone-b.svg',
          '8d6f0f4a-6d1d-42a4-9ac2-3bb74f0ac702',
          NOW()
        ),
        (
          '1b6b64d0-6f5f-4f7a-9f4f-21db06bbd803',
          '8a4c2d40-3a12-4b7d-b851-3b6e5de4c603',
          'Zone A',
          'seat-maps/rock-arena-2026/zone-a.svg',
          '6d6f0f4a-6d1d-42a4-9ac2-3bb74f0ac703',
          NOW()
        ),
        (
          '1b6b64d0-6f5f-4f7a-9f4f-21db06bbd804',
          '8a4c2d40-3a12-4b7d-b851-3b6e5de4c603',
          'Zone B',
          'seat-maps/rock-arena-2026/zone-b.svg',
          '8d6f0f4a-6d1d-42a4-9ac2-3bb74f0ac704',
          NOW()
        ),
        (
          '1b6b64d0-6f5f-4f7a-9f4f-21db06bbd805',
          '8a4c2d40-3a12-4b7d-b851-3b6e5de4c604',
          'Zone A',
          'seat-maps/pop-deluxe-fest-2026/zone-a.svg',
          '6d6f0f4a-6d1d-42a4-9ac2-3bb74f0ac705',
          NOW()
        ),
        (
          '1b6b64d0-6f5f-4f7a-9f4f-21db06bbd806',
          '8a4c2d40-3a12-4b7d-b851-3b6e5de4c604',
          'Zone B',
          'seat-maps/pop-deluxe-fest-2026/zone-b.svg',
          '8d6f0f4a-6d1d-42a4-9ac2-3bb74f0ac706',
          NOW()
        )
      ON CONFLICT (id) DO UPDATE
      SET
        concert_id = EXCLUDED.concert_id,
        name = EXCLUDED.name,
        svg_path = EXCLUDED.svg_path,
        ticket_type_id = EXCLUDED.ticket_type_id
    $sql$;
  ELSIF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'seat_zones'
      AND column_name = 'svg_object_key'
  ) THEN
    EXECUTE $sql$
      INSERT INTO seat_zones (
        id, concert_id, name, svg_object_key, ticket_type_id, created_at
      ) VALUES
        (
          '1b6b64d0-6f5f-4f7a-9f4f-21db06bbd801',
          '8a4c2d40-3a12-4b7d-b851-3b6e5de4c601',
          'Zone A',
          'seat-maps/summer-pulse-live-2026/zone-a.svg',
          '6d6f0f4a-6d1d-42a4-9ac2-3bb74f0ac701',
          NOW()
        ),
        (
          '1b6b64d0-6f5f-4f7a-9f4f-21db06bbd802',
          '8a4c2d40-3a12-4b7d-b851-3b6e5de4c601',
          'Zone B',
          'seat-maps/summer-pulse-live-2026/zone-b.svg',
          '8d6f0f4a-6d1d-42a4-9ac2-3bb74f0ac702',
          NOW()
        ),
        (
          '1b6b64d0-6f5f-4f7a-9f4f-21db06bbd803',
          '8a4c2d40-3a12-4b7d-b851-3b6e5de4c603',
          'Zone A',
          'seat-maps/rock-arena-2026/zone-a.svg',
          '6d6f0f4a-6d1d-42a4-9ac2-3bb74f0ac703',
          NOW()
        ),
        (
          '1b6b64d0-6f5f-4f7a-9f4f-21db06bbd804',
          '8a4c2d40-3a12-4b7d-b851-3b6e5de4c603',
          'Zone B',
          'seat-maps/rock-arena-2026/zone-b.svg',
          '8d6f0f4a-6d1d-42a4-9ac2-3bb74f0ac704',
          NOW()
        ),
        (
          '1b6b64d0-6f5f-4f7a-9f4f-21db06bbd805',
          '8a4c2d40-3a12-4b7d-b851-3b6e5de4c604',
          'Zone A',
          'seat-maps/pop-deluxe-fest-2026/zone-a.svg',
          '6d6f0f4a-6d1d-42a4-9ac2-3bb74f0ac705',
          NOW()
        ),
        (
          '1b6b64d0-6f5f-4f7a-9f4f-21db06bbd806',
          '8a4c2d40-3a12-4b7d-b851-3b6e5de4c604',
          'Zone B',
          'seat-maps/pop-deluxe-fest-2026/zone-b.svg',
          '8d6f0f4a-6d1d-42a4-9ac2-3bb74f0ac706',
          NOW()
        )
      ON CONFLICT (id) DO UPDATE
      SET
        concert_id = EXCLUDED.concert_id,
        name = EXCLUDED.name,
        svg_object_key = EXCLUDED.svg_object_key,
        ticket_type_id = EXCLUDED.ticket_type_id
    $sql$;
  END IF;
END $$;

INSERT INTO orders (
  id, user_id, concert_id, ticket_type_id, quantity, total_amount, expires_at, status, created_at, updated_at
) VALUES
  (
    'aa8fa3b1-7fcb-4f1e-8f25-65fcbde5e901',
    '30100000-0000-0000-0000-000000000004',
    '8a4c2d40-3a12-4b7d-b851-3b6e5de4c601',
    '8d6f0f4a-6d1d-42a4-9ac2-3bb74f0ac702',
    2,
    1500000,
    '2026-07-10T12:15:00.000Z',
    'PAID',
    NOW(),
    NOW()
  ),
  (
    'aa8fa3b1-7fcb-4f1e-8f25-65fcbde5e902',
    '30100000-0000-0000-0000-000000000004',
    'f4d8b3c9-1f39-4c1d-ae18-9b0d2ff8c602',
    '9d6f0f4a-6d1d-42a4-9ac2-3bb74f0ac703',
    1,
    2200000,
    '2026-07-12T12:15:00.000Z',
    'PENDING_PAYMENT',
    NOW(),
    NOW()
  )
ON CONFLICT (id) DO UPDATE
SET
  user_id = EXCLUDED.user_id,
  concert_id = EXCLUDED.concert_id,
  ticket_type_id = EXCLUDED.ticket_type_id,
  quantity = EXCLUDED.quantity,
  total_amount = EXCLUDED.total_amount,
  expires_at = EXCLUDED.expires_at,
  status = EXCLUDED.status,
  updated_at = NOW();

INSERT INTO order_items (id, order_id, ticket_type_id, quantity, unit_price) VALUES
  (
    'bb8fa3b1-7fcb-4f1e-8f25-65fcbde5ea01',
    'aa8fa3b1-7fcb-4f1e-8f25-65fcbde5e901',
    '8d6f0f4a-6d1d-42a4-9ac2-3bb74f0ac702',
    2,
    750000
  ),
  (
    'bb8fa3b1-7fcb-4f1e-8f25-65fcbde5ea02',
    'aa8fa3b1-7fcb-4f1e-8f25-65fcbde5e902',
    '9d6f0f4a-6d1d-42a4-9ac2-3bb74f0ac703',
    1,
    2200000
  )
ON CONFLICT (id) DO UPDATE
SET
  order_id = EXCLUDED.order_id,
  ticket_type_id = EXCLUDED.ticket_type_id,
  quantity = EXCLUDED.quantity,
  unit_price = EXCLUDED.unit_price;

INSERT INTO payments (
  id, order_id, idempotency_key, provider_tx_id, provider, amount, status, raw_callback, created_at, updated_at
) VALUES
  (
    'cc8fa3b1-7fcb-4f1e-8f25-65fcbde5eb01',
    'aa8fa3b1-7fcb-4f1e-8f25-65fcbde5e901',
    'payment-paid-order-001',
    'VNPAY-PAID-001',
    'VNPAY',
    1500000,
    'CONFIRMED',
    '{"status":"00","bankCode":"VCB","transactionNo":"1234567890"}'::jsonb,
    NOW(),
    NOW()
  ),
  (
    'cc8fa3b1-7fcb-4f1e-8f25-65fcbde5eb02',
    'aa8fa3b1-7fcb-4f1e-8f25-65fcbde5e902',
    'payment-pending-order-001',
    'MOMO-PENDING-001',
    'MOMO',
    2200000,
    'PENDING',
    '{"status":"PROCESSING"}'::jsonb,
    NOW(),
    NOW()
  )
ON CONFLICT (id) DO UPDATE
SET
  order_id = EXCLUDED.order_id,
  idempotency_key = EXCLUDED.idempotency_key,
  provider_tx_id = EXCLUDED.provider_tx_id,
  provider = EXCLUDED.provider,
  amount = EXCLUDED.amount,
  status = EXCLUDED.status,
  raw_callback = EXCLUDED.raw_callback,
  updated_at = NOW();

INSERT INTO tickets (
  id, order_id, ticket_type_id, user_id, concert_id, qr_token, status, manual_code, created_at, updated_at
) VALUES
  (
    'dd8fa3b1-7fcb-4f1e-8f25-65fcbde5ec01',
    'aa8fa3b1-7fcb-4f1e-8f25-65fcbde5e901',
    '8d6f0f4a-6d1d-42a4-9ac2-3bb74f0ac702',
    '30100000-0000-0000-0000-000000000004',
    '8a4c2d40-3a12-4b7d-b851-3b6e5de4c601',
    'qr-token-ticket-001',
    'ACTIVE',
    'MC-SEEDED-01',
    NOW(),
    NOW()
  ),
  (
    'dd8fa3b1-7fcb-4f1e-8f25-65fcbde5ec02',
    'aa8fa3b1-7fcb-4f1e-8f25-65fcbde5e901',
    '8d6f0f4a-6d1d-42a4-9ac2-3bb74f0ac702',
    '30100000-0000-0000-0000-000000000004',
    '8a4c2d40-3a12-4b7d-b851-3b6e5de4c601',
    'qr-token-ticket-002',
    'USED',
    'MC-SEEDED-02',
    NOW(),
    NOW()
  ),
  (
    'dd8fa3b1-7fcb-4f1e-8f25-65fcbde5ec03',
    'aa8fa3b1-7fcb-4f1e-8f25-65fcbde5e902',
    '9d6f0f4a-6d1d-42a4-9ac2-3bb74f0ac703',
    '30100000-0000-0000-0000-000000000004',
    'f4d8b3c9-1f39-4c1d-ae18-9b0d2ff8c602',
    'qr-token-ticket-003',
    'ACTIVE',
    'MC-SEEDED-03',
    NOW(),
    NOW()
  )
ON CONFLICT (id) DO UPDATE
SET
  order_id = EXCLUDED.order_id,
  ticket_type_id = EXCLUDED.ticket_type_id,
  user_id = EXCLUDED.user_id,
  concert_id = EXCLUDED.concert_id,
  qr_token = EXCLUDED.qr_token,
  status = EXCLUDED.status,
  manual_code = EXCLUDED.manual_code,
  updated_at = NOW();

INSERT INTO notification_logs (
  id, ticket_id, user_id, type, channel, status, sent_at, created_at
) VALUES
  (
    'ee8fa3b1-7fcb-4f1e-8f25-65fcbde5ed01',
    'dd8fa3b1-7fcb-4f1e-8f25-65fcbde5ec01',
    '30100000-0000-0000-0000-000000000004',
    'TICKET_CONFIRMATION',
    'EMAIL',
    'SENT',
    '2026-07-10T12:20:00.000Z',
    NOW()
  ),
  (
    'ee8fa3b1-7fcb-4f1e-8f25-65fcbde5ed02',
    'dd8fa3b1-7fcb-4f1e-8f25-65fcbde5ec02',
    '30100000-0000-0000-0000-000000000004',
    'REMINDER_24H',
    'EMAIL',
    'QUEUED',
    NULL,
    NOW()
  )
ON CONFLICT DO NOTHING;

INSERT INTO checkin_logs (
  id, ticket_id, staff_id, device_id, mode, status, conflict_reason, client_event_id, scanned_at, created_at, sync_at
) VALUES
  (
    'ff8fa3b1-7fcb-4f1e-8f25-65fcbde5ee01',
    'dd8fa3b1-7fcb-4f1e-8f25-65fcbde5ec01',
    '30100000-0000-0000-0000-000000000003',
    'scanner-device-01',
    'ONLINE',
    'ACCEPTED',
    NULL,
    'client-event-001',
    '2026-08-15T12:10:00.000Z',
    NOW(),
    '2026-08-15T12:10:01.000Z'
  ),
  (
    'ff8fa3b1-7fcb-4f1e-8f25-65fcbde5ee02',
    'dd8fa3b1-7fcb-4f1e-8f25-65fcbde5ec03',
    '30100000-0000-0000-0000-000000000003',
    'scanner-device-01',
    'OFFLINE',
    'REJECTED',
    'Ticket not paid yet.',
    'client-event-002',
    '2026-08-15T12:15:00.000Z',
    NOW(),
    NULL
  )
ON CONFLICT DO NOTHING;

INSERT INTO csv_import_jobs (
  id, concert_id, triggered_by, object_key, status, total_rows, success_rows, error_rows, failure_reason, created_at
) VALUES
  (
    '111fa3b1-7fcb-4f1e-8f25-65fcbde5ef01',
    '8a4c2d40-3a12-4b7d-b851-3b6e5de4c601',
    '30100000-0000-0000-0000-000000000002',
    'imports/vip-guests/summer-pulse.csv',
    'COMPLETED',
    3,
    2,
    1,
    NULL,
    NOW()
  )
ON CONFLICT (id) DO UPDATE
SET
  concert_id = EXCLUDED.concert_id,
  triggered_by = EXCLUDED.triggered_by,
  object_key = EXCLUDED.object_key,
  status = EXCLUDED.status,
  total_rows = EXCLUDED.total_rows,
  success_rows = EXCLUDED.success_rows,
  error_rows = EXCLUDED.error_rows,
  failure_reason = EXCLUDED.failure_reason;

INSERT INTO csv_import_rows (id, job_id, row_number, status, error_reason) VALUES
  ('111fa3b1-7fcb-4f1e-8f25-65fcbde5ef11', '111fa3b1-7fcb-4f1e-8f25-65fcbde5ef01', 1, 'SUCCESS', NULL),
  ('111fa3b1-7fcb-4f1e-8f25-65fcbde5ef12', '111fa3b1-7fcb-4f1e-8f25-65fcbde5ef01', 2, 'SUCCESS', NULL),
  ('111fa3b1-7fcb-4f1e-8f25-65fcbde5ef13', '111fa3b1-7fcb-4f1e-8f25-65fcbde5ef01', 3, 'ERROR', 'Invalid email address')
ON CONFLICT (id) DO UPDATE
SET
  job_id = EXCLUDED.job_id,
  row_number = EXCLUDED.row_number,
  status = EXCLUDED.status,
  error_reason = EXCLUDED.error_reason;

INSERT INTO vip_guests (
  id, concert_id, ticket_type_id, csv_import_job_id, email, phone, name, dedup_key, ticket_id, created_at
) VALUES
  (
    '222fa3b1-7fcb-4f1e-8f25-65fcbde5f001',
    '8a4c2d40-3a12-4b7d-b851-3b6e5de4c601',
    '6d6f0f4a-6d1d-42a4-9ac2-3bb74f0ac701',
    '111fa3b1-7fcb-4f1e-8f25-65fcbde5ef01',
    'vip1@ticketbox.local',
    '+84900000001',
    'VIP Guest One',
    'vip1@ticketbox.local',
    'dd8fa3b1-7fcb-4f1e-8f25-65fcbde5ec01',
    NOW()
  ),
  (
    '222fa3b1-7fcb-4f1e-8f25-65fcbde5f002',
    '8a4c2d40-3a12-4b7d-b851-3b6e5de4c601',
    '6d6f0f4a-6d1d-42a4-9ac2-3bb74f0ac701',
    '111fa3b1-7fcb-4f1e-8f25-65fcbde5ef01',
    'vip2@ticketbox.local',
    '+84900000002',
    'VIP Guest Two',
    'vip2@ticketbox.local',
    NULL,
    NOW()
  )
ON CONFLICT (id) DO UPDATE
SET
  concert_id = EXCLUDED.concert_id,
  ticket_type_id = EXCLUDED.ticket_type_id,
  csv_import_job_id = EXCLUDED.csv_import_job_id,
  email = EXCLUDED.email,
  phone = EXCLUDED.phone,
  name = EXCLUDED.name,
  dedup_key = EXCLUDED.dedup_key,
  ticket_id = EXCLUDED.ticket_id;

INSERT INTO ai_bio_requests (
  id, artist_id, requested_by, pdf_object_key, status, draft_content, failure_reason, created_at, updated_at
) VALUES
  (
    '333fa3b1-7fcb-4f1e-8f25-65fcbde5f101',
    '2c5d8d0f-3f58-4eb5-87ff-4fa0b622c501',
    '30100000-0000-0000-0000-000000000001',
    'ai-bio/the-neon-waves.pdf',
    'PUBLISHED',
    'Generated biography content for The Neon Waves.',
    NULL,
    NOW(),
    NOW()
  )
ON CONFLICT (id) DO UPDATE
SET
  artist_id = EXCLUDED.artist_id,
  requested_by = EXCLUDED.requested_by,
  pdf_object_key = EXCLUDED.pdf_object_key,
  status = EXCLUDED.status,
  draft_content = EXCLUDED.draft_content,
  failure_reason = EXCLUDED.failure_reason,
  updated_at = NOW();

COMMIT;
