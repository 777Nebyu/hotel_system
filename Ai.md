# YayeTech Rule Catalog — AI (AI Platform Integration)

10 x 17

File `25-AI-PLATFORM-rules.md` — extends the existing Rule Catalog. Cross-references existing rule IDs throughout since the AI platform is a consumer of the existing domain, not a parallel system.

---

#### AI-001 — Provider Abstraction
**Actor:** System
**Preconditions:** n/a
**Validation:** n/a
**Business Rule:** All AI calls go through the `AIProvider` interface — `AIService`, tools, and prompt building depend on the interface, never on `GeminiProvider` directly. Swapping providers requires one new class and one env var change, never a change to business logic, controllers, or either frontend.
**State/Effect:** n/a
**Reject When:** n/a
**Errors:** n/a

#### AI-002 — API Keys Never Reach the Client
**Actor:** System
**Preconditions:** n/a
**Validation:** `GEMINI_API_KEY` read only through `ConfigModule`, server-side
**Business Rule:** No AI provider API key, or any AI provider secret, is ever sent to React or React Native — enforced structurally, since clients only ever call NestJS endpoints and never the provider API directly.
**State/Effect:** n/a
**Reject When:** n/a
**Errors:** n/a

#### AI-003 — Single Backend AI Gateway
**Actor:** System
**Preconditions:** n/a
**Validation:** n/a
**Business Rule:** Web and mobile clients communicate only with the NestJS `/ai/chat` and `/ai/voice` endpoints — there is no client-side AI SDK integration, no direct provider calls from any frontend, for any actor.
**State/Effect:** n/a
**Reject When:** n/a
**Errors:** n/a

#### AI-004 — Conversation Ownership Scoping
**Actor:** System
**Preconditions:** n/a
**Validation:** `conversation.user_id` compared against `context.callerId` on every read/append
**Business Rule:** A conversation belongs to exactly one user. Reading or appending to it re-checks ownership every time, identical in principle to `RBAC-005`.
**State/Effect:** n/a
**Reject When:** Ownership mismatch.
**Errors:** 403.

#### AI-005 — Conversation History Is Bounded
**Actor:** System
**Preconditions:** n/a
**Validation:** `AI_CONVERSATION_HISTORY_LIMIT` enforced
**Business Rule:** History sent to the provider per turn is capped (message count or token budget) — never the full unbounded conversation, for both cost control and to limit prompt-injection surface area accumulated earlier in a long conversation.
**State/Effect:** n/a
**Reject When:** n/a
**Errors:** n/a

#### AI-006 — AI Never Directly Accesses the Database
**Actor:** System
**Preconditions:** n/a
**Validation:** n/a
**Business Rule:** The AI has no direct database connection or query capability. Every piece of real data it uses comes through a named, typed tool that calls an existing domain service.
**State/Effect:** n/a
**Reject When:** n/a
**Errors:** n/a

#### AI-007 — Tools Enforce Their Own Authorization
**Actor:** System
**Preconditions:** A tool is invoked
**Validation:** n/a
**Business Rule:** Every tool independently checks role, ownership, and hotel scope from `context` (the verified caller identity), never from `args` (what the AI supplied). This applies with zero exceptions across all tools.
**State/Effect:** n/a
**Reject When:** Authorization check fails.
**Errors:** 403 (surfaced to the AI as a tool error, then explained to the user in plain language, per the existing error-handling taxonomy).

#### AI-008 — The AI Is Never the Authorization Decision-Maker
**Actor:** System
**Preconditions:** n/a
**Validation:** n/a
**Business Rule:** System prompt instructions ("don't reveal other users' data") are a UX nicety, never the actual security boundary. The security boundary is `AI-007` — tool-level enforcement that functions correctly even if the model is fully compromised by a malicious prompt.
**State/Effect:** n/a
**Reject When:** n/a
**Errors:** n/a

#### AI-009 — Customer AI Scope
**Actor:** Customer
**Preconditions:** Authenticated
**Validation:** n/a
**Business Rule:** Customer AI tool access is limited to: `checkRoomAvailability`, `getCustomerBooking`, `createBooking`, `cancelBooking`, `getPaymentStatus`, `getHotelInformation`, `getHotelPolicies`. No reporting or other-customer-data tools are ever exposed to the Customer role.
**State/Effect:** n/a
**Reject When:** n/a
**Errors:** n/a

#### AI-010 — Hotel Manager AI Scope
**Actor:** Hotel Manager
**Preconditions:** Authenticated
**Validation:** `context.callerHotelId` present and used for every scoped tool call
**Business Rule:** Manager AI tool access is limited to hotel-level analytics/reporting and operational tools, hard-scoped to `context.callerHotelId` — identical enforcement to `RBAC-003`. A Manager's AI session can never retrieve or discuss another hotel's data.
**State/Effect:** n/a
**Reject When:** Tool attempted without a valid `callerHotelId`.
**Errors:** 403.

