-- Client portal sessions: clients get a token_version like staff_users, so a
-- password change or an admin's revoke signs every portal session out.
-- Additive only: one column with a constant default (no table rewrite on
-- PostgreSQL 11+), so the previous release still runs against this schema
-- (docs/prelaunch.md).

-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "token_version" INTEGER NOT NULL DEFAULT 0;
