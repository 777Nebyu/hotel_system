# YayeTech Hotel — Mobile App Implementation Plan (Detailed)

> Customer-facing React Native (Expo) app for the YayeTech Hotel Booking System.
>
> Sources:
> - `YayeTech_Hotel_System_7Week_Build_Plan_v5.pdf` (master plan — roadmap §8, MVP §4, stack §2, security §9, authz matrix §10)
> - Live backend audit of `apps/api/src/modules/**` controllers, DTOs and `packages/shared-types` Zod schemas
> - Code audit of `apps/mobile/src/**` (every screen read line-by-line)
>
> Status date: Aug 2026 · Stack: Expo SDK 54 / RN 0.81.5 / React 19.1 / TS 5.9 strict · ~1,113 LOC today

---

## Table of Contents

1. [Scope & Product Goals](#1-scope--product-goals)
2. [Alignment with the 7-Week Master Plan](#2-alignment-with-the-7-week-master-plan)
3. [Current State Audit](#3-current-state-audit)
4. [Defects & Gaps](#4-defects--gaps)
5. [Architecture & Conventions](#5-architecture--conventions)
6. [Navigation Map](#6-navigation-map)
7. [API Contract Reference](#7-api-contract-reference)
8. [Screen-by-Screen Specifications](#8-screen-by-screen-specifications)
9. [Shared Component Inventory](#9-shared-component-inventory)
10. [Phased Build Plan](#10-phased-build-plan)
11. [Testing Strategy](#11-testing-strategy)
12. [Accessibility & Performance Budgets](#12-accessibility--performance-budgets)
13. [i18n String Externalization](#13-i18n-string-externalization)
14. [Release Pipeline](#14-release-pipeline)
15. [Risks & Mitigations](#15-risks--mitigations)
16. [Out of Scope](#16-out-of-scope)
17. [Appendix: Environment & Scripts](#17-appendix-environment--scripts)

---

## 1. Scope & Product Goals

Mobile is the **customer surface only**: search → compare → book → pay → manage trips. Manager/admin tooling remains web-only (master plan §1.1).

End-to-end capabilities the app must ship:

| Capability | Master-plan reference |
|---|---|
| Registration, login, forgot/reset password, email verification notice, profile edit + photo | §4 Authentication & Accounts |
| Hotel search with city/country/rating/price/room-type/amenity filters + 4 sort orders | §4 Customer Experience |
| Hotel detail: photos, amenities, policies, rooms with live availability | §4 |
| Booking journey: dates → guests → promo code → quote → payment → confirmation email (server-side) | §4 Booking Engine |
| Payments: Credit Card, PayPal, Telebirr sim, CBE Birr sim, Cash at Hotel (mock gateway) | §4 Payments |
| Booking history (upcoming/past), detail, cancellation, PDF receipt download | §4 |
| Reviews: create/edit/delete, rating, comment, photos | §4 Reviews |
| Favorites/wishlist toggle everywhere hotels appear | §4 |
| Notifications: in-app list, unread badge, mark-read, push wiring | §4 Notifications |
| Production distribution: EAS Build → Play Internal Testing (+ TestFlight if Apple account) | §8 Week 7 |

**Prime directive (master plan §1.3):** pricing, availability and booking rules are computed *only* by the API. The app never recalculates prices or availability locally.

---

## 2. Alignment with the 7-Week Master Plan

| Week | Mobile commitment in master plan | Status | Evidence |
|---|---|---|---|
| W2 | Expo app shell, shared design tokens, login/register hitting Identity API | ✅ Done | `App.tsx`, `auth.tsx`, inline token styles |
| W3 | Hotel browsing, room detail, booking-flow screens (dates + guest info) | ⚠️ Mostly | Flow exists but **cannot complete reliably** (see D7) and has no payment step |
| W4 | Booking confirmation screen, push-notification wiring (Expo Notifications) | ❌ Missing | No confirmation UX; `expo-notifications` installed but never imported |
| W5 | Profile management, reviews, polish | ⚠️ Partial | Profile edit/password change done; review edit/delete/photos missing |
| W6 | Regression pass, accessibility/responsive QA; strings externalized for future i18next | ❌ Not started | No tests, no centralized copy |
| W7 | EAS production build → Google Play Internal Testing / TestFlight | ❌ Not started | No `eas.json`, no store assets |

---

## 3. Current State Audit

### 3.1 File inventory

```
apps/mobile/
├── index.ts                        (4 lines)   registerRootComponent(App)
├── app.json                                    slug yayetech-hotel · newArchEnabled · expo-secure-store plugin
├── package.json                                expo ^54, rn 0.81.5, react 19.1, expo-notifications (UNUSED), expo-secure-store
├── tsconfig.json                               extends expo/tsconfig.base, strict
└── src/
    ├── api.ts            (25 lines)   fetch wrapper + ApiError + API_URL from EXPO_PUBLIC_API_URL
    ├── auth.tsx          (41 lines)   AuthProvider: SecureStore session, restore-on-boot, 401→refresh→retry
    ├── types.ts          (74 lines)   hand-rolled interfaces (duplicates shared-types)
    ├── App.tsx          (165 lines)   AuthScreen + tab shell + state-machine navigation (Page union)
    ├── components/
    │   └── Shared.tsx    (43 lines)   Button, Card, Badge, StarRating, EmptyState, Loader
    └── screens/
        ├── SearchScreen.tsx        (133)   filters + paginated FlatList
        ├── HotelDetailScreen.tsx   (141)   hero image, thumbnails, amenities, room cards, favorite toggle
        ├── BookingFlowScreen.tsx   (137)   3-step wizard: dates → guests/promo → quote-confirm
        ├── BookingHistoryScreen.tsx (96)   list of /bookings/my
        ├── BookingDetailScreen.tsx (131)   summary, rooms, payment card, cancel, invoice link, review CTA
        ├── ReviewScreen.tsx         (65)   star input + comment → POST /reviews
        ├── FavoritesScreen.tsx      (90)   list of /favorites/my
        ├── NotificationsScreen.tsx  (99)   list + mark-all-read
        └── ProfileEditScreen.tsx   (100)   PATCH /auth/me (profile + password)
```

Typecheck (`pnpm --filter mobile check-types`, strict) passes.

### 3.2 Endpoint usage map (what each screen calls today)

| Screen | Calls | Auth handling |
|---|---|---|
| AuthScreen | `POST /auth/login`, `POST /auth/register` | public |
| auth.tsx | `POST /auth/refresh`, `POST /auth/logout`, SecureStore get/set/delete | mixed |
| SearchScreen | `GET /catalog/hotels?page&pageSize&city&minRating&priceMin&priceMax` | raw `request()` + optional token ⚠️ D5 |
| HotelDetailScreen | `GET /catalog/hotels/:id`, `POST\|DELETE /favorites/:hotelId` | raw `request()` ⚠️ D5 |
| BookingFlowScreen | `POST /bookings/checkout`, `POST /bookings` | `authorizedRequest()` ✓ |
| BookingHistoryScreen | `GET /bookings/my` | raw `request()` ⚠️ D5 |
| BookingDetailScreen | `GET /bookings/my` (then client-side find!), `POST /bookings/:id/cancel`, invoice via `Linking.openURL` 🔴 G2 | raw `request()` ⚠️ D5 |
| ReviewScreen | `POST /reviews` | `authorizedRequest()` ✓ |
| FavoritesScreen | `GET /favorites/my` | raw `request()` ⚠️ D5 |
| NotificationsScreen | `GET /notifications`, `POST /notifications/read-all` | raw `request()` ⚠️ D5 |
| ProfileEditScreen | `PATCH /auth/me` ×2 (profile, password) | `authorizedRequest()` ✓ |

### 3.3 What works well (keep)

- Session model: access+refresh+user persisted in SecureStore; restore-on-boot gate (`isRestoring`) prevents flash of login screen.
- `authorizedRequest()` implements exactly the interceptor behavior the master plan §2 assigns to Axios: attach JWT → on 401 rotate refresh → retry once.
- `api.ts` normalizes NestJS error envelopes (`{ message: string | string[] }`) into readable `ApiError`s.
- Navigation via a typed `Page` discriminated union — cheap to reason about, trivially replaceable later.
- Consistent slate/sky palette across all screens.

---

## 4. Defects & Gaps

### 4.1 Defects (fix before any feature work)

| ID | Severity | Defect | Location | Fix |
|---|---|---|---|---|
| D1 | 🔴 High | Search refetches **on every keystroke**: effect keyed on `[load]`; `load` identity changes whenever any filter state changes → one HTTP request per character typed | `SearchScreen.tsx:44-47` | Trigger loads explicitly (Search button / submit-on-keyboard / pagination / pull-to-refresh); optionally a 400 ms debounce |
| D2 | 🟠 Medium | `expo-notifications` dependency installed but never imported or configured | `package.json:16` | Wire up in Phase 3 (preferred) or remove |
| D3 | 🟢 Low | Unused imports `FlatList`, `Image`, `RefreshControl` | `App.tsx:3` | Delete |
| D4 | 🟠 Medium | `types.ts` re-implements shapes that live in `@repo/shared-types` (workspace dep already installed); duplicate `User` in `auth.tsx:5`; `any` at `types.ts:44,67` | `src/types.ts` | Re-export from shared-types; delete duplicates |
| D5 | 🔴 High | Five data screens use raw `request({token})` instead of `authorizedRequest()` → expired access token = hard error instead of silent refresh | Search, HotelDetail, BookingHistory, BookingDetail, Favorites, Notifications | Route through `authorizedRequest()` |
| D6 | 🟠 Medium | `.env.example` doesn't document `EXPO_PUBLIC_API_URL`; default silently targets `localhost:3001` which fails on real devices | `api.ts:1` | Document + friendly offline error state |
| D7 | 🔴 Blocker | **Booking creation violates the API contract**: `createBookingSchema` requires `guestInfos` array `min(1)` and `paymentMethod` defaults to `CREDIT_CARD`. Mobile sends `guestInfos` only when "guest full name" is non-empty → `400` otherwise; there's also no UI awareness that a CREDIT_CARD pending payment is auto-created | `BookingFlowScreen.tsx:55-58` vs `shared-types/src/booking.ts` | Always send `guestInfos` (default to signed-in user), pass chosen `paymentMethod` |
| D8 | 🔴 High | Invoice opened via `Linking.openURL(url)` with no token — `BookingController` is `@ApiBearerAuth()` class-wide, so the browser gets `401` | `BookingDetailScreen.tsx:50-59` | Authenticated download (`expo-file-system`) + share sheet (`expo-sharing`) |
| D9 | 🟡 Low | BookingDetail loads the entire `/bookings/my` list and finds one booking client-side; breaks once history exceeds one page | `BookingDetailScreen.tsx:22` | Backend lacks `GET /bookings/:bookingId` for customers — file a backend ticket; interim: accept current approach with scope filter |

### 4.2 Feature gaps vs. MVP

| ID | Gap | Backend readiness |
|---|---|---|
| G1 | **No payment step** after booking creation (intent + mock gateway unused) | Ready: `payments` module |
| G2 | Invoice download broken (D8) | Ready |
| G3 | Forgot/reset password UI absent | Ready: `POST /auth/forgot-password`, `/auth/reset-password` |
| G4 | Email verification notice + deep-link verify absent | Ready: `POST /auth/verify-email/:token` |
| G5 | Profile photo upload absent | Ready: `POST /auth/me/photo` (multipart) |
| G6 | Review edit/delete/photos absent; hotel page shows no reviews | Ready: `PATCH\|DELETE /reviews/:id`, `POST /reviews/:reviewId/photos`, `GET /hotels/:id/reviews` |
| G7 | Push notifications not wired; **backend has no device-token registry endpoint** — needs coordination | Partially blocked (backend ticket) |
| G8 | Free-text date inputs (`YYYY-MM-DD` typing) instead of a date picker | n/a |
| G9 | Search ignores supported params: `country`, `roomType`, `amenities`, `sort` (`price_asc\|price_desc\|rating_desc\|popularity`) | Ready per `searchHotelsSchema` |
| G10 | History has no upcoming/past split though API supports `?scope=upcoming\|past`; unread-count badge unused; single-notification tap-to-read unused | Ready |
| G11 | Hotel policies (`GET /hotels/:id/policies`: check-in/out times, cancellation, house/pet/child rules) not displayed | Ready |

---

## 5. Architecture & Conventions

### 5.1 Target folder structure

```
apps/mobile/
├── index.ts
├── app.json                     # + scheme "yayetechhotel" (deep links)
├── eas.json                     # Phase 6
├── .env.example                 # EXPO_PUBLIC_API_URL, EXPO_PUBLIC_MOCK_PAYMENT_SECRET (dev/staging only)
├── babel.config.js
└── src/
    ├── api.ts                   # keep fetch wrapper; add multipart helper + typed errors
    ├── auth.tsx                 # keep; User imported from shared-types
    ├── config.ts                # NEW: env parsing in ONE place (mirrors backend ConfigModule pattern, §3.2)
    ├── theme.ts                 # NEW: colors/spacing/radii/type tokens (single source for StyleSheet factories)
    ├── i18n/
    │   └── en.ts                # NEW: all user-facing strings, keyed (t('search.title'))
    ├── utils/
    │   ├── dates.ts             # NEW: UTC-safe YYYY-MM-DD format/parse/validate (checkOut > checkIn, past-block)
    │   └── money.ts             # NEW: display formatting only (never arithmetic)
    ├── hooks/
    │   ├── usePaginatedList.ts  # NEW: page/hasMore/loadMore/refresh shared logic
    │   └── useDebouncedValue.ts # NEW
    ├── components/              # Shared.tsx + Skeleton, ErrorBox, DateField, Stepper, RatingInput, Chip, Avatar, PaymentMethodPicker
    └── screens/                 # existing 9 + PaymentScreen, ForgotPasswordScreen, ResetPasswordScreen, MyReviewsScreen
```

### 5.2 Data-layer rules

1. **Every authenticated call goes through `authorizedRequest()`** (fixes D5 globally). Public catalog calls may use `request()`.
2. **No local pricing math.** Quote comes from `POST /bookings/checkout`; totals come from the booking record. Display formatting lives in `utils/money.ts`.
3. **Statuses are closed enums from shared-types:** `PENDING\|CONFIRMED\|CHECKED_IN\|CHECKED_OUT\|CANCELLED\|REJECTED` and `PENDING\|SUCCEEDED\|FAILED\|REFUNDED`. The UI renders them; it never invents transitions (mirrors backend state machine, master plan §7).
4. **Types come from `@repo/shared-types`** (`PaymentMethod`, `RoomType`, `HotelSort`, `CreateBookingInput`, …). Mobile-specific view models stay in `types.ts`.
5. **Errors:** every screen renders three states minimum — loading (skeleton/spinner), error (`ErrorBox` with Retry), empty (`EmptyState`). Network failures show "Cannot reach the server. Check your connection."
6. **Multipart uploads** (profile photo, review photos) go through a new `uploadFile()` helper in `api.ts` using `FormData` — no base64 payloads.

### 5.3 Session flow (unchanged, documented)

```
boot → SecureStore.read(session) ──hit──► setSession → SignedInApp
                                 └─miss─► AuthScreen
any authorizedRequest(): 401? → POST /auth/refresh {refreshToken}
                              ├─ ok → saveSession(new) → retry original once
                              └─ fail → saveSession(null) → AuthScreen
signOut: best-effort POST /auth/logout → clear SecureStore
```

---

## 6. Navigation Map

State-driven (existing `Page` union), extended:

```
AuthScreen (unauthenticated)
  ├─ login / register tabs
  ├─ ForgotPasswordScreen        NEW
  └─ ResetPasswordScreen         NEW (deep link yayetechhotel://reset?token=…)

SignedInApp (tab bar persists on all pages below)
  ├─ Explore tab
  │    SearchScreen
  │      └─ HotelDetailScreen(hotelId)          ← also target of Favorites tab
  │            ├─ BookingFlowScreen(hotelId, roomId)
  │            │     └─ PaymentScreen(bookingId)        NEW
  │            │           └─ ConfirmationScreen(bookingId)  NEW (or merged into Payment success state)
  │            └─ (reviews section inline, Phase 3)
  ├─ Bookings tab
  │    BookingHistoryScreen(scope tabs: upcoming|past)   G10
  │      └─ BookingDetailScreen(bookingId)
  │            ├─ cancel (status PENDING|CONFIRMED)
  │            ├─ download invoice (auth'd PDF share)
  │            ├─ pay now (if PENDING & unpaid)          NEW → PaymentScreen
  │            └─ write review (status CHECKED_OUT)
  │                  └─ ReviewScreen(hotelId, hotelName[, existingReview])  ← edit mode added
  ├─ Favorites tab → FavoritesScreen → HotelDetailScreen
  ├─ Alerts tab → NotificationsScreen → BookingDetailScreen(when payload.bookingId)
  └─ Profile tab
       ProfileEditScreen (fields, password, photo upload)
       MyReviewsScreen                                   NEW (edit/delete own reviews)
       sign out
```

Deep links to register in `app.json`: `yayetechhotel://reset?token=` (Phase 2), `yayetechhotel://verify?token=` (Phase 2), `yayetechhotel://booking/:id` (nice-to-have).

---

## 7. API Contract Reference

Verified against controllers and Zod schemas. All request bodies JSON unless noted. Errors follow NestJS envelope `{ statusCode, message: string|string[], error }`.

### 7.1 Identity — `/auth`

| Call | Body / Query | Returns | Notes |
|---|---|---|---|
| `POST /auth/register` | `{ fullName, email, password (8–72), phone? }` | Session `{ accessToken, refreshToken, user }` | passwordSchema: min 8 max 72 |
| `POST /auth/login` | `{ email, password }` | Session | |
| `POST /auth/refresh` | `{ refreshToken }` | fresh Session | rotation ⇒ persist the new pair every time |
| `POST /auth/logout` | – (Bearer) | – | fire-and-forget |
| `POST /auth/forgot-password` | `{ email }` | `{ message }` | always 200-style response (no user enumeration) |
| `POST /auth/reset-password` | `{ token, newPassword? }` *(confirm exact field names against identity.dto before coding)* | – | deep-link entry |
| `POST /auth/verify-email/:token` | – | – | deep-link entry |
| `GET /auth/me` | – (Bearer) | `User` | |
| `PATCH /auth/me` | `{ fullName?, phone? }` or `{ currentPassword, newPassword }` | `User` | two modes already used by ProfileEditScreen |
| `POST /auth/me/photo` | multipart `file` (Bearer) | `User` with `profilePhotoUrl` | Phase 2 |

Roles enum: `CUSTOMER \| STAFF \| MANAGER \| ADMIN`.

### 7.2 Catalog — `/catalog` (public)

| Call | Query/Params | Returns |
|---|---|---|
| `GET /catalog/countries` / `cities` / `amenities` | – | reference lists (needed for amenity chips + future filters) |
| `GET /catalog/hotels` | `city? country? priceMin? priceMax? minRating? roomType?(STANDARD\|DELUXE\|SUITE\|FAMILY\|EXECUTIVE) amenities?(csv) sort?(popularity\|price_asc\|price_desc\|rating_desc) page≥1 pageSize≤100` | `Paginated<HotelSummary>` |
| `GET /catalog/hotels/:id` | – | `Hotel` incl. `images[]`, `rooms[]` |
| `GET /catalog/hotels/:id/rooms` | `checkIn? checkOut?` (`availabilityWindowSchema`: YYYY-MM-DD, checkOut > checkIn) | rooms with window availability |
| `GET /catalog/rooms/:roomId` | – | `Room` |
| `GET /catalog/hotels/:id/policies` | – | `{ checkInTime?, checkOutTime?, cancellationHours?, cancellationPolicy?, houseRules?, childPolicy?, petPolicy? }` |

### 7.3 Booking — `/bookings` (Bearer)

| Call | Body | Returns | Notes |
|---|---|---|---|
| `POST /bookings/checkout` | `{ hotelId, roomIds[1..10], checkIn YYYY-MM-DD, checkOut YYYY-MM-DD, guests{adults 1-20, children 0-10}, promoCode?(3-20) }` | `BookingQuote` `{ hotel, nights, rooms[{roomId, roomNumber, nightly[], subtotal}], subtotal, discount, total, promoCode? }` | pure preview; checkOut > checkIn enforced server-side too |
| `POST /bookings` | checkout fields **plus required `guestInfos[1..50] {fullName, email?, phone?}`** and `paymentMethod` ∈ `CREDIT_CARD\|PAYPAL\|TELEBIRR\|CBE_BIRR\|CASH` (default CREDIT_CARD) | `Booking` (status PENDING, payment row created) | 🔴 mobile currently violates `guestInfos.min(1)` (D7) |
| `GET /bookings/my` | `?scope=upcoming\|past` | `Paginated<Booking>` | scope currently unused by app (G10) |
| `POST /bookings/:bookingId/cancel` | – | updated `Booking` (CANCELLED) | allowed for PENDING/CONFIRMED per state machine; refund triggered server-side if paid |
| `GET /bookings/:bookingId/invoice` | – | `application/pdf` stream | **Bearer-required** (class-wide `@ApiBearerAuth`) → D8 fix mandatory |

Booking statuses: `PENDING → CONFIRMED → CHECKED_IN → CHECKED_OUT`, plus `CANCELLED \| REJECTED`.

### 7.4 Payments — `/payments` (Bearer except mock callback)

| Call | Body | Returns | Notes |
|---|---|---|---|
| `GET /payments/my` | – | `Paginated<Payment>` | usable for profile "Payments" section (optional) |
| `POST /payments/:bookingId/intent` | `{ method, reference?(1-64) }` | payment intent record (`providerRef` reset to null, status PENDING) | rate-limit 60/min |
| `POST /payments/mock/:bookingId` | `{ reference?, transactionId?, message? }` + header `x-mock-payment-secret` | completed payment; booking → CONFIRMED; emits `PaymentCompleted` (email, invoice, audit) | **public** — this is the fake gateway's webhook. Mobile calls it directly ONLY in dev/staging using `EXPO_PUBLIC_MOCK_PAYMENT_SECRET` |
| `POST /payments/:bookingId/refund` | – | refunded payment | staff/manager/admin per authorization matrix — not a customer action |

Mock gateway determinism (keep adapters dumb per master plan §9.2): test card numbers decide approve/decline — confirm the convention from `payment.service.ts` during Phase 1 kickoff and encode it in the dev card form hints.

### 7.5 Reviews — `/reviews` (Bearer) & `/hotels/:id/reviews` (public)

| Call | Body | Notes |
|---|---|---|
| `POST /reviews` | `{ hotelId, bookingId?, rating 1-5, comment 2-2000, photos?: url[≤10] }` | eligibility enforced server-side (completed bookings only — authz matrix) |
| `GET /reviews/my` | `?page&pageSize` | powers MyReviewsScreen |
| `PATCH /reviews/:reviewId` | `{ rating?, comment?, photos? }` | owner-only |
| `DELETE /reviews/:reviewId` | – | owner-only |
| `POST /reviews/:reviewId/photos` | multipart files | returns URLs to merge into `photos` |
| `GET /hotels/:id/reviews` | `?page&pageSize` | public; includes `user.fullName` |

### 7.6 Favorites — `/favorites` (Bearer)

`GET /favorites/my` → `FavoriteHotel[]` · `POST /favorites/:hotelId` · `DELETE /favorites/:hotelId`.

### 7.7 Notifications — `/notifications` (Bearer)

`GET /notifications?page&pageSize` → `Paginated<Notification>` · `GET /notifications/unread-count` · `POST /notifications/:notificationId/read` · `POST /notifications/read-all`.

`Notification.payload` is untyped JSON — treat defensively (`payload?.bookingId ? navigate : noop`).

---

## 8. Screen-by-Screen Specifications

Format: purpose → data → states → interactions → **changes** (bold). All screens: loading/error/empty triad, safe-area respected, back affordance top-left.

### 8.1 AuthScreen (login/register)
- Fields: full name (register), email, phone (register, optional), password. Client validation mirrors shared schemas (email format, password ≥ 8).
- Submit disables while busy; errors surface via Alert with API `message`.
- Shows current `API_URL` footer (dev aid).
- **Changes (P2):** "Forgot password?" link → ForgotPasswordScreen; post-register banner "Verification email sent"; copy moved to i18n keys.

### 8.2 SearchScreen
- Filters: city text, min rating, price min/max; results: image, name, stars, location, from-price, review count; pagination via `onEndReached`; pull-to-refresh.
- **Changes (P0):** kill keystroke-refetch (explicit triggers only). **(P4):** add sort picker (4 options), room-type chips, amenity multi-select chips (from `GET /catalog/amenities`), country field; skeleton cards while first page loads; debounce optional enhancement.

### 8.3 HotelDetailScreen
- Hero + thumbnails, name/star/location/description, amenities badges, room cards (type, number, beds, capacity, price, Book button disabled unless `AVAILABLE`).
- Favorite toggle ❤️ present but initializes `false` unconditionally — **bug-ish:** doesn't reflect actual favorited state (no membership check against `/favorites/my`). **Change (P3):** hydrate initial state from favorites list or an `isFavorite` flag on Hotel payload (verify availability).
- **Changes (P3):** reviews section (`GET /hotels/:id/reviews`, paginated "load more"). **(P4):** policies card (check-in/out times, cancellation summary) via policies endpoint (G11). **(P1):** pass selected dates through to booking flow so availability-aware room query (`?checkIn&checkOut`) can be used.

### 8.4 BookingFlowScreen (wizard: dates → guests/promo → confirm)
- Quote card shows nights, subtotal, discount, total from server quote.
- **Changes (P0/P1):**
  1. Fix D7 — always send `guestInfos` (default: signed-in user's fullName/email; editable).
  2. Date pickers replace free-text (P4, but basic validation `checkOut > checkIn`, no past dates ships in P1).
  3. Guest steppers (− / +) with bounds from schema (adults ≤ 20, children ≤ 10).
  4. After `POST /bookings` → navigate **PaymentScreen(bookingId)** with chosen method; no more immediate "confirmed" alert (it isn't confirmed until paid, unless CASH).

### 8.5 PaymentScreen — NEW
- Props: `bookingId`, preselected method (optional).
- Method picker: Credit Card / PayPal / Telebirr / CBE Birr / Cash at Hotel (enum-exact labels).
- Flow per method:
  - **CASH:** informational confirm ("Pay at property") → done (booking stays PENDING until staff confirms — set expectation in copy).
  - **Card/PayPal/Telebirr/CBE (mock):** `POST /payments/{id}/intent {method}` → dev-only gateway form (card number, deterministic test PANs) → `POST /payments/mock/{id}` with `x-mock-payment-secret` → poll `GET /bookings/my?scope=upcoming` (or payments status via intent refresh) bounded 5×1 s until `CONFIRMED`.
  - Decline path → show gateway message, allow retry (re-intent is idempotent-ish: service resets intent to PENDING).
- Success state: big check, booking id, dates, total, buttons "View booking" / "Back to home".
- Secrets: `EXPO_PUBLIC_MOCK_PAYMENT_SECRET` only in dev/staging EAS profiles.

### 8.6 BookingHistoryScreen
- List with status badges, dates, total.
- **Changes (P0):** `authorizedRequest`. **(G10):** segmented control `Upcoming \| Past` mapping to `?scope=`; pull-to-refresh both scopes.

### 8.7 BookingDetailScreen
- Summary card (hotel, status badge, dates, id, total), rooms card, payment card, contextual actions.
- **Changes (P1):** authenticated PDF invoice via `expo-file-system.downloadAsync(url, { headers: { Authorization: Bearer }})` + `expo-sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' })`; Android fallback toast if no share target. "Pay now" button when `PENDING` && payment missing/`PENDING` → PaymentScreen. Cancel confirm retained. **(P3):** review CTA also offers "Edit your review" when one exists (needs `GET /reviews/my` lookup by hotelId).

### 8.8 ReviewScreen
- Star tapper + comment; submit `POST /reviews`.
- **Changes (P3):** edit mode (`initialReview` prop → `PATCH /reviews/:id`, title "Edit review"), photo attach (multi-pick ≤ 10 → `POST /reviews/:reviewId/photos`), delete with confirm (from MyReviewsScreen), validation messages from schema (comment 2–2000).

### 8.9 FavoritesScreen
- List of favorite hotels → HotelDetail.
- **Changes (P0):** `authorizedRequest`. **(P3):** unfavorite swipe/button with optimistic removal + rollback on failure.

### 8.10 NotificationsScreen
- List, relative time, payload-derived subtitle, mark-all-read.
- **Changes (P3):** unread visual state + tap → `POST /notifications/:id/read` → navigate to booking if `payload.bookingId`; Alerts tab badge = unread count (polled on focus; push later per G7).

### 8.11 ProfileEditScreen
- Full name/phone edit; password change (currentPassword + newPassword).
- **Changes (P2):** avatar row (tap → `expo-image-picker` single, aspect 1:1, quality 0.8 → multipart `POST /auth/me/photo` → update session user); email shown read-only; role badge; sign-out button relocated here with confirm.

### 8.12 ForgotPasswordScreen / ResetPasswordScreen — NEW (Phase 2)
- Forgot: email → `POST /auth/forgot-password` → success note ("If that address exists, we sent a link").
- Reset (deep-linked): new password + confirm, client-side ≥ 8 check → `POST /auth/reset-password` → Alert → back to login.

### 8.13 MyReviewsScreen — NEW (Phase 3)
- `GET /reviews/my` paginated; rows: hotel name, stars, excerpt, date; actions edit → ReviewScreen(edit mode), delete → confirm → `DELETE /reviews/:id`.

---

## 9. Shared Component Inventory

| Component | Props | Used by | Phase |
|---|---|---|---|
| `Button` (exists) | title, onPress, secondary, disabled, loading? | all | P0 add `loading` spinner prop |
| `Card` (exists) | children, style | all | – |
| `Badge` (exists) | label, variant(default/success/error/warning) | bookings, notifications | map all 6 booking statuses explicitly |
| `StarRating` (exists) | rating, size | search/detail/reviews | clamp 0–5 guard |
| `EmptyState` (exists) | title, subtitle | lists | – |
| `Loader` (exists) | – | – | superseded by skeletons |
| **`Skeleton`** | width, height, radius | search/history/detail | P4 |
| **`ErrorBox`** | message, onRetry | all | P0 (dedupe 3 inline copies) |
| **`DateField`** | label, value ISO, onChange, minDate | booking flow | P1 basic/P4 picker |
| **`Stepper`** | label, value, onChange, min, max | guests counters | P4 |
| **`Chip`** | label, selected, onPress | filters | P4 |
| **`RatingInput`** | value, onChange, size | review create/edit | P3 |
| **`Avatar`** | uri?, name, size | profile | P2 |
| **`MethodPicker`** | options(enum), value, onChange | payment | P1 |
| **`SectionHeader`** | title, action? | detail screens | P4 |

Design tokens (`theme.ts`): `colors` (slate scale + sky accents as currently hardcoded), `space` (4/8/12/16/20/24), `radius` (8/10/14/16), `text` (12/13/14/15/16/17/18/23/26 weights), exported and consumed via small StyleSheet factories — removes ~40 duplicated hex literals.

---

## 10. Phased Build Plan

### Phase 0 — Stabilize *(≈1 day)*

| # | Task | Files | Done when |
|---|---|---|---|
| 0.1 | Explicit-search triggering in SearchScreen (remove `[load]` auto-effect; keep pagination/refresh effects correct) | SearchScreen | typing 5-letter city fires ≤ 1 request |
| 0.2 | All screens → `authorizedRequest()` | 6 screens | expired token self-heals; no surprise sign-outs |
| 0.3 | Extract `ErrorBox`, add network-error copy, `.env.example` documenting `EXPO_PUBLIC_API_URL` | components, env | airplane-mode shows friendly retry, not raw stack |
| 0.4 | Types from `@repo/shared-types`; delete dup `User`; remove `any` | types.ts, auth.tsx | typecheck green; zero `any` |
| 0.5 | Dead import cleanup; `theme.ts` introduced opportunistically | App.tsx | lint-clean |
| 0.6 | Fix D7 contract violation: always send `guestInfos`, send `paymentMethod` | BookingFlowScreen | booking succeeds with defaults touched minimally |

**Gate:** typecheck ✓ · manual smoke: register → search → book reaches PENDING.

### Phase 1 — Booking + Payment lifecycle *(≈3 days)* — revenue path

| # | Task | Files | Done when |
|---|---|---|---|
| 1.1 | `PaymentScreen` (method picker, intent, mock-callback dev branch w/ secret header, poll-until-CONFIRMED, success/fail states, CASH branch) | screens/PaymentScreen.tsx, api.ts(secret header support) | phone-created booking ends CONFIRMED w/ SUCCEEDED payment; email arrives |
| 1.2 | Wire into flow + nav union; success screen | BookingFlowScreen, App.tsx | no premature "confirmed" alert |
| 1.3 | Authenticated invoice download + share sheet; graceful no-handler fallback | BookingDetailScreen | PDF opens from device share sheet |
| 1.4 | "Pay now" entry from BookingDetail for unpaid PENDING | BookingDetailScreen, nav | round-trip pay-after-create works |
| 1.5 | Basic date validation (order, past) even before full picker | utils/dates.ts | impossible to submit inverted ranges |
| 1.6 | Backend ticket filed: `GET /bookings/:bookingId` for customers (D9) | – | link in README known-issues |

**Gate:** happy path search→book→pay→CONFIRMED→invoice on Android emulator + iOS sim; decline-path retry works.

### Phase 2 — Account completeness *(≈2 days)*

Tasks: deep-link scheme + `forgot/reset` screens (2.1–2.2), verification banner + verify deep link (2.3), avatar upload + Avatar component + session user refresh (2.4). Done when recovery works end-to-end on staging and avatar persists across restart.

### Phase 3 — Engagement: reviews, favorites, notifications *(≈2 days)*

Tasks: hotel reviews section (3.1), review edit/delete + photos + RatingInput (3.2–3.3), MyReviewsScreen (3.4), favorites hydration fix + optimistic toggle everywhere (3.5), notification unread states/badge/tap-through (3.6), `expo-notifications` decision: wire foreground listeners behind flag OR remove dep — push blocked on backend device-token registry ticket (3.7). Done when a user can curate reviews and favorites entirely from the phone and alerts badge matches unread count.

### Phase 4 — Search & UX parity *(≈2 days)*

Tasks: DateField with native picker (`@react-native-community/datetimepicker`) (4.1), sort control + roomType/amenity chips + country field matching `searchHotelsSchema` (4.2), steppers (4.3), skeletons + SectionHeader polish (4.4), policies card on hotel detail (4.5), i18n extraction completion (§13). Done when every API search/sort capability is reachable from UI and no free-text dates remain.

### Phase 5 — Quality *(≈2 days)*

Unit tests (jest-expo) for `api.ts` normalization, refresh-retry, `utils/dates`, money display; Detox/E2E smoke of the revenue path; a11y audit per §12; performance pass per §12; offline regression checklist per screen. Done when CI green (typecheck + unit) and Detox smoke passes on emulator.

### Phase 6 — Release *(≈1–2 days)*

EAS init/profiles (dev/preview/production), build → Play Internal Testing (+ TestFlight if account), OTA channel setup, secrets matrix (§14), production smoke, README quick-start + known-issues update. Done when a real device installs from store track and completes a booking against production API.

**Total ≈ 13 working days**, front-loaded onto M1 exactly like master-plan Weeks 3–4.

---

## 11. Testing Strategy

Per master plan §2 ("mobile integration tests — Expo/Detox") scaled to solo reality:

| Layer | Tool | Scope |
|---|---|---|
| Unit | jest + jest-expo | pure modules only: `api.ts` (error envelope variants, header assembly, multipart), auth reducer logic extracted as pure fn, `utils/dates`, `money`, status→badge-variant mapper |
| Component | react-test-renderer (light) | ErrorBox/Skeleton/RatingInput render + callbacks |
| E2E smoke | Detox (Android emulator first) | login → search "Addis" → open hotel → book w/ test dates → mock-pay approve → assert CONFIRMED → cancel → assert CANCELLED |
| Manual regression | checklist doc | per-screen triad states, offline mode, token-expiry mid-session, deep links, tablet layout |

CI (GitHub Actions, monorepo already has `.github/`): job runs `pnpm --filter mobile check-types && pnpm --filter mobile test`. Device builds stay manual/EAS-cloud.

Priority test cases (unit):
1. `request` joins `message` arrays with `\n`, falls back to `Request failed (N)` on non-JSON body.
2. `authorizedRequest` retries exactly once after successful refresh; signs out on refresh failure.
3. `dates.rangeValid(checkIn, checkOut)` rejects inverted/equal/past.
4. Quote display uses server `total` verbatim (guard against accidental client math regressions).

---

## 12. Accessibility & Performance Budgets

**A11y**
- Every `Pressable` exposes `accessibilityRole`/`accessibilityLabel` (icon-only buttons: favorite heart, steppers).
- Contrast: current slate-on-slate-50 palette passes; verify `#64748b` small text on white ≥ 4.5:1 (borderline — bump to `#475569` for < 14 px).
- Allow default font scaling; no fixed-height text containers on list rows (use minHeight).
- Touch targets ≥ 44×44 pt (steppers/chips currently tight — fix in P4).

**Performance budgets**
- Search first paint (cached): < 300 ms interaction; uncached p75 API-bound.
- FlatLists: `keyExtractor` stable ids (present), images with fixed sizes (present), add `windowSize` tuning only if profiling demands.
- Zero requests on keystroke (enforced by 0.1); pagination requests ≤ 1 per threshold crossing (guard `loading` flag — present, keep).
- Bundle: no new heavy deps without justification; datepicker + image-picker + file-system/sharing are the sanctioned additions.

---

## 13. i18n String Externalization

Master plan §9.2: externalize from day one; translate later (i18next + English/Amharic are bonus-track).

- Create `src/i18n/en.ts` exporting nested keys (`auth.signin.title`, `search.filters.city`, `payment.method.CREDIT_CARD`…).
- Trivial consumer `t(key)` reading `en` (no library yet — swap-in point documented).
- Rule: no literal user-facing string in a screen after its phase lands; payment method labels derive from enum keys (`payment.method.${method}`).
- Plurals kept simple (`night(s)` pattern acceptable pre-i18next; noted for migration).

---

## 14. Release Pipeline

**EAS profiles**

| Profile | Purpose | Env | Distribution |
|---|---|---|---|
| development | dev client on device | `EXPO_PUBLIC_API_URL=http://localhost:3001`, secret set | internal install |
| preview | QA/internal dist | staging URL, secret set | Play Internal Testing |
| production | store build | prod URL, **no** mock secret | Play Internal Testing → prod track; TestFlight if Apple acct |

**Secrets matrix**

| Var | development | preview | production |
|---|---|---|---|
| `EXPO_PUBLIC_API_URL` | localhost | staging Render URL | prod custom domain |
| `EXPO_PUBLIC_MOCK_PAYMENT_SECRET` | ✔ | ✔ | ✖ (real gateway flow replaces it) |

Steps: version bump in `app.json` → `eas build --profile preview --platform android` → upload to Internal Testing → staged rollout after production smoke (login/search/book/pay/invoice) → tag release in repo. OTA: `eas update --branch production` for JS-only hotfixes; native changes require rebuild.

Store assets checklist: app name/short description/full description, 2+ phone screenshots per locale (search, hotel detail, booking summary), feature graphic 1024×500, privacy policy URL (required by Play), category Travel.

---

## 15. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Mock-payment secret embedded in client (preview/dev builds) | secret leak lets anyone forge completions **on staging only** | never in production profile; rotate staging secret routinely; production uses real gateway redirect where the callback is server-authenticated |
| Backend lacks customer `GET /bookings/:id` | detail page scales poorly | ticket D9; interim scope-filtered fetch |
| Push blocked on missing device-token registry | G7 slips | ship in-app notifications; feature-flagged foreground notifications; backend ticket raised in Phase 3 |
| Deep links need app.json scheme + testing on both platforms | reset-password UX broken on cold start | implement in P2 with explicit cold-start test |
| `searchHotelsSchema` evolves | filter drift | import schema types; integration-tested against Swagger/Postman collection (repo already exports one) |
| Date/timezone bugs (string dates, UTC boundaries) | wrong-night bookings | single `utils/dates.ts`, YYYY-MM-DD passthrough only, no local-time math |
| Solo-builder schedule risk (master plan §9.2 warns) | slipped weeks | phases gated; P1 revenue path first; bonus features remain cuttable |

---

## 16. Out of Scope

Manager/admin dashboards, reports/exports, coupon CRUD, user management, audit logs (web/admin only — authorization matrix reserves these roles off-mobile anyway: customers can't manage anything; STAFF/MANAGER tools live on web). Bonus features — translations beyond externalization, Maps, dark mode, loyalty, QR check-in — strictly post-M5 per master plan §5.

---

## 17. Appendix: Environment & Scripts

**Env vars** (documented in `.env.example`)

```
EXPO_PUBLIC_API_URL=https://your-api.onrender.com   # no trailing slash (api.ts strips one anyway)
EXPO_PUBLIC_MOCK_PAYMENT_SECRET=...                  # dev/staging profiles only
```

**Scripts** (`apps/mobile/package.json`)

```
pnpm start         # expo start
pnpm android / ios # platform starts
pnpm web           # metro web build
pnpm check-types   # tsc --noEmit   ← must stay green at every phase gate
```

**Planned script additions:** `"test": "jest"` (P5), `"lint"` if ESLint adopted (optional), EAS CLI used via `npx eas-cli` (P6).
