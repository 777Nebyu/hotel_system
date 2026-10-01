# YayeTech — Roadmap & Future Work (Beyond Hotel Booking)

Purpose: keep the "Ethiopia travel super-app" vision, but separate what is **built or designed now** from what is **next** and what is **later**, with the prerequisites each later piece needs. Rule IDs continue the existing catalog (`TRIP-###`).

---

## 1. Vision and Differentiator

Six pillars, one assistant across all of them:

| Pillar | Contains |
|---|---|
| **Stay** | Hotels, rooms, booking, payments, reviews |
| **Discover** | Nearby places, restaurants, coffee, heritage/history, events |
| **Experience** | Tours, guides, activities, transport, car rental |
| **Plan** | Itinerary, reminders, budget, AI planner |
| **Travel** | Maps, offline, emergency info, airport info |
| **Connect** | Reviews, favorites, stories, community |

Other Ethiopian travel apps already advertise most of these categories, so feature count is not the advantage. The advantage is **depth of integration around the traveller's real stay**: the assistant knows which hotel you booked, what is within walking distance, what the approved sources say about a place, and what is on your plan tomorrow — and it answers only from verified data.

Product rule for every phase: **nothing reaches users unless it has an owner, a source, and (where needed) a licence.**

---

## 2. Status by Pillar

| Pillar / feature | Status | Notes |
|---|---|---|
| Stay: search, booking, payment (mock), cancellation, reviews, favorites | **Built / specified** | Core of the platform; rule catalog `BOOK`, `PAY`, `REFUND`, `REVIEW`, `FAV` |
| Discover: nearby places + heritage with sources | **Designed** | `YayeTech_Nearby_Discover_FINAL.md` |
| Assistant: text + voice, tool-based, tenant-isolated | **Designed** | AI platform docs, `AI-001`–`AI-045` |
| Plan: My Trip (saved places + day list) | **Next** | §4 |
| Plan: reminders | **Next** | Reuses the existing job queue + push setup |
| Travel: emergency information | **Next** | Built on existing places data + verified contacts |
| Multilingual: Amharic | **Next** | After native-speaker testing |
| Restaurant/coffee "reservation" | Later | Needs restaurant partners |
| Experience: guides, tours, events | **Later** | Partner marketplaces (§5) |
| Flights, car rental, rides | **Later** | Airline/fleet/driver partners + regulation |
| Wallet | **Later** | Regulatory review first |
| Community / social | **Later** | Needs moderation |
| Offline maps, 360° media | **Later** | Map licensing, content production |

---

## 3. Phases

| Phase | Goal | Contents | Exit condition |
|---|---|---|---|
| **1 — Core** | A working, trustworthy hotel platform | Stay + Discover (nearby, heritage) + text/voice assistant | Verification checklist passes; nearby data reviewed and published for Addis Ababa |
| **2 — Trip companion** | Keep users in the app during the stay | My Trip, reminders, emergency info, saved places, Amharic | Trip items and reminders work end to end; emergency info verified |
| **3 — Partner marketplace** | Add supply from partners, one category at a time | Tours/experiences → guides → events → restaurant reservations | 5–10 real partners live in one category before starting the next |
| **4 — Platform** | Deeper travel services | Flights, car rental, transport, wallet, community, offline maps | Each starts only after its prerequisites (§5) are met |

Order inside Phase 3 by lowest regulatory burden and easiest partner onboarding, not by how exciting the feature sounds.

---

## 4. Phase 2 Design — My Trip, Reminders, Emergency Info

### 4.1 Data model (minimal)

