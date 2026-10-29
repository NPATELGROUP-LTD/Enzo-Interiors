/**
 * The admin's own Privacy, Terms and Cookies pages (/privacy, /terms, /cookies).
 *
 * These are written for the people who use this admin (staff), and are separate
 * from the public site's pages, which are edited in the CMS. apps/portal has its
 * own copy of this file, written for clients. Change a fact in both.
 *
 * Keep them true to what the system does today:
 *  - the sign-in token, cached user, theme, notification choices and the
 *    remembered-device token are all localStorage (grep localStorage in src);
 *  - the access log (apps/api core/access-log.service) is described in
 *    `what-we-collect`, `retention` and the Terms: IP, country and browser kind with
 *    each sign-in, change and refusal, kept 90 days. Change both if it changes;
 *  - Google sign-in and Calendar exist in the API but no staff use them, so Google
 *    is not listed as a provider. Add it before anyone connects an account.
 *
 * Not legal advice: have a solicitor read the Terms before they are relied on.
 * No ICO number appears because Enzo has none; do not invent one.
 */

export const COMPANY = {
  name: 'Enzo Interiors Ltd',
  number: '16540291',
  address: '51 Forest Road, Leicester, England, LE5 0DW',
  privacyEmail: 'privacy.enzointeriors@npatelgroup.ltd',
  supportEmail: 'support.enzointeriors@npatelgroup.ltd',
  site: 'https://www.enzointeriors.co.uk',
  processor: 'NPATEL GROUP LTD',
  processorNumber: '16236097',
};

export const APP_NAME = 'Enzo Interiors admin';
export const UPDATED = '24 October 2026';

/** A paragraph, or a bullet list. */
export type Block = string | string[];
export interface Clause {
  id: string;
  heading: string;
  body: Block[];
}
export interface LegalDoc {
  title: string;
  intro: string;
  clauses: Clause[];
}

export const LEGAL_KINDS = ['privacy', 'terms', 'cookies'] as const;
export type LegalKind = (typeof LEGAL_KINDS)[number];

/** Which legal page an address is, if any. */
export function legalKind(pathname: string): LegalKind | null {
  const path = pathname.replace(/\/+$/, '').slice(1);
  return (LEGAL_KINDS as readonly string[]).includes(path) ? (path as LegalKind) : null;
}

const { name, number, address, privacyEmail, supportEmail, site, processor, processorNumber } = COMPANY;

const ico =
  'You can also complain to the Information Commissioner’s Office at ico.org.uk or on 0303 123 1113. We would like the chance to put things right first.';

const changes: Clause = {
  id: 'changes',
  heading: 'Changes to this page',
  body: [
    `We update this page when the admin changes or the rules do. The date at the top says when it last changed. If a change matters to you, we will tell you in the admin or by email.`,
  ],
};

