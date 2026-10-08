/**
 * Prints a fresh VAPID key pair for Web Push. Paste both into the API's env
 * with VAPID_SUBJECT=mailto:<a real inbox>. Changing the pair later strands
 * every existing subscription: devices turn notifications on again.
 */
import { generateVAPIDKeys } from 'web-push';

const { publicKey, privateKey } = generateVAPIDKeys();
console.log(`VAPID_PUBLIC_KEY=${publicKey}\nVAPID_PRIVATE_KEY=${privateKey}`);