```sql
CREATE TABLE trips (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id),
  title       TEXT NOT NULL,
  hotel_id    UUID REFERENCES hotels(id),        -- optional link
  booking_id  UUID REFERENCES bookings(id),      -- optional link
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL CHECK (end_date >= start_date),
  timezone    TEXT NOT NULL DEFAULT 'Africa/Addis_Ababa',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);

CREATE TABLE trip_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id       UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  day_date      DATE NOT NULL,
  start_time    TIME,
  duration_min  INTEGER CHECK (duration_min > 0),
  item_type     TEXT NOT NULL CHECK (item_type IN ('place','booking','custom')),
  place_id      UUID REFERENCES places(id),
  booking_id    UUID REFERENCES bookings(id),
  title         TEXT NOT NULL,
  notes         TEXT,
  cost_amount   NUMERIC(10,2),
  currency      TEXT,
  status        TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','done','skipped')),
  position      INTEGER NOT NULL DEFAULT 0,
  created_by    TEXT NOT NULL DEFAULT 'user' CHECK (created_by IN ('user','ai')),
  CHECK (item_type <> 'place'   OR place_id   IS NOT NULL),
  CHECK (item_type <> 'booking' OR booking_id IS NOT NULL)
);
CREATE INDEX trip_items_trip_day_idx ON trip_items (trip_id, day_date, start_time);

CREATE TABLE emergency_contacts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city             TEXT,                       -- NULL = national
  hotel_id         UUID REFERENCES hotels(id), -- hotel-specific contact
  kind             TEXT NOT NULL,              -- POLICE | AMBULANCE | FIRE | HOTEL | EMBASSY | OTHER
  name             TEXT NOT NULL,
  phone            TEXT NOT NULL,
  source_id        UUID NOT NULL REFERENCES sources(id),
  last_verified_at TIMESTAMPTZ NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending_review'
);
```

Deliberately small: a trip is a list of dated items that point at places, bookings, or free text. No "universal listing" table — flights, guides and events get their own tables when they are built.

### 4.2 Reminders

| Reminder | Phase 2? | How |
|---|---|---|
| Check-in / check-out reminder | Yes | Already planned (`NOTIF-001`) |
| Trip-item reminder ("Museum visit in 30 min") | Yes | Scheduled job per item on the existing queue |
| Schedule conflict ("these two overlap") | Yes | Overlap check on `trip_items` for the same day at save time |
| Flight reminder | Partly | User enters flight time manually as a custom item; no flight data integration |
| "Leave now to arrive by 10:00" | **No** | Needs real travel-time data (routing service); until then never imply travel time |
| Event reminder | Later | Needs the events pillar |

### 4.3 Emergency information

Built from existing data: places with categories `HOSPITAL`, `CLINIC`, `PHARMACY`, `EMERGENCY` near the hotel (published only), plus a small **curated** `emergency_contacts` table. Phone numbers are safety-critical: every number must be verified against an official source before publishing, carry `last_verified_at`, and be re-checked on a schedule. The assistant may only read emergency numbers from this table, never from model knowledge. For anything medical it gives the verified contacts and directions to the nearest published facilities and does not attempt advice.

### 4.4 Assistant tools for Phase 2

- `getMyTrip` — read the caller's own trip (ownership from context, `RBAC-005` pattern).
- `addTripItem` / `removeTripItem` — state-changing; on voice, require on-screen confirmation (`AI-035`); items created this way are marked `created_by = 'ai'` so users can see what was suggested.
- "What should I do tomorrow?" = trip items + nearby published places + their opening hours (labelled "hours may vary" when unverified, `PLACE-010`).

---

## 5. Prerequisites for Later Pillars

Nothing here is a code blocker; each one is a business, legal or content prerequisite.

| Pillar | Needs before starting |
|---|---|
| **Tours & experiences** | Operator partners; inventory/capacity model; cancellation and refund terms per operator; payout process |
| **Guides** | Verification process (identity, licence/registration with the relevant tourism authority as required); availability + booking; in-app chat with moderation and reporting; dispute path (`DISPUTE`) |
| **Events** | Organizer onboarding; ticketing with QR check-in; capacity control; refund policy; date/time accuracy |
| **Restaurant reservations** | Restaurant partners and a way to receive bookings (dashboard or notification) |
| **Flights** | Airline or aggregator API/agent arrangement; passenger personal data handling; ticketing and refund rules; payment flow |
| **Car rental** | Fleet partners; insurance, deposit, driver-document checks; pickup/drop-off logistics |
| **Rides / transport** | Driver onboarding and verification; safety and incident process; live tracking; check local transport regulation |
| **Wallet** | Regulatory review **before design** — holding customer funds may require a licence or a licensed partner; KYC; reconciliation. Safer first step: keep using payment gateways and show a payment *history*, not stored value |
| **Community / social** | Moderation tooling, reporting, content policy, privacy defaults, minors' considerations |
| **Offline** | Start with offline trip, saved places and emergency info. Offline *maps* need a map provider or own tiles — bulk-downloading from OpenStreetMap's public tile servers is not allowed |
| **360° / video** | Content production, storage and bandwidth cost, upload moderation |
| **More languages** (Oromo, Tigrinya, Somali) | Translators and native-speaker review; test AI output and voice quality per language before offering it |

