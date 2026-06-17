INSERT INTO artists (name, "shortBio", created_at, updated_at) VALUES ('Test Artist', 'Nghe si mau', NOW(), NOW());
INSERT INTO concerts (name, description, status, created_at, artist_id) VALUES ('Test Concert', 'Concert mau', 'PUBLISHED', NOW(), (SELECT id FROM artists LIMIT 1));
INSERT INTO ticket_types (concert_id, name, price, total_quantity, sold_quantity, held_quantity, created_at, updated_at) VALUES ((SELECT id FROM concerts LIMIT 1), 'Standard', 500000, 100, 0, 0, NOW(), NOW());
