# LuxSty Hotel — Mobile App
### Presentation Deck

---

## Slide 1 — Title

**LuxSty Hotel Mobile App**
Booking, managing, and running hotels — from your pocket.

- Built with **Expo / React Native**
- Works for **Guests, Managers, Staff, and Admins**
- Offline-friendly · Secure · Bilingual (English / አማርኛ)

---

## Slide 2 — What Is It?

A full hotel platform mobile app:

- **Guests** search hotels, book rooms, pay online, and review stays
- **Managers** run their hotels: bookings, rooms, pricing, staff, reports
- **Staff** check guests in/out and handle front-desk tasks
- **Admins** oversee the whole platform

> One app, four roles — the UI adapts to who signs in.

---

## Slide 3 — Tech Stack

| Layer | Technology |
|---|---|
| App framework | React Native + Expo (SDK 54) |
| Language | TypeScript |
| State | Redux Toolkit |
| Data fetching | TanStack React Query |
| Navigation | React Navigation |
| Backend | NestJS + PostgreSQL + Redis |
| Payments | Chapa · Telebirr · Card |

---

## Slide 4 — Guest Features

- 🔍 **Search & filter** — city, price, rating, amenities, dates
- 🏨 **Hotel & room details** — photos, availability calendar, policies
- 📅 **Booking flow** — dates → guests → review → pay (multi-step)
- 💳 **Payments** — Chapa checkout, Telebirr OTP, card, mock bank
- ❤️ **Favorites** — save hotels for later
- ⭐ **Reviews** — rate and comment after a stay
- 🔔 **Notifications** — booking status, offers, arrivals
- 🧾 **History** — upcoming/past bookings, invoices, payment history

---

## Slide 5 — Manager & Staff Features

**Manager**
- Dashboard: occupancy, revenue, arrivals/departures
- Booking management: confirm, reject, check-in/out, no-show
- Rooms: pricing, availability, operational status
- Staff accounts, reviews, billing, reports

**Staff**
- Front-desk queue: check-in / check-out
- Assigned-hotel data only (secure scoping)

---

## Slide 6 — App Structure

```
src/
├── screens/          # Guest screens + manager/ + admin/
├── components/       # Reusable UI (cards, badges, modals…)
├── navigation/       # Role-based navigators (Root, Tabs)
├── store/            # Redux slices: auth, booking flow, offline cache
├── hooks/            # React Query hooks, network status, theme
├── api.ts            # HTTP client with auto token refresh
└── locales/          # en.json, am.json (i18n)
```

~35 screens · ~40 reusable components

---

## Slide 7 — Authentication & Security

- Secure token storage (**expo-secure-store**)
- **Auto refresh** of access tokens — user never re-logs in mid-session
- Silent-logout **only** when the server rejects the session
  (network drops never sign you out)
- Role guards on every screen and API route
- Biometric app-lock option (fingerprint / face)
- Hotel-scoped access: managers/staff see only their hotels

---

## Slide 8 — Offline Support

- 📡 **Offline banner** — you always know your connectivity
- 💾 **Cached data** — hotels, bookings, notifications readable offline
- 🏷️ **"Showing saved data"** indicator — never mistake stale for fresh
- 🔁 **Auto-refetch** — everything refreshes the moment you reconnect
- 📝 **Draft saving** — booking checkout survives app restarts
- ❤️ **Safe actions** — blocked or explained when offline, never silent

---

## Slide 9 — Quality & Testing

- ✅ **TypeScript** — 0 errors (`tsc --noEmit`)
- ✅ **ESLint** — 0 errors
- ✅ **108 tests passing** (13 suites) — incl. offline + API auth tests
- ✅ **Backend 126 tests passing** (booking + catalog)
- ✅ Permissions verified: customer / manager / staff access rules

---

## Slide 10 — Performance

Measured against the live backend:

| Endpoint | p95 latency |
|---|---|
| Hotel search | **3 ms** |
| Booking list | **16 ms** |
| Manager dashboard | **19 ms** |
| Login (bcrypt ×12) | 302 ms |

- All DB queries use **indexes** — execution < 0.2 ms
- Stable under **10 concurrent users** (no slowdown)

---

## Slide 11 — Demo Flow

1. Sign in as guest → search "Addis" → open a hotel
2. Pick room & dates → review → pay (Chapa / Telebirr)
3. See booking in **History** → open invoice
4. Turn on **airplane mode** → browse cached data → see banner
5. Turn wifi back on → data auto-refreshes
6. Switch to **Manager** login → dashboard → confirm a booking

---

## Slide 12 — Summary

**What we built**
- A complete hotel app for all 4 roles
- Secure auth with smooth token refresh
- True offline support with clear indicators
- Polished UX: dark mode, i18n, accessibility
- Verified: types ✅ lint ✅ 234 tests ✅ fast APIs ✅

**Thank you — questions?**
