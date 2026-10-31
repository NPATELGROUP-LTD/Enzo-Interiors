import { Client } from '../../common/types/domain';

/**
 * The version of the portal terms (apps/portal/src/lib/legal.ts) clients must have accepted. Change it
 * when the terms change in substance and every client is asked again; the Admin can also ask on demand
 * (POST /clients/:id/terms/reset, POST /clients/terms/reset), which clears `terms_version` without touching
 * the record of past acceptances (`terms_acceptances`).
 */
export const PORTAL_TERMS_VERSION = '2026-10-31';

export const hasAcceptedTerms = (client: Pick<Client, 'terms_version'>): boolean => client.terms_version === PORTAL_TERMS_VERSION;
