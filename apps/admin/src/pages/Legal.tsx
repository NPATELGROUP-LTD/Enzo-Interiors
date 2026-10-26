import { CaretLeft } from '@phosphor-icons/react';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';

import { EnzoMark } from '@/components/layout/AuthScreen';
import { APP_NAME, COMPANY, LEGAL, LEGAL_KINDS, UPDATED, type Block, type LegalKind } from '@/lib/legal';

/** A web address or an email address. */
const LINKABLE = /(https?:\/\/[^\s,;)]+[^\s.,;:!?)]|[\w.+-]+@[\w-]+(?:\.[\w-]+)+)/;

/** Web and email addresses in the text become links. */
function Text({ children }: { children: string }) {
  return (
    <>
      {children.split(LINKABLE).map((part, index) =>
        index % 2 === 0 ? (
          part
        ) : (
          <a
            key={index}
            href={part.startsWith('http') ? part : `mailto:${part}`}
            {...(part.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            className="text-link"
          >
            {part}
          </a>
        ),
      )}
    </>
  );
}

function Body({ block }: { block: Block }) {
  if (typeof block === 'string') {
    return (
      <p className="mt-3 text-ink">
        <Text>{block}</Text>
      </p>
    );
  }
  return (
    <ul className="mt-3 list-disc space-y-2 pl-5 text-ink marker:text-ink-muted">
      {block.map((item) => (
        <li key={item}>
          <Text>{item}</Text>
        </li>
      ))}
    </ul>
  );
}

const TITLES: Record<LegalKind, string> = { privacy: 'Privacy notice', terms: 'Terms of use', cookies: 'Cookies' };

/**
 * One of the three legal pages, on its own: it opens signed in or out (the
 * sign-in screen links to it) and has no menu bar. The text is in lib/legal.ts.
 */
export function LegalPage({ kind }: { kind: LegalKind }) {
  const doc = LEGAL[kind];

  useEffect(() => {
    const before = document.title;
    document.title = `${doc.title} · ${APP_NAME}`;
    return () => {
      document.title = before;
    };
  }, [doc.title]);

  return (
    <div className="min-h-dvh bg-surface text-ink">
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-6 py-6">
        <div className="flex items-center gap-3 text-green-900 dark:text-ink">
          <EnzoMark className="h-8" />
          <span className="sr-only">Enzo Interiors</span>
        </div>
        <Link to="/" className="text-link inline-flex min-h-11 items-center gap-1 text-sm">
          <CaretLeft size={14} aria-hidden="true" />
          Back
        </Link>
      </header>

      <main className="mx-auto w-full max-w-3xl px-6 pb-16">
        <p className="text-sm font-semibold text-ink-muted">{APP_NAME}</p>
        <h1 className="mt-1 text-[28px] font-bold leading-tight tracking-tight">{doc.title}</h1>
        <p className="mt-1 text-sm text-ink-muted">Updated {UPDATED}</p>
        <p className="mt-5 text-ink">{doc.intro}</p>

        <nav aria-label="On this page" className="mt-6 rounded-card border border-border p-4">
          <p className="text-sm font-semibold text-ink-muted">On this page</p>
          <ol className="mt-2 space-y-1">
            {doc.clauses.map((clause, index) => (
              <li key={clause.id}>
                <a href={`#${clause.id}`} className="text-link inline-flex min-h-8 items-center text-sm">
                  {index + 1}. {clause.heading}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {doc.clauses.map((clause, index) => (
          <section key={clause.id} id={clause.id} className="mt-9 scroll-mt-6">
            <h2 className="text-lg font-semibold tracking-tight">
              {index + 1}. {clause.heading}
            </h2>
            {clause.body.map((block, at) => (
              <Body key={at} block={block} />
            ))}
          </section>
        ))}

        <footer className="mt-12 border-t border-border pt-6 text-sm text-ink-muted">
          <p>
            Questions about this page:{' '}
            <a href={`mailto:${COMPANY.privacyEmail}`} className="text-link">
              {COMPANY.privacyEmail}
            </a>
          </p>
          <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
            {LEGAL_KINDS.filter((other) => other !== kind).map((other) => (
              <Link key={other} to={`/${other}`} className="text-link inline-flex min-h-8 items-center">
                {TITLES[other]}
              </Link>
            ))}
          </p>
        </footer>
      </main>
    </div>
  );
}