**Marketplace cold start:** every partner category is a two-sided market. Launch each with a handful of real, verified partners in Addis Ababa rather than empty screens.

---

## 6. Rules

| ID | Rule |
|---|---|
| TRIP-001 | A trip and its items belong to one user; every read/write checks `trip.user_id = caller` (`RBAC-005`). |
| TRIP-002 | Trips are private by default. Sharing (later) is opt-in and never exposes payment details or booking references. |
| TRIP-003 | A `place` item must reference a published place; a `booking` item must reference one of the caller's own bookings. |
| TRIP-004 | Item dates must fall within the trip's date range; times are interpreted in the trip's timezone (`TIME-002`). |
| TRIP-005 | Overlapping timed items on the same day produce a visible warning; the user decides whether to keep both. |
| TRIP-006 | Reminders are scheduled jobs, created/updated/cancelled with the item; a change never produces duplicate reminders (`NOTIF-004`). |
| TRIP-007 | No travel-time or "leave by" advice is shown unless computed by a routing service (`PLACE-009`). |
| TRIP-008 | AI-created items are marked `created_by = 'ai'`; on voice they require on-screen confirmation before saving (`AI-035`). |
| TRIP-009 | Deleting a trip is a soft delete; deleting a booking-linked item never affects the booking itself. |
| TRIP-010 | Emergency contacts are published only when verified against an official source and carry `last_verified_at`; stale ones are flagged for re-verification. |
| TRIP-011 | The assistant reads emergency numbers only from `emergency_contacts`, never from model knowledge. |
| TRIP-012 | Offline copies contain only what the user needs (itinerary, saved places, emergency info); no tokens, payment details or other users' data. |
| ROAD-001 | A new content or partner category launches only with an identified owner, a recorded source/licence, and a review step before publication. |
| ROAD-002 | A new pillar gets its own tables and rules; no "universal listing" shortcut is built ahead of need. |

---

## 7. Priority View

| Feature | User value | Effort | Risk | When |
|---|---|---|---|---|
| Nearby + heritage | High | Medium | Licensing | Phase 1 |
| Assistant (text) | High | Medium | Data accuracy | Phase 1 |
| Voice | Medium | Medium | Amharic quality, cost | Phase 1 (English) / 2 (Amharic) |
| My Trip + reminders | High | Low–Medium | Low | Phase 2 |
| Emergency info | High | Low | Wrong numbers | Phase 2 |
| Amharic | High | Medium | Translation quality | Phase 2 |
| Tours / guides / events | Medium–High | High | Partners, trust | Phase 3 |
| Flights, cars, rides | Medium | Very high | Regulation, partners | Phase 4 |
| Wallet | Medium | Very high | Financial regulation | Phase 4 |
| Community | Low–Medium | High | Moderation | Phase 4 |

---

## 8. For the Project Report

Present the work in three honest tiers:

- **Implemented and tested:** the parts that are actually built and verified in the repository (booking, payments, auth/RBAC, mobile app, whatever else passes your checklist).
- **Designed and specified:** Nearby/Discover, the AI assistant and voice, the rule catalog, and Phase 2 (My Trip, reminders, emergency info) — with the design documents as evidence.
- **Future work:** Phases 3–4 with their prerequisites, framed as a deliberate scoping decision ("marketplace and regulated services need partners and licences, so they follow the core") rather than missing features.

Do not describe unbuilt features as implemented, and do not claim Amharic voice or any provider capability that has not been tested. A clear scope boundary with reasons is a strength in a report.

---

## 9. Open Decisions

- Which Phase 3 category first (tours, guides, or events) — depends on which partners you can actually sign.
- Whether the wallet is dropped in favour of a payment-history view.
- Whether Managers may propose places/contacts for their area (Admin approves).
- Which routing provider, if any, to add so "leave now" reminders can exist.
- Which languages after Amharic, and who reviews them.