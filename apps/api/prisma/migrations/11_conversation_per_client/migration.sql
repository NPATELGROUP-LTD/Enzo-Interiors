-- One conversation per client: two simultaneous first messages could each
-- find no thread and create one. The API catches the loser's unique violation
-- (P2002) and returns the winner's row.
-- Additive only: one unique index. Conversations were not mounted before this
-- release, so no client has two rows; if one ever did, this fails loudly
-- rather than deleting a thread (docs/prelaunch.md).

-- CreateIndex
CREATE UNIQUE INDEX "conversations_client_id_key" ON "conversations"("client_id");
