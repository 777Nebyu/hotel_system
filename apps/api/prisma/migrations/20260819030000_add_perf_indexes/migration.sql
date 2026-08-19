-- CreateIndex — Booking: filter by userId (my bookings), hotelId (hotel dashboard), status, and date range scans
CREATE INDEX "Booking_userId_idx" ON "Booking"("userId");
CREATE INDEX "Booking_hotelId_idx" ON "Booking"("hotelId");
CREATE INDEX "Booking_status_idx" ON "Booking"("status");
CREATE INDEX "Booking_checkIn_checkOut_idx" ON "Booking"("checkIn", "checkOut");

-- CreateIndex — Payment: filter by status for admin reporting (SUCCEEDED, REFUNDED, etc.)
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex — Review: filter by hotelId for hotel detail pages, userId for profile pages
CREATE INDEX "Review_hotelId_idx" ON "Review"("hotelId");
CREATE INDEX "Review_userId_idx" ON "Review"("userId");

-- CreateIndex — Notification: filter by userId constantly (notification inbox)
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex — AuditLog: order by createdAt DESC for admin audit viewer; filter by entity+entityId
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt" DESC);
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");
