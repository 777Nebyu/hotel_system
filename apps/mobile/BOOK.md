# YayeTech Hotel Booking App — Complete Booking & Cancellation Lifecycle

Design a complete, production-quality **mobile hotel booking experience** for YayeTech.

The application must represent the real YayeTech booking lifecycle and cancellation/refund lifecycle described below.

The UI must remain simple for customers even though the underlying business logic is sophisticated.

The design should feel like a premium modern hotel/travel app, not an ERP system.

---

# 1. CORE DESIGN PRINCIPLE

The customer should experience:

SEARCH
↓
SELECT ROOM
↓
HOLD ROOM
↓
PAY
↓
CONFIRMATION
↓
CHECK-IN
↓
STAY
↓
CHECK-OUT
↓
REVIEW

Or:

BOOKING
↓
CANCEL
↓
REFUND
↓
SETTLEMENT

Never expose unnecessary technical complexity to the customer.

The interface should clearly communicate:

* Current booking status
* What happens next
* Payment status
* Cancellation eligibility
* Refund status
* Check-in/check-out information
* Available actions

---

# 2. BOOKING STATE MACHINE

The application follows this state machine:

PENDING
↓
CONFIRMED
↓
CHECKED_IN
↓
CHECKED_OUT

Alternative transitions:

PENDING → CANCELLED

CONFIRMED → CANCELLED

CONFIRMED → NO_SHOW

Cash-at-Hotel exception:

CASH AT HOTEL
↓
CONFIRMED
↓
CHECKED_IN
↓
CHECKED_OUT

Cash-at-Hotel bookings skip PENDING.

---

# 3. REFUND STATE MACHINE

Cancellation and refund are separate lifecycles.

BOOKING
↓
CANCELLED
↓
Refund evaluation
↓
REFUND REQUESTED
↓
REFUND PROCESSING
↓
REFUND COMPLETED

Alternative:

REFUND PROCESSING
↓
REFUND FAILED
↓
ADMIN FOLLOW-UP

Cash-at-Hotel unpaid:

CANCELLED
↓
REFUND NOT APPLICABLE

Non-refundable booking:

CANCELLED
↓
NO REFUND

Never display "Refunded" until the refund provider actually reports successful settlement.

---

# 4. MOBILE DESIGN STYLE

Create a premium hotel application.

Use:

* Deep hotel blue / navy primary
* White
* Soft neutral backgrounds
* Dark navy typography
* Soft gray secondary text
* Green for successful states
* Amber for pending states
* Blue for active stay
* Red for destructive/cancellation states
* Neutral gray for completed states
* 12–16px rounded cards
* High-quality hotel photography
* Generous whitespace
* Clean icons
* Subtle shadows
* Minimal animation

Avoid:

* ERP appearance
* Desktop tables
* Dense information
* Excessive gradients
* Excessive glassmorphism
* Neon styling
* Huge navigation menus
* Complicated dashboards

---

# 5. CUSTOMER NAVIGATION

Use exactly four primary destinations:

HOME

BOOKINGS

SAVED

PROFILE

Bottom navigation:

Home
Bookings
Saved
Profile

The booking process itself should NOT use the bottom navigation.

During checkout/booking, focus the user on the current task.

---

# 6. HOME — START BOOKING

The Home screen should immediately allow the customer to search.

Header:

YayeTech

Notification icon

Greeting:

"Good morning"

Headline:

"Find your perfect stay"

Booking search card:

Location / Hotel

Check-in

Check-out

Guests

Rooms

Primary CTA:

CHECK AVAILABILITY

Below:

Featured Rooms

Popular Rooms

Hotel Amenities

Special Offers

Do not require login merely to browse.

---

# 7. SEARCH FLOW

The customer selects:

Check-in

Check-out

Adults

Children

Rooms

Validate occupancy against room capacity.

If occupancy exceeds room capacity:

Show:

"This room cannot accommodate the selected guests."

Allow the user to modify guest count.

Never silently change the guest count.

---

# 8. AVAILABLE ROOMS

Show:

Selected dates

Number of guests

Number of rooms

"Modify Search"

Room cards.

Each room card:

Room image

Room name

Rating

Bed type

Guest capacity

Room size

Amenities

