-- Keep bounded AI history reads and approved tenant-scoped RAG retrievals index-backed.
CREATE INDEX IF NOT EXISTS "AiMessage_conversationId_createdAt_idx"
  ON "AiMessage" ("conversationId", "createdAt");

CREATE INDEX IF NOT EXISTS "AiKnowledgeDocument_approved_hotelId_updatedAt_idx"
  ON "AiKnowledgeDocument" ("approved", "hotelId", "updatedAt");
