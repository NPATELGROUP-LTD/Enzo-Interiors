/**
 * The client portal's own Privacy, Terms and Cookies pages (/privacy, /terms,
 * /cookies).
 *
 * These are written for Enzo's clients and are separate from the public site's
 * pages, which are edited in the CMS. apps/admin has its own copy of this file,
 * written for staff. Change a fact in both.
 *
 * Keep them true to what the system does today:
 *  - the sign-in token, cached user, theme and notification choices are all
 *    localStorage (grep localStorage in src);
 *  - the access log (apps/api core/access-log.service) is described in
 *    `what-we-collect`, `retention` and the Terms: IP, country and browser kind with
 *    each sign-in, change and refusal, kept 90 days. Change both if it changes;
 *  - Google sign-in and Calendar are staff features no one uses, so Google is
 *    listed only for the typeface. Add it before anyone connects an account.
 *
 * Not legal advice: have a solicitor read the Terms before they are relied on.
 * The ICO registration number (icoNumber) was supplied by the owner; do not change it without them.
 */

export const COMPANY = {
  name: 'Enzo Interiors Ltd',
  number: '16540291',
  icoNumber: 'ZC047912',
  address: '51 Forest Road, Leicester, England, LE5 0DW',
  privacyEmail: 'privacy.enzointeriors@npatelgroup.ltd',
  supportEmail: 'support.enzointeriors@npatelgroup.ltd',
  site: 'https://www.enzointeriors.co.uk',
  processor: 'NPATEL GROUP LTD',
  processorNumber: '16236097',
};

export const APP_NAME = 'Enzo Interiors client portal';
export const UPDATED = '31 October 2026';
/** What a client accepts. Keep in step with PORTAL_TERMS_VERSION in apps/api/src/modules/auth/terms.ts: the API refuses any other. */
export const TERMS_VERSION = '2026-10-31';

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

const { name, number, icoNumber, address, privacyEmail, supportEmail, site, processor, processorNumber } = COMPANY;

const ico =
  'You can also complain to the Information Commissioner’s Office at ico.org.uk or on 0303 123 1113. We would like the chance to put things right first.';

const changes: Clause = {
  id: 'changes',
  heading: 'Changes to this page',
  body: [
    `We update this page when the portal changes or the rules do. The date at the top says when it last changed. If a change matters to you, we will tell you in the portal or by email.`,
  ],
};