Availability

Price/night

Total stay price

CTA:

VIEW ROOM

Availability labels:

Available

Only 1 left

Sold out

Always use the latest server availability.

Search availability is provisional.

---

# 9. ROOM DETAIL

Create a premium room detail screen.

Top:

Back

Favorite

Image gallery

Room name

Rating

Room size

Bed

Guest capacity

Amenities

Description

Cancellation policy

Hotel policies

Check-in time

Check-out time

Pricing

"$85 / night"

"$255 total"

Primary sticky CTA:

BOOK THIS ROOM

---

# 10. BOOKING FLOW

When the user taps:

BOOK THIS ROOM

start the booking process.

The UI should visually communicate that the room is temporarily being held.

Show:

"Securing your room..."

Then:

"Room held"

"Complete your booking before the hold expires."

Display a subtle countdown when appropriate.

Example:

"Room reserved for 09:42"

Do not make the countdown stressful or visually dominant.

---

# 11. ROOM HOLD

The room hold begins after the required guest information is submitted according to the YayeTech booking rules.

The hold protects the room during checkout/payment.

Show:

Room

Dates

Guests

Price

Hold expiration

Payment method

The hold is temporary.

If the customer abandons the process:

Hold expires automatically.

Room becomes available again.

Show appropriate messaging:

"Your room hold has expired."

[ SEARCH AVAILABLE ROOMS ]

---

# 12. PAYMENT

Show payment methods as clean selectable cards.

Possible methods:

Card

Telebirr

CBE Birr

PayPal

Cash at Hotel

The interface must clearly distinguish:

ONLINE PAYMENT

and

PAY AT HOTEL

---

# 13. CASH-AT-HOTEL EXCEPTION

If the customer selects:

PAY AT HOTEL

DO NOT create a PENDING state.

Instead:

Booking Created
↓
CONFIRMED

Show immediately:

✓ Booking Confirmed

Payment:

"Pay at hotel"

Message:

"You can pay at the hotel during your stay."

Timeline:

✓ Booking Confirmed
│
○ Check-in
│
○ Check-out

Do not show:

"Payment pending"

Do not show:

"Waiting for confirmation"

---

# 14. ONLINE PAYMENT

For electronic payment:

Booking Created
↓
PENDING
↓
Payment
↓
CONFIRMED

During payment:

Show:

"Processing payment..."

Disable duplicate submission.

Never allow the user to accidentally create multiple bookings by tapping repeatedly.

If payment succeeds:

✓ Payment successful

✓ Booking confirmed

If payment fails:

Payment failed.

The room hold should be released according to the backend rules.

Offer:

[ TRY AGAIN ]

[ CHANGE PAYMENT METHOD ]

Do not leave the user with a confusing PENDING booking after a definitive payment failure.

---

# 15. CONCURRENCY FAILURE

The final availability decision occurs under a server-side transactional lock.

If another customer books the room first:

Show:

"Sorry, this room was just booked by another guest."

Do NOT show a generic technical error.

Actions:

[ VIEW OTHER ROOMS ]

[ MODIFY SEARCH ]

Release the hold appropriately.

---

# 16. PRICE CHANGE

The server is the source of truth for pricing.

If price changes between search and payment:

Show a clear price-change confirmation.

Example:

"Room price updated"

"Because the price changed, please review the updated total before continuing."

Show:

Previous price

New price

Updated total

CTA:

[ ACCEPT NEW PRICE ]

[ GO BACK ]

Never silently charge the new amount.

---

# 17. FINAL REVIEW

Before final confirmation, show:

ROOM

Room image

Room name

DATES

Check-in

Check-out

Number of nights

GUESTS

Adults

Children

Rooms

GUEST

Name

Email

Phone

PRICE

Room subtotal

Taxes

Discount

Coupon

Total

PAYMENT

Payment method

CANCELLATION POLICY

Refund eligibility

Hotel policies

Primary CTA:

CONFIRM & PAY

or

CONFIRM BOOKING

for Cash-at-Hotel.

---

# 18. CONFIRMATION

After successful booking:

Display a beautiful success screen.

✓

BOOKING CONFIRMED

"Your reservation is ready."

Show:

Booking number

Hotel

Room

Dates

Guests

