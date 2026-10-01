# YayeTech Destination Discovery — Build Plan

**Status:** Implementation plan  
**Scope:** Customer discovery, hotel context, trips, navigation, grounded AI, Amharic, and content governance  
**Primary apps:** `apps/api`, `apps/mobile`, `apps/web`  
**Source of truth:** `PHASE_1_AND_2_IMPLEMENTATION_PLAN.md` and the verified-source rules in `YayeTech_Rules_and_Policies`

## 1. Product outcome

Build one connected journey:

`Destination → Hotels → Booking → Explore around hotel → Save places → My Trip → Navigate → Grounded AI guide`

A city is data, not code. Adding Gondar, Lalibela, Axum, Harar, or another destination must require verified records and media, not a new screen or route.

## 2. Current baseline

Already available:

- `Place`, `Source`, `EmergencyContact`, `Trip`, and `TripItem` Prisma models.
- Verified Discover APIs, nearby search, heritage search, source attribution, and emergency contacts.
- Trip ownership, date validation, AI confirmation, conflict detection, soft deletion, and reminders.
- Web Discover, emergency, trips, hotel neighborhood cards, and AI drawer.
- Mobile Discover map/list, destination cards, hotel cards, place details, trip save, navigation, and AI entry point.
- Noto Sans Ethiopic and persisted English/Amharic language switching on web.

The remaining work is organized below; do not rebuild the existing pieces.

## 3. Delivery phases

### Phase 0 — Freeze contracts and data policy (1–2 days)

1. Confirm route and response contracts in `packages/shared-types`.
2. Choose one canonical coordinate contract: `lat/lng` externally; keep distance calculations in kilometers.
3. Require `status = PUBLISHED`, non-null `sourceId`, and non-null verification metadata for public places.
4. Document allowed source/license values and OSM attribution (`© OpenStreetMap contributors`).
5. Define city onboarding checklist: city, country, verified description, coordinates, places, hotels, images, sources, and approval.

**Gate:** API, mobile, and web use the same DTO shapes; no unverified content is public or AI-visible.

### Phase 1 — Destination and hotel discovery (3–5 days)

1. Keep `GET /discover/destinations` and `GET /discover/destinations/:cityId` as the destination contract.
2. Add pagination and cache headers for destination lists and city details.
3. Add web city selection to `/discover`; preserve neighborhood/radius controls for the selected city.
4. Add mobile destination loading, retry, empty, and offline states.
5. Add city → hotels and city → places links on both clients.
6. Add place → nearby hotels using exact coordinates and a bounded radius.
7. Add reusable `PlaceCard`, `HotelCard`, `DestinationCard`, and `SourceBadge` components where duplication exists.

**Gate:** A customer can select a seeded city, view verified places and active hotels, open hotel details, and return without losing context.

### Phase 2 — Explore around hotel (2–4 days)

1. Add `GET /catalog/hotels/:hotelId/nearby` as a convenience endpoint backed by the same nearby service.
2. Support category filters: heritage, attraction, restaurant, café, culture, shopping, religious, photo, event, and nature.
3. Return distance, source, verification date, hours status, and optional visit duration.
4. Show “What’s around this hotel?” during booking without blocking room selection.
5. Add View and Navigate actions; navigation opens a device-supported map using exact coordinates.
6. Never display traffic or “leave by” estimates without a routing provider.

**Gate:** Hotel details and booking show the same nearby results for the same coordinates and radius.

### Phase 3 — PostGIS-ready geographic search (3–5 days)

1. Check Neon/local support for PostGIS before migration.
2. Add a reversible migration for geography points on hotels and places.
3. Backfill points from existing `lat/lng`, add spatial indexes, and verify invalid coordinates.
4. Implement `ST_DWithin`/`ST_Distance` queries behind the existing service interface.
5. Keep the current bounding-box + Haversine implementation as a tested fallback when PostGIS is unavailable.
6. Benchmark 1 km, 3 km, 5 km, and 15 km queries with realistic data volumes.

**Gate:** Results are distance-sorted, bounded, indexed, and identical within an agreed tolerance between PostGIS and fallback mode.

### Phase 4 — My Trip and Build My Day (4–6 days)

1. Automatically create or offer a trip after a confirmed booking; never create duplicate trips.
2. Add `POST /trips/:tripId/items` support for saved places and bookings.
3. Build a `Build My Day` flow with duration (2 hours, half day, full day, multiple days) and interests.
4. Generate a draft using hotel coordinates, published places, distance, opening hours, and visit duration.
5. Return a draft only; require explicit confirmation before writing AI-created items.
6. Display conflict warnings and preserve the user’s ability to edit, reorder, skip, or delete items.
7. Keep bookings independent from itinerary-item deletion.

