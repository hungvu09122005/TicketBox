# TicketBox Sample Object Files

This folder contains sample object-storage files aligned with the TicketBox blueprint and project spec.

## Contents

- `seat-maps/`: interactive SVG seat maps for GA, SVIP, VIP, CAT1, and CAT2 zones.
- `guest-lists/`: CSV files sent by sponsors for VIP guest-list import jobs.
- `press-kits/`: sample PDF press kits for AI Artist Bio processing, including dedicated `ARTIST` and `CONCERT` test files.
- `metadata/manifest.json`: object keys and suggested mappings to TicketBox entities.

## Suggested Object Keys

Use these paths as object keys when seeding MinIO/S3 or when testing upload flows:

- `seat-maps/*.svg` -> `seat_zones.svg_object_key`
- `guest-lists/*.csv` -> `csv_import_jobs.object_key`
- `press-kits/*.pdf` -> `ai_bio_requests.pdf_object_key`

## AI Bio Test PDFs

Use these files when testing the AI bio upload flow manually:

- `press-kits/artist-ai-bio-test.pdf` for `targetType = ARTIST`
- `press-kits/concert-ai-bio-test.pdf` for `targetType = CONCERT`

The CSV files include valid rows, duplicate rows, and malformed rows so the CSV import flow can exercise success, duplicate-skip, and error handling.
