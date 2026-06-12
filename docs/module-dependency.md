# TicketBox Module Dependencies

This document establishes the boundaries for the NestJS Modular Monolith according to Blueprint Phase 0.

## Core Rules
1. **No direct database access across modules:** A module may NEVER import another module's `Repository` or `Entity`.
2. **Exported Services:** Modules must expose an Application Service (e.g. `OrdersService`) in their `exports` array to allow cross-module interaction.
3. **Ports & Adapters:** External services (Payment, Email, Object Storage, AI) use interfaces defined in `src/common/ports/`. Implementation adapters are injected at runtime.

## Module Graph

- **AuthModule**
  - Imports: `UsersModule` (to verify passwords via `UsersService`)
- **ConcertsModule**
  - Imports: `ArtistsModule`
- **OrdersModule**
  - Imports: `ConcertsModule`, `TicketTypesModule`
  - *Note: Creates the database transaction + pessimistic lock.*
- **PaymentsModule**
  - Imports: `OrdersModule`, `TicketsModule`, `NotificationsModule`
  - Uses: `PaymentPort` (`VnpayAdapter`)
- **CheckinModule**
  - Imports: `TicketsModule`
- **CsvImportModule**
  - Imports: `TicketsModule`, `NotificationsModule`
  - Uses: `ObjectStoragePort` (`MinioAdapter`), BullMQ `csv-import`
- **AiBioModule**
  - Uses: `ObjectStoragePort`, `AITextGenerationPort`, BullMQ `ai-bio`
- **NotificationsModule**
  - Uses: `NotificationPort` (`SendgridAdapter`), BullMQ `notifications`

## Enforcement
The above rules are enforced by the NestJS DI framework. Any attempt to inject an unauthorized provider will result in a runtime startup crash.