**Gate:** A confirmed booking produces a usable private trip; a customer can build, edit, save, and reload a day plan.

### Phase 5 — Verified knowledge and grounded AI (5–8 days)

1. Add an approved knowledge-document model/migration with city/place links, source URL, verification status, verifier, date, and embedding metadata.
2. Add admin-only create/edit/approve/reject endpoints; customers cannot mutate content.
3. Index only `APPROVED` documents into pgvector/RAG.
4. Add contextual AI input: booked hotel, city, stay dates, selected place, nearby places, saved places, and trip items.
5. Add tools for nearby places, verified heritage, hotels, navigation links, and draft itinerary generation.
6. If approved knowledge is missing, return the fixed safe response: “I don't have enough verified information about this topic in YayeTech's knowledge base.”
7. Render grounded place cards and an explicit Confirm & Add / Dismiss draft card.

**Gate:** AI answers can be traced to approved records; fabricated historical facts are rejected in tests.

### Phase 6 — Content administration and onboarding (4–6 days)

1. Add admin screens for cities, places, sources, media, coordinates, and knowledge documents.
2. Add moderation states: draft, pending review, approved/published, rejected, archived.
3. Show verification date, verifier, source URL, license, and last editor.
4. Add coordinate validation and map preview before publication.
5. Add import/seed tooling that refuses rows without source attribution.
6. Onboard cities in this order: Addis Ababa, Hawassa, Gondar, Lalibela, Axum, Harar, Bahir Dar—only when verified data exists.

**Gate:** An admin can add a new city and publish its content without code changes.

### Phase 7 — Offline, performance, and accessibility (3–5 days)

1. Cache the current hotel, current city, last-viewed places, approved heritage summaries, saved places, emergency contacts, and current itinerary.
2. Use pagination/limits, lazy images, optimized lists, and request deduplication.
3. Load maps only when Map mode is selected.
4. Add explicit offline/poor-connection UI with stale-data timestamps.
5. Add Amharic labels and Ethiopic typography across all discovery/trip surfaces.
6. Verify touch targets, contrast, screen-reader labels, and keyboard/screen-reader web behavior.

**Gate:** Previously viewed trip and safety data remain usable with the API unavailable; no screen downloads all Ethiopian content at once.

## 4. API contract checklist

- `GET /discover/destinations?limit=`
- `GET /discover/destinations/:cityId`
- `GET /catalog/hotels/:hotelId/nearby?radiusKm=&category=`
- `GET /discover/places/:placeId`
- `GET /trips`, `POST /trips`
- `POST /trips/:tripId/items`, `PATCH`, `DELETE`
- `POST /trips/:tripId/build-day` (draft only)
- `GET/POST/PATCH /admin/knowledge-documents` (admin only)
- `POST /explore/ai/chat` may be an adapter; authorization remains in NestJS

All endpoints must validate IDs, enforce ownership/tenant scope, rate-limit AI, and return source/verification fields where content is public.

## 5. Test plan and release gates

### Unit/API

- Destination filtering excludes unpublished/unattributed records.
- City detail returns only active hotels and published places.
- Nearby distance ordering and radius boundaries.
- Trip ownership, date boundaries, conflicts, soft deletion, and AI confirmation.
- Knowledge retrieval excludes non-approved documents.
- Navigation URLs use exact stored coordinates.

### Mobile

- Destination list loading, retry, empty, and offline states.
- City → hotels → hotel details → place details.
- Map/list mode, category filters, Save, Navigate, and Ask AI.
- Amharic labels and compact-screen layout.

### Web/E2E

- Discover city selector and radius changes.
- Hotel neighborhood section and booking pre-discovery.
- Emergency printable card.
- Build My Day confirmation and conflict warning.
- Admin content approval to public Discover to AI response.

### Performance

- API p95 nearby query target: <300 ms with indexed data.
- Destination first contentful render: <2 s on a warm cache.
- No unbounded place/hotel query; every list has a maximum page size.
- Mobile memory/scroll test with at least 100 cards in paginated pages.

## 6. Recommended execution order

1. Phase 0 contracts and source policy.
2. Phase 1 destination UI/API completion.
3. Phase 2 hotel-neighborhood and booking integration.
4. Phase 3 PostGIS migration and benchmark.
5. Phase 4 automatic trips and Build My Day.
6. Phase 5 approved knowledge/RAG and contextual AI.
7. Phase 6 admin content workflow and city onboarding.
8. Phase 7 offline, performance, accessibility, and release testing.

Do not start city-wide content imports or AI itinerary generation before source attribution, approval states, ownership checks, and coordinate validation are in place.