#### AI-011 — Hotel Staff AI Scope
**Actor:** Hotel Staff
**Preconditions:** Authenticated
**Validation:** n/a
**Business Rule:** Staff AI tool access is limited to read-only operational/procedural information scoped to assigned hotel(s) — no reporting or financial tools, consistent with `RBAC-004`'s narrower Staff permission set relative to Manager.
**State/Effect:** n/a
**Reject When:** n/a
**Errors:** n/a

#### AI-012 — System Admin AI Scope
**Actor:** System Admin
**Preconditions:** Authenticated
**Validation:** n/a
**Business Rule:** Admin AI tool access covers system-wide analytics and administrative summaries, consistent with `RBAC-006`'s lack of resource scoping — but does not include direct customer-PII lookup tools by default; a dedicated tool for that would need its own explicit design and audit-logging treatment, not blanket access via general admin AI use.
**State/Effect:** n/a
**Reject When:** n/a
**Errors:** n/a

#### AI-013 — AI-Initiated Bookings Use the Real Booking Pipeline
**Actor:** System
**Preconditions:** The `createBooking` tool is invoked
**Validation:** n/a
**Business Rule:** The tool calls the actual `BookingService.createBooking()` — every guarantee in `BOOK-001` through `BOOK-007` (concurrency locking, price snapshotting, hold/expiry, idempotency) applies identically whether the booking was initiated via UI or via AI tool call. There is no separate, lighter-weight AI booking code path.
**State/Effect:** n/a
**Reject When:** Same rejection conditions as `BOOK-003`/`BOOK-020`.
**Errors:** Same as the underlying booking endpoint.

#### AI-014 — AI-Initiated Cancellations Use the Real Cancellation Pipeline
**Actor:** System
**Preconditions:** The `cancelBooking` tool is invoked
**Validation:** n/a
**Business Rule:** Identical principle to `AI-013`, applied to `REFUND-001` through `REFUND-008`.
**State/Effect:** n/a
**Reject When:** n/a
**Errors:** n/a

#### AI-015 — RAG Tenant Isolation Enforced at the Query Level
**Actor:** System
**Preconditions:** A RAG retrieval is performed
**Validation:** SQL `WHERE hotel_id IS NULL OR hotel_id = callerHotelId`
**Business Rule:** Isolation between hotels' documents is enforced by the retrieval query itself, never by a system-prompt instruction alone — mirrors `MULTIHOTEL-001`. A caller scoped to Hotel A can never retrieve Hotel B's `hotel_id`-tagged chunks under any prompt.
**State/Effect:** n/a
**Reject When:** n/a
**Errors:** n/a

#### AI-016 — Only Approved Documents Are Retrievable
**Actor:** System
**Preconditions:** n/a
**Validation:** `approved = true` required in the retrieval query
**Business Rule:** A document must pass through an approval gate (analogous to `HOTEL-001`'s draft-to-published flow) before it's embedded/retrievable by the AI — unreviewed content is never AI-searchable.
**State/Effect:** n/a
**Reject When:** n/a
**Errors:** n/a

#### AI-017 — RAG Content Treated as Untrusted Input
**Actor:** System
**Preconditions:** Retrieved chunks are inserted into the prompt
**Validation:** n/a
**Business Rule:** Retrieved content is wrapped as reference material for the model to draw on, never as instructions for it to follow — defends against injected content in a review or document attempting to redirect the model's behavior.
**State/Effect:** n/a
**Reject When:** n/a
**Errors:** n/a

#### AI-018 — Tool Arguments Validated Like Any Request Body
**Actor:** System
**Preconditions:** A tool is about to execute
**Validation:** Tool argument schema validated (Zod or equivalent) before execution
**Business Rule:** What the AI supplies as tool arguments is untrusted input, validated exactly as strictly as an HTTP request body would be — never assumed safe because it came from the model rather than the client directly.
**State/Effect:** n/a
**Reject When:** Argument validation fails.
**Errors:** 400 (internal to the tool-call loop, surfaced to the user as a plain-language message).

#### AI-019 — Voice Runs Through the Same Pipeline as Text
**Actor:** System
**Preconditions:** A voice request is received
**Validation:** n/a
**Business Rule:** Audio is transcribed server-side, and the resulting text runs through the identical `AIService.chat()` pipeline used for typed messages — every tool-authorization and RAG-isolation guarantee applies the same way regardless of input modality.
**State/Effect:** n/a
**Reject When:** n/a
**Errors:** n/a

#### AI-020 — Voice Secrets Stay Server-Side
**Actor:** System
**Preconditions:** n/a
**Validation:** n/a
**Business Rule:** Speech-to-text and text-to-speech both happen via the backend's `AIProvider` implementation — the client never calls a speech API directly, same principle as `AI-002`/`AI-003` applied to voice specifically.
**State/Effect:** n/a
**Reject When:** n/a
**Errors:** n/a

#### AI-021 — Tool Iteration Cap
**Actor:** System
**Preconditions:** n/a
**Validation:** `AI_MAX_TOOL_ITERATIONS` enforced
**Business Rule:** The tool-call loop has a fixed maximum number of iterations per turn — prevents a runaway chain of tool calls from becoming a cost or availability problem.
**State/Effect:** n/a
**Reject When:** Limit exceeded.
**Errors:** A clear "unable to complete this request" response to the user, logged server-side for investigation.

#### AI-022 — Rate Limiting on AI Endpoints
**Actor:** System
**Preconditions:** n/a
**Validation:** `AI_RATE_LIMIT_PER_USER` enforced
**Business Rule:** `/ai/chat` and `/ai/voice` are rate-limited per user, consistent with the platform's general abuse-protection approach on sensitive/costly endpoints.
**State/Effect:** n/a
**Reject When:** Limit exceeded.
**Errors:** 429.

#### AI-023 — AI Provider Failure Handling
**Actor:** System
**Preconditions:** The provider (Gemini) times out or errors
**Validation:** n/a
**Business Rule:** The failure is caught, logged with full detail server-side, and surfaced to the user as a generic, calm error — never the provider's raw error text. A failure at this stage never rolls back or half-executes a tool side effect that already completed (e.g. a `createBooking` call that already succeeded through the real booking pipeline stays succeeded even if the AI's subsequent summarization step fails).
**State/Effect:** n/a
**Reject When:** n/a
**Errors:** Generic server-error treatment, consistent with the platform's error-handling taxonomy.