export const LEGAL: Record<LegalKind, LegalDoc> = {
  privacy: {
    title: 'Privacy notice',
    intro:
      'This is how Enzo Interiors looks after your information in the client portal: what we keep, why, who sees it and how long it stays. We use it to run your project and nothing else. There is no advertising and nothing is sold.',
    clauses: [
      {
        id: 'who-we-are',
        heading: 'Who we are',
        body: [
          `${name} (“Enzo”, “we”) decides what happens to your personal data in this portal, so it is the data controller. Company number ${number}, registered in England and Wales. ICO registration number ${icoNumber}. Address: ${address}.`,
          `${processor} (company number ${processorNumber}) built and runs the portal for us. It acts only on our instructions, under a written contract, and does not use your information for its own purposes.`,
          `Questions about this notice or your information: ${privacyEmail}. Help with the portal: ${supportEmail}.`,
        ],
      },
      {
        id: 'what-we-collect',
        heading: 'What we keep about you',
        body: [
          [
            'Your name, email address, phone number and address, and a password stored only as a one-way hash, so nobody can read it.',
            'Your project: its stages and progress, the designs you approve, the changes you ask for, and notes our team keep about the job.',
            'Documents and images we share with you, and any file you attach in Messages. Files and invoices the studio shares may be view-only: the portal shows your name and the date over them and hides them when the window is not in focus, which deters copying but cannot stop a screenshot. Viewing and downloading a file are recorded.',
            'Your invoices: the lines, amounts, dates, payment schedule and whether they are paid.',
            'A security record of when you sign in and of requests that change something or are refused: the time, your IP address, the country it comes from and the kind of browser and system (for example “Chrome · Windows”). A failed sign-in keeps only a masked version of the address that was typed.',
            'Messages between you and our team, and whether they have been read.',
            'A record that you accepted the portal terms: the date and time, which version, your IP address and the kind of browser.',
            'Your notification choices and, if you allow them, the address your browser gives us to send notifications to that device, with the browser’s name.',
          ],
          'Your device’s IP address is handled by Cloudflare and our server to deliver pages and to slow down repeated sign-in attempts. Those counters last a short time. We also keep it in a security record, as above.',
        ],
      },
      {
        id: 'why',
        heading: 'Why, and on what lawful basis',
        body: [
          [
            'To run your account and your project, show you its progress, documents and invoices, and talk to you about it: this is part of the contract we have with you.',
            'To keep invoices and accounts as the law requires: a legal obligation.',
            'To keep the portal secure, stop misuse and fix faults: our legitimate interests, which we have weighed against your rights.',
            'To email you about your project (a new message, a document, an invoice): part of the service. You can choose which in Settings.',
            'To send notifications to your device: your consent. You can turn them off in Settings or in your browser at any time.',
          ],
          'We do not use your information for marketing in the portal, we do not sell it, and nobody is subject to a decision made only by a computer.',
        ],
      },
      {
        id: 'sharing',
        heading: 'Who sees it',
        body: [
          'At Enzo, administrators can see every client. Designers and installers see only the clients whose projects they are assigned to. Other people on the team see none.',
          `${processor} can see it for support and technical administration.`,
          'Providers that act for us:',
          [
            'Zoho, which sends our email: invitations (with your first password), password links and the updates you choose. Emails about messages never include the message text.',
            'Cloudflare, which carries the traffic between your browser and our servers, so it handles your IP address and the data in transit.',
            'Your browser’s push service (Apple, Google, Microsoft or Mozilla), which delivers notifications, only if you turn them on.',
            'Google Fonts: the portal loads its typeface from Google, which receives your IP address and browser details when a page opens.',
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
            'Invoices and the records behind them: 6 years.',
            'Your client and project records, including files, messages and notes: 6 years after your project is completed, then deleted or made anonymous.',
            'Your portal access: until you ask us to close it or your project work has ended. Closing it does not delete the records above.',
            'Short-lived items: password reset links last 30 minutes, and a notification address stays until you turn notifications off or sign out.',
            'The record that you accepted the terms: 6 years after your project is completed, with your other records.',
            'The security record of sign-ins and requests, with the IP addresses in it: 90 days, then deleted.',
            'A room you designed on our website: 12 months after you sent it, then deleted, unless we made you a quote from it or you became a client.',
            'Backups roll over on a schedule, so deleted information drops out as they are replaced.',
          ],
        ],
      },
      {
        id: 'your-rights',
        heading: 'Your rights',
        body: [
          'You can ask to see what we hold about you, to correct it, to have it erased (unless we must keep it, for example invoices), to restrict or object to how we use it, and to receive the information you gave us in a portable form. You can withdraw consent for notifications at any time.',
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
            'Passwords are hashed, and repeated wrong attempts lock the account for a while.',
            'You see only your own project, documents, invoices and messages. The server checks that on every request.',
            'Files are kept privately. Each time you open or download one, the portal makes a link that stops working after five minutes.',
            'A sign-in lasts an hour and is renewed while you use the portal, so an unattended screen signs itself out. Changing your password signs out every other device.',
          ],
          'If personal data is lost or exposed, we will tell the Information Commissioner within 72 hours where the law requires it, and tell you where it requires that.',
        ],
      },
      changes,
    ],
  },

  terms: {
    title: 'Terms of use',
    intro:
      'These terms cover how you use the Enzo Interiors client portal. They do not replace your quotation or the contract for your job; they sit alongside it.',
    clauses: [
      {
        id: 'who',
        heading: 'Who provides the portal',
        body: [
          `The portal is provided by ${name}, company number ${number}, ${address}, and built and run for it by ${processor}. It is for Enzo’s clients, by invitation.`,
          `Questions: ${supportEmail}.`,
        ],
      },
      {
        id: 'your-account',
        heading: 'Your account',
        body: [
          [
            'You get in with the email address and the password in your invitation email. We recommend changing it the first time you sign in. Do not share it.',
            'Keep your contact details up to date in Settings.',
            `If you think someone else has your details, tell ${supportEmail} straight away and change your password.`,
            'You are responsible for what is done with your account until you tell us it may be compromised.',
          ],
          'We may suspend access if it looks insecure or is being misused.',
        ],
      },
      {
        id: 'agreement',
        heading: 'Accepting these terms, and what you do in your account',
        body: [
          'You accept these terms by ticking “I agree” when the portal asks. We record the date and time, the version you accepted, your IP address and the kind of browser you used, and keep that record as evidence of what you agreed to.',
          'Your account is you. What is done while signed in to your account, such as approving a design, accepting or declining a quotation, asking for changes, sending a message or sharing a file, is treated as done by you and is legally binding on you, as if you had signed it on paper.',
          'This does not take away any right you have as a consumer, including any right to cancel under your job contract.',
          'We may ask you to accept the terms again, for example when they change. You cannot use the portal until you do.',
        ],
      },
      {
        id: 'what-it-shows',
        heading: 'What the portal shows',
        body: [
          'The portal shows your project, documents, invoices and messages for convenience. Stages, progress and dates are updates, not promises. Your signed quotation or contract and your invoices are the record of what was agreed.',
          'Invoices show what is due and whether it is paid. You do not pay in the portal. We mark an invoice paid after the payment reaches us, so that can lag behind your payment.',
          'Approving a design tells us to go ahead with it. What happens next, including any effect of later changes on cost or timing, is set out in your job contract. If you are not sure, use Request changes or message us first.',
        ],
      },
      {
        id: 'files-and-messages',
        heading: 'Files and messages',
        body: [
          [
            'Use Messages to talk to us about your project. We usually reply within a working day, so do not use it for anything urgent.',
            'Attach only files you have the right to share and that relate to your project. Files can be up to 25 MB, in common formats such as PDF, images, Word, Excel and PowerPoint.',
            'Do not upload anything unlawful, harmful or abusive. We may remove it and, in serious cases, close the account.',
            'Files you attach are kept on your project, where you and our team can see them.',
          ],
        ],
      },
      {
        id: 'availability',
        heading: 'Availability',
        body: [
          'We try to keep the portal available, but it may be paused for maintenance and we do not promise it will never fail. Download anything you need to keep.',
        ],
      },
      {
        id: 'ownership',
        heading: 'Who owns what',
        body: [
          'Designs, drawings and other material we provide stay ours, or belong to whoever made them, unless your job contract says otherwise. You may keep and use them for your project. Your own files remain yours.',
        ],
      },
      {
        id: 'liability',
        heading: 'Responsibility',
        body: [
          'Nothing here limits our liability for death or personal injury caused by negligence, for fraud, or for anything the law does not allow us to limit, and it does not affect your rights as a consumer.',
          'Beyond that, we are responsible for foreseeable loss caused by us breaking these terms. We are not responsible for loss that could not have been foreseen, or for interruptions outside our control.',
        ],
      },
      {
        id: 'ending',
        heading: 'Ending your access',
        body: [
          `You can stop using the portal at any time and ask us to close your account at ${supportEmail}. We may close it once your project and payments are finished, or if these terms are broken. The privacy notice says what we keep afterwards.`,
        ],
      },
      changes,
      {
        id: 'law',
        heading: 'Governing law and complaints',
        body: [
          `If something goes wrong, tell ${supportEmail} and we will try to put it right.`,
          'These terms are governed by the law of England and Wales, and its courts have jurisdiction. If you live in Scotland or Northern Ireland you may also bring proceedings in your own courts.',
        ],
      },
    ],
  },

  cookies: {
    title: 'Cookies and local storage',
    intro:
      'The portal sets no cookies of its own. It does keep a few small items in your browser so you stay signed in and the screen looks the way you left it. There is no analytics and no advertising.',
    clauses: [
      {
        id: 'what-we-keep',
        heading: 'What the portal keeps in your browser',
        body: [
          'These sit in your browser’s local storage, on your device only:',
          [
            'enzo-portal-token: keeps you signed in. Removed when you sign out; it stops working an hour after you stop using the portal.',
            'enzo-portal-user: your name, so the screen opens quickly. Removed when you sign out.',
            'enzo-theme: your light or dark choice.',
            'enzo.pushOptOut and enzo.pushPrompt: whether you turned notifications off, and when we last asked.',
          ],
          'The installed app also keeps its own program files so it opens fast. It holds none of your project information, and every request for data goes to the server.',
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
          'Cloudflare sits in front of the portal to keep it secure and may set a strictly necessary security cookie of its own. Google Fonts supplies the typeface, so Google sees your IP address when a page opens. Your browser’s push service carries notifications if you turn them on. The privacy notice says more.',
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