Total

Payment status

QR code

Buttons:

[ VIEW BOOKING ]

[ SHOW QR ]

[ ADD TO CALENDAR ]

[ DOWNLOAD INVOICE ]

The invoice should reflect the locked price snapshot.

---

# 19. BOOKING PRICE SNAPSHOT

Once a booking is confirmed:

The customer's booked price is locked.

Later hotel price changes must NOT change the existing booking.

In the UI:

Show the original booking price.

Do not dynamically replace it with today's room price.

Example:

Booked at:

"$255"

Current room price:

"$285"

The booking still displays:

"$255"

---

# 20. BOOKING TIMELINE COMPONENT

Create a reusable BookingTimeline component.

CONFIRMED:

✓ Booking Confirmed
│
○ Check-in
│
○ Check-out

CHECKED_IN:

✓ Booking Confirmed
│
✓ Checked In
│
○ Check-out

CHECKED_OUT:

✓ Booking Confirmed
│
✓ Checked In
│
✓ Checked Out

CANCELLED:

✓ Booking Confirmed
│
✕ Booking Cancelled

The timeline must dynamically adapt to the current booking state.

---

# 21. MY BOOKINGS

Create:

Upcoming

Past

Cancelled

Booking cards.

Each card contains:

Room image

Room name

Hotel

Dates

Guests

Booking number

Status

Price

Primary CTA:

VIEW DETAILS

No tables.

---

# 22. PENDING BOOKING CARD

Show:

🟡 PENDING

"Payment required"

Booking number

Room

Dates

Price

Actions:

[ COMPLETE PAYMENT ]

[ VIEW DETAILS ]

[ CANCEL ]

If payment has failed definitively, reflect the appropriate result instead of misleadingly keeping the booking as pending.

---

# 23. CONFIRMED BOOKING CARD

Show:

🟢 CONFIRMED

Room

Dates

Guests

Booking number

Price

Actions:

[ VIEW DETAILS ]

[ QR CODE ]

[ CANCEL ] if policy allows

---

# 24. CHECKED-IN BOOKING

Show:

🔵 CHECKED IN

"You're currently staying with us."

Show:

Room number

Room

Hotel

Check-out date

Check-out time

Actions:

[ HOTEL SERVICES ]

[ CONTACT RECEPTION ]

[ VIEW DETAILS ]

Do not normally show cancellation.

---

# 25. CHECKED-OUT BOOKING

Show:

⚪ CHECKED OUT

"Stay completed"

Show:

Room

Dates

Final price

Invoice

Actions:

[ VIEW RECEIPT ]

[ DOWNLOAD INVOICE ]

[ LEAVE REVIEW ]

---

# 26. NO-SHOW

NO_SHOW is created when:

CONFIRMED
↓
Expected arrival passes
↓
Guest does not arrive

Display:

⚫ NO SHOW

"Guest did not check in for this reservation."

Show:

Booking

Dates

Room

Payment information

Do not show normal check-in actions.

This state should normally be controlled by authorized hotel staff/management.

---

# 27. CANCELLATION ENTRY

The Cancel button must only appear when cancellation is allowed.

Never show Cancel Booking for:

CHECKED_OUT

CANCELLED

Normally do not show it for:

CHECKED_IN

If cancellation is possible for PENDING or CONFIRMED, display it clearly.

---

# 28. CANCELLATION SCREEN

When customer taps Cancel:

Show:

Room

Hotel

Dates

Booking number

Current status

Cancellation policy

Refund calculation

Example:

Cancellation policy:

"Free cancellation until September 10."

Refund:

"$255"

Then:

"Are you sure you want to cancel?"

Buttons:

[ KEEP BOOKING ]

[ CANCEL BOOKING ]

Use a clear destructive style for the final cancellation action.

---

# 29. CANCELLATION POLICY RESULT

Support three outcomes.

FULL REFUND:

✓

"You're eligible for a full refund."

Refund:

"$255"

---

PARTIAL REFUND:

"Partial refund applies."

Refund:

"$180"

Cancellation fee:

"$75"

---

NO REFUND:

"No refund is available under this cancellation policy."

Refund:

"$0"

The customer must see this BEFORE confirming cancellation.

---