#### AI-024 — Admin AI Actions Are Audit-Logged
**Actor:** System
**Preconditions:** An Admin's AI session invokes a tool
**Validation:** n/a
**Business Rule:** Admin tool invocations via AI are logged exactly like any other admin mutation/query action — actor, tool name, arguments, and timestamp — not a separate, less-visible logging path just because the request originated from a chat interface.
**State/Effect:** n/a
**Reject When:** n/a
**Errors:** n/a

#### AI-025 — Conversation History Is Subject to Retention & Export Rules
**Actor:** System
**Preconditions:** n/a
**Validation:** n/a
**Business Rule:** AI conversation history is user data like any other — included in a user's data export or deletion request, and governed by the platform's defined retention period, not left as an unretained/unbounded exception.
**State/Effect:** n/a
**Reject When:** n/a
**Errors:** n/a

#### AI-026 — No Arbitrary SQL, No Unrestricted Database Access
**Actor:** System
**Preconditions:** n/a
**Validation:** n/a
**Business Rule:** There is no tool that accepts or executes a raw query. Every tool is a named function with a fixed, validated parameter schema calling into an existing, already-scoped domain service — this is a hard architectural constraint, not a policy the AI is merely instructed to follow.
**State/Effect:** n/a
**Reject When:** n/a
**Errors:** n/a

#### AI-027 — Financial/Booking Actions Require Full Backend Validation Regardless of AI Confidence
**Actor:** System
**Preconditions:** n/a
**Validation:** n/a
**Business Rule:** No AI-mediated action that creates a charge, booking, or cancellation skips any validation step a normal API request would go through — price is always server-recalculated, availability always re-checked under lock, ownership always re-verified. The AI's apparent certainty about what the user wants never substitutes for these checks.
**State/Effect:** n/a
**Reject When:** n/a
**Errors:** n/a

#### AI-028 — Testing Coverage Requirement
**Actor:** Developers
**Preconditions:** n/a
**Validation:** n/a
**Business Rule:** Every tool has both a unit test calling `execute()` directly with a mismatched context (verifying rejection independent of the AI layer) and an integration test through the full chat pipeline. Prompt-injection and RAG-isolation scenarios are explicitly tested, not assumed safe by design alone.
**State/Effect:** n/a
**Reject When:** n/a
**Errors:** n/a

#### AI-029 — Per-Actor Frontend, Shared Backend
**Actor:** System
**Preconditions:** n/a
**Validation:** n/a
**Business Rule:** Each actor gets a distinct AI UI/UX on web and mobile, but all of them call the same two backend endpoints — no per-role backend AI logic duplicated across separate code paths.
**State/Effect:** n/a
**Reject When:** n/a
**Errors:** n/a

#### AI-030 — Mobile Voice Permission Handling
**Actor:** Customer (mobile)
**Preconditions:** n/a
**Validation:** n/a
**Business Rule:** Microphone access is requested contextually, at the point of use, with a plain-language explanation beforehand — consistent with the mobile app's existing camera/photo-library permission pattern. Denial degrades gracefully to text-only AI interaction, never blocking the rest of the app.
**State/Effect:** n/a
**Reject When:** n/a
**Errors:** n/a