export const LEGAL: Record<LegalKind, LegalDoc> = {
  privacy: {
    title: 'Privacy notice',
    intro:
      'This notice is for the people who use the Enzo Interiors admin: our team, contractors and the NPATEL GROUP LTD team. It says what we keep about you and why. Clients have their own notice in the client portal.',
    clauses: [
      {
        id: 'who-we-are',
        heading: 'Who we are',
        body: [
          `${name} (“Enzo”, “we”) decides what happens to the personal data in this admin, so it is the data controller. Company number ${number}, registered in England and Wales. Address: ${address}.`,
          `${processor} (company number ${processorNumber}) builds and runs the system for us. It acts only on our instructions, under a written contract, and does not use your information for its own purposes.`,
          `Questions about this notice or your information: ${privacyEmail}. Help signing in or using the admin: ${supportEmail}.`,
        ],
      },
      {
        id: 'what-we-collect',
        heading: 'What we keep about you',
        body: [
          [
            'Your name, work email address and role (Admin, Editor, Designer or Installer).',
            'Your password, stored only as a one-way hash, so nobody can read it.',
            'Your two-step sign-in details: the method you chose, an authenticator secret kept encrypted, recovery codes kept as hashes, and short-lived emailed codes, also hashed.',
            'Devices you asked us to remember: a label for the browser or device, when it was added and last used, and when it expires.',
            'Your notification choices and, if you allow them, the address your browser gives us to send notifications to that device, with the browser’s name.',
            'A record of what you change: your name, what you did, which record and when (the activity log).',
            'A record of when you sign in, and of requests you make that change something or are refused: your name, the page or action, the time, your IP address, the country it comes from, and the kind of browser and system (for example “Chrome · Windows”). A failed sign-in keeps only a masked version of the address that was typed (the access log).',
            'What you write or upload: messages to clients, website drafts and files.',
            'If you work as an installer, the dates and pay agreed for each job, and whether you approved them. Only you and the Admin can see the pay.',
            'Replies you send to an enquiry, stored on the enquiry with the address they were sent to and your name.',
            'Team messages and files you send to a colleague or on a project thread, stored for the studio and visible to the people in that conversation (a direct chat only to the two of you).',
            'Mail: if you connect your Gmail, Enzo Interiors reads your mailbox from Google when you open it and sends mail you write, using access you can withdraw at any time. We store only a sealed access key, never your messages. The activity log records that you sent mail and the domains it went to, not its content.',
          ],
          'Your device’s IP address is handled by Cloudflare and our server to deliver pages and to slow down repeated sign-in attempts. Those counters last a short time. The access log also keeps it, as above.',
        ],
      },
      {
        id: 'why',
        heading: 'Why, and on what lawful basis',
        body: [
          [
            'To create your account, let you sign in and do your job: our legitimate interest in running the business and, for employees and contractors, carrying out your contract.',
            'To keep the system and our clients’ data secure (two-step sign-in, locking after repeated failed attempts, the activity log and the access log): our legitimate interests and our legal duty to keep personal data secure.',
            'To keep a record of who changed what, so mistakes can be put right and misuse investigated: our legitimate interests.',
            'To send notifications to your device: your consent. You can turn them off in the admin or in your browser at any time.',
          ],
          'We do not use your information for marketing, we do not sell it, and nobody is subject to a decision made only by a computer.',
        ],
      },
      {
        id: 'sharing',
        heading: 'Who sees it',
        body: [
          'Inside Enzo, Admins can see the list of staff accounts and the activity log. The Infra manager, who looks after the system and not the business, can see the access log and the activity log without client details. Other staff see only their own account. Each person sees client information only as far as their role allows.',
          `${processor} can see it for support and technical administration.`,
          'Providers that act for us:',
          [
            'Zoho, which sends our email, including your sign-in codes and notifications.',
            'Cloudflare, which carries the traffic between your browser and our servers, so it handles your IP address and the data in transit.',
            'Your browser’s push service (Apple, Google, Microsoft or Mozilla), which delivers notifications, only if you turn them on.',
            'Google, only if you connect your Gmail: it holds your mail, which we read with your permission and send on your behalf.',
            'Google Fonts: the admin loads its typeface from Google, which receives your IP address and browser details when a page opens.',
          ],
          'Our servers and backups are in the United Kingdom. Some providers above can handle data outside the UK. Where they do, the transfer has to be covered by a safeguard that UK law accepts.',
          'We do not sell your information. We share it where the law requires.',
        ],
      },
      {
        id: 'retention',
        heading: 'How long we keep it',
        body: [
          [
            'Your account: while you have access. When it is removed, the account, its remembered devices and its notifications are deleted.',
            'The access log, with the IP addresses in it: 90 days, then deleted.',
            'Your connected Gmail: the stored access key is deleted when you disconnect or your account is removed.',
            'The activity log: kept with the records it describes, for up to six years after a client’s project is completed, so changes can still be explained. Your name stays on those entries.',
            'Short-lived items: emailed sign-in codes last 10 minutes, password reset links 30 minutes, invitation links 7 days, a remembered device 30 days.',
            'Backups roll over on a schedule, so deleted information drops out as they are replaced.',
          ],
        ],
      },
      {
        id: 'your-rights',
        heading: 'Your rights',
        body: [
          'You can ask to see what we hold about you, to correct it, to have it erased (unless we must keep it), to restrict or object to how we use it, and to receive it in a portable form. You can withdraw consent for notifications at any time.',
          `Write to ${privacyEmail}. We reply within one month and do not charge.`,
          ico,
        ],
      },
      {
        id: 'security',
        heading: 'How we protect it',
        body: [
          [
            'Everything travels over HTTPS.',
            'Passwords are hashed; authenticator secrets are encrypted.',
            'Two-step sign-in is required, and repeated wrong attempts lock the account for a while.',
            'Your role decides what you can open, and the server checks it on every request. Changing a password signs out every other session.',
            'A sign-in lasts an hour and is renewed while you use the admin, so an unattended screen signs itself out. “Remember this device” lasts 30 days and can be revoked under Account.',
          ],
          'If personal data is lost or exposed, we will tell the Information Commissioner within 72 hours where the law requires it, and tell the people affected where it requires that.',
        ],
      },
      changes,
    ],
  },

  terms: {
    title: 'Terms of use',
    intro:
      'These terms apply to everyone who has an account on the Enzo Interiors admin. They sit alongside your contract or agreement with Enzo or NPATEL GROUP LTD and do not replace it.',
    clauses: [
      {
        id: 'who',
        heading: 'Who provides the admin',
        body: [
          `The admin is provided by ${name}, company number ${number}, ${address}, and built and run for it by ${processor}. You use it on Enzo’s behalf, for Enzo’s business only.`,
          `Questions: ${supportEmail}.`,
        ],
      },
      {
        id: 'your-account',
        heading: 'Your account',
        body: [
          [
            'Your account is yours alone. Do not share your password, sign-in codes or recovery codes, and do not sign in for someone else.',
            'Turn on “Remember this device” only on a device you control.',
            'Your role decides what you can see and do. Do not try to reach anything beyond it.',
            `If you think someone else has your details, or a device was lost, tell ${supportEmail} straight away and change your password.`,
          ],
        ],
      },
      {
        id: 'client-data',
        heading: 'Client information',
        body: [
          'You may see personal information about Enzo’s clients: names, contact details, addresses, project files, invoices and messages. Use it only to do your work for that client.',
          [
            'Do not copy, export or download it beyond what the job needs.',
            'Do not share it outside Enzo and NPATEL GROUP LTD, and inside them only with people who need it.',
            'Do not put it in personal accounts, chat apps or screenshots.',
            'Your duty of confidence continues after your access ends.',
          ],
          `If client information is lost, sent to the wrong person or seen by someone who should not have it, tell ${privacyEmail} immediately. The law gives us 72 hours to report some incidents.`,
        ],
      },
      {
        id: 'acceptable-use',
        heading: 'Using the admin properly',
        body: [
          [
            'Messages to clients are records the client can read. Keep them professional and accurate.',
            'Only publish text and images on the website that Enzo has the right to use.',
            'Do not upload anything unlawful or harmful, and do not try to break, probe or get around the admin’s protections.',
            'Editors send changes for review; do not work around that.',
          ],
        ],
      },
      {
        id: 'monitoring',
        heading: 'What is recorded',
        body: [
          'Changes you make are recorded in the activity log, and sign-ins, changes and refused requests in the access log. We may review the logs to keep the system secure, to find and fix faults, and to investigate suspected misuse. The privacy notice explains what is kept and for how long.',
        ],
      },
      {
        id: 'access',
        heading: 'Access and availability',
        body: [
          'We can change or remove access at any time, and access ends when you stop working with Enzo or NPATEL GROUP LTD. We try to keep the admin available but it may be paused for maintenance, and we do not promise it will never fail. Keep your own copy of anything you cannot afford to lose.',
        ],
      },
      {
        id: 'ownership',
        heading: 'Who owns what',
        body: [
          'The records, files and website content in the admin are Enzo’s business records. Your contract says who owns work you create for Enzo.',
        ],
      },
      {
        id: 'liability',
        heading: 'Responsibility',
        body: [
          'Nothing here limits liability for death or personal injury caused by negligence, for fraud, or for anything the law does not allow us to limit.',
          'You are responsible for what is done with your account until you tell us it may be compromised.',
        ],
      },
      changes,
      {
        id: 'law',
        heading: 'Governing law',
        body: ['These terms are governed by the law of England and Wales, and its courts have jurisdiction.'],
      },
    ],
  },

  cookies: {
    title: 'Cookies and local storage',
    intro:
      'The admin sets no cookies of its own. It does keep a few small items in your browser so you stay signed in and the screen looks the way you left it. There is no analytics and no advertising.',
    clauses: [
      {
        id: 'what-we-keep',
        heading: 'What the admin keeps in your browser',
        body: [
          'These sit in your browser’s local storage, on your device only:',
          [
            'enzo-admin-token: keeps you signed in. Removed when you sign out; it stops working an hour after you stop using the admin.',
            'enzo-admin-user: your name and role, so the screen opens quickly. Removed when you sign out.',
            'enzo.deviceToken: lets a device you chose skip the second sign-in step for 30 days. It stays after you sign out so the device is still remembered; remove it under Account.',
            'enzo-theme: your light or dark choice.',
            'enzo.pushOptOut and enzo.pushPrompt: whether you turned notifications off, and when we last asked.',
          ],
          'The installed app also keeps its own program files so it opens fast. It holds no client information, and every request for data goes to the server.',
        ],
      },
      {
        id: 'consent',
        heading: 'Why there is no cookie banner',
        body: [
          'Everything above is needed to give you the service you asked for, or is a choice you made. Consent is not needed for that. Notifications are only switched on after you tap Allow.',
        ],
      },
      {
        id: 'third-parties',
        heading: 'Other companies',
        body: [
          'Cloudflare sits in front of the admin to keep it secure and may set a strictly necessary security cookie of its own. Google Fonts supplies the typeface, so Google sees your IP address when a page opens. Your browser’s push service carries notifications if you turn them on. The privacy notice says more.',
        ],
      },
      {
        id: 'changing-your-mind',
        heading: 'Clearing it',
        body: [
          'Signing out removes your sign-in. You can clear everything else in your browser’s site settings. The next sign-in sets up what it needs again.',
          `The public website has its own cookie policy at ${site}/cookies.`,
        ],
      },
    ],
  },
};