# 30. CANCELLED BOOKING

Immediately after cancellation:

🔴 BOOKING CANCELLED

Show:

Booking number

Room

Dates

Cancellation time

Refund eligibility

Availability released

Message:

"Your reservation has been cancelled."

Then show refund status where applicable.

---

# 31. REFUND NOT APPLICABLE

For:

Cash-at-Hotel unpaid

Show:

🔴 Booking Cancelled

Payment:

"Pay at Hotel"

Refund:

"Not applicable"

Message:

"No payment was collected, so no refund is required."

Do not create a fake refund process.

---

# 32. NON-REFUNDABLE PAID BOOKING

Show:

🔴 Booking Cancelled

Refund:

"$0"

Message:

"This booking was cancelled outside the refundable period."

Do not display:

"Refund processing"

because no refund exists.

---

# 33. REFUND REQUESTED

For eligible paid electronic bookings:

Show:

"Refund requested"

Status:

🟡 REFUND REQUESTED

Display:

Refund amount

Original payment method

Booking number

Refund reference if available

---

# 34. REFUND PROCESSING

Show:

"Refund processing"

Status:

🔵 REFUND PROCESSING

Message:

"Your refund is being processed by the payment provider."

Show:

Refund amount

Original payment method

Refund reference

Do not claim that the customer has received the money yet.

---

# 35. REFUND COMPLETED

Show:

✓ REFUND COMPLETED

Refund amount

Payment method

Completion date

Refund reference

Message:

"The refund has been successfully processed."

This is the final successful refund state.

---

# 36. REFUND FAILED

Show:

⚠ REFUND FAILED

Do NOT say:

"Refund completed."

Instead:

"We couldn't complete your refund automatically."

Show:

Refund amount

Refund reference

Support information

Message:

"Our team has been notified and will follow up."

Customer action:

[ CONTACT SUPPORT ]

The failed refund must remain visible in booking history.

---

# 37. REFUND TIMELINE

Create a reusable component:

✓ Cancellation Confirmed
│
✓ Refund Requested
│
● Refund Processing
│
○ Refund Completed

If failed:

✓ Cancellation Confirmed
│
✓ Refund Requested
│
✓ Refund Processing
│
✕ Refund Failed
│
● Support Follow-up

For Cash-at-Hotel:

✓ Cancellation Confirmed
│
✓ No Refund Required

For non-refundable:

✓ Cancellation Confirmed
│
✓ No Refund Available

---

# 38. DOUBLE-TAP PROTECTION

For:

Confirm Booking

Pay

Cancel Booking

Use a loading/disabled state immediately after the first tap.

Examples:

"Confirming..."

"Processing payment..."

"Cancelling..."

The UI must prevent duplicate requests.

The backend remains idempotent.

---

# 39. BOOKING DETAILS — COMPLETE VIEW

Create a comprehensive booking details page containing:

Booking status

Booking number

QR code

Hotel

Room

Room image

Guest

Check-in

Check-out

Number of nights

Guests

Price snapshot

Taxes

Discount

Coupon

Total

Payment method

Payment status

Cancellation policy

Refund status

Booking timeline

Available actions

Only show actions valid for the current state.

---

# 40. QR CODE

Create a dedicated QR code view.

Large QR code.

Booking number

Guest

Room

Check-in

Check-out

Instruction:

"Show this QR code at hotel reception."

Actions:

[ SHARE ]

[ SAVE ]

The booking QR is different from a room-service QR.

---

# 41. NOTIFICATIONS

Create lifecycle notifications.

Examples:

Booking Confirmed

"Your YayeTech booking is confirmed."

Payment Successful

"Your payment was successfully completed."

Check-in Reminder

"Your stay begins tomorrow."

Check-in Completed

"Welcome to YayeTech."

Check-out Reminder

"Your check-out is tomorrow."

Booking Cancelled

"Your reservation has been cancelled."

Refund Processing

"Your refund is being processed."

Refund Completed

"Your refund has been completed."

Refund Failed

"We need your attention regarding your refund."

Each notification should link directly to the relevant booking.

---

# 42. EDGE CASES

Design dedicated UX for:

Room becomes unavailable

Payment declined

Payment timeout

Room hold expires

Price changes

