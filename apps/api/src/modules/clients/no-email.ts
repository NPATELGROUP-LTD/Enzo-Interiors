import { randomUUID } from 'crypto';

/**
 * `clients.email` is NOT NULL and UNIQUE and migrations only add, so a client added by name alone
 * gets a unique stand-in address on a domain that cannot receive mail. The API shows it as '' and
 * never invites or emails it (the `.invalid` TLD is reserved, RFC 2606).
 */
const DOMAIN = '@no-email.invalid';

export const placeholderEmail = (): string => `client-${randomUUID()}${DOMAIN}`;
export const hasEmail = (email: string): boolean => !email.endsWith(DOMAIN);