Duplicate confirmation attempt

Booking already cancelled

Booking already checked in

Booking already checked out

Cancellation outside policy

Partial refund

No refund

Refund provider failure

Network failure

Server timeout

Room moved to maintenance before check-in

When a room becomes unavailable because of maintenance, show:

"Your reserved room requires maintenance."

Provide an appropriate relocation/support flow.

Never silently cancel the reservation.

---

# 43. OFFLINE EXPERIENCE

If the customer loses internet:

Show:

"You're offline."

Cached booking information can remain visible when appropriate.

However:

Do NOT allow offline confirmation of a new booking.

Do NOT claim a room is available based only on cached data.

Do NOT claim payment succeeded without server confirmation.

When connection returns:

Refresh booking status.

---

# 44. ERROR UX

Never expose:

HTTP 500

SQL error

Database error

Stack trace

Raw API error

Instead use human-readable messages.

Example:

"Something went wrong."

[ Try Again ]

Or for booking conflicts:

"This room is no longer available."

[ View Other Rooms ]

---

# 45. ACCESSIBILITY

Use:

* 48px touch targets
* High contrast
* Screen-reader labels
* Clear typography
* Meaningful icons
* Text + icons for status
* Accessible calendar
* Accessible counters
* Accessible error messages

Never rely only on color.

---

# 46. RESPONSIVE MOBILE DESIGN

The design must look correct on:

* Small Android phones
* Large Android phones
* Small iPhones
* Large iPhones
* Different aspect ratios
* Dynamic font sizes

Do not hard-code layouts for a single phone size.

Use responsive constraints.

Support safe areas.

The booking CTA must never be hidden behind system navigation.

---

# 47. DESIGN SYSTEM COMPONENTS

Create reusable components:

BookingCard

BookingStatusBadge

BookingTimeline

BookingSummary

RoomCard

RoomSummary

PriceBreakdown

PaymentMethodCard

RefundStatus

RefundTimeline

CancellationPolicy

CancellationDialog

AvailabilityAlert

PriceChangeAlert

HoldTimer

QRCodeCard

NotificationItem

PrimaryButton

SecondaryButton

DangerButton

BottomSheet

ConfirmationDialog

EmptyState

ErrorState

SkeletonLoader

---

# 48. BUSINESS RULE SEPARATION

The UI must never be the source of truth.

Backend controls:

Availability

Room locks

Pricing

Price snapshots

Booking state

Payment state

Refund state

Cancellation policy

Authorization

Concurrency

Idempotency

The frontend only displays the server-authoritative state.

---

# 49. CUSTOMER EXPERIENCE RULE

Even though the backend has many states, the customer should see a simple experience.

Use human language.

Instead of:

"BOOK-003 concurrency lock failed"

show:

"Sorry, this room was just booked by another guest."

Instead of:

"REFUND-006 FAILED"

show:

"We couldn't complete your refund automatically. Our team has been notified."

Instead of:

"PENDING"

also explain:

"Waiting for payment"

when appropriate.

---

# 50. FINAL MOBILE EXPERIENCE

The finished YayeTech booking experience should feel like:

DISCOVER
↓
SEARCH
↓
CHOOSE ROOM
↓
SECURE ROOM
↓
PAY
↓
CONFIRMED
↓
CHECK-IN
↓
STAY
↓
CHECK-OUT
↓
REVIEW

Cancellation:

OPEN BOOKING
↓
CANCEL
↓
SEE REFUND ELIGIBILITY
↓
CONFIRM CANCELLATION
↓
BOOKING CANCELLED
↓
REFUND REQUESTED
↓
REFUND PROCESSING
↓
REFUND COMPLETED

or:

REFUND FAILED
↓
SUPPORT FOLLOW-UP

Cash-at-Hotel:

BOOK
↓
CONFIRMED
↓
CHECK-IN
↓
CHECK-OUT

Cancellation:

CANCEL
↓
BOOKING CANCELLED
↓
NO REFUND REQUIRED

The final design must be visually beautiful but operationally precise.

Every booking status must have:

* Clear status
* Clear timeline
* Clear next step
* Correct available actions
* Correct payment information
* Correct cancellation information
* Correct refund information

The customer must never be confused about the state of their reservation.
