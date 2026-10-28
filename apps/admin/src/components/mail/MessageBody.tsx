import { Image as ImageIcon } from '@phosphor-icons/react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui';
import { hasRemoteImages, srcDoc } from '@/lib/mail';

/**
 * A message's HTML (already sanitised by the API) in a sandboxed frame: no
 * scripts, and the frame's own policy keeps remote pictures out, so opening
 * mail never tells a sender it was read. "Load images" reloads the frame with
 * pictures allowed, for this message only.
 *
 * allow-same-origin is there only so the page can measure the frame to size
 * it; without allow-scripts nothing inside can run, so it cannot reach the app.
 */
export function MessageBody({ html }: { html: string }) {
  const [images, setImages] = useState(false);
  const [height, setHeight] = useState(160);
  const frame = useRef<HTMLIFrameElement>(null);
  const remote = useMemo(() => hasRemoteImages(html), [html]);
  const doc = useMemo(() => srcDoc(html, images), [html, images]);

  const fit = () => {
    const page = frame.current?.contentDocument?.documentElement;
    if (page) setHeight(Math.min(Math.max(page.scrollHeight, 60), 30_000));
  };
  useEffect(() => {
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  return (
    <div>
      {remote && !images ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-control bg-surface-muted px-3 py-2 text-[13px] text-ink-muted">
          <span>Pictures are hidden so the sender cannot tell you opened this.</span>
          <Button variant="secondary" icon={<ImageIcon size={15} aria-hidden="true" />} onClick={() => setImages(true)} className="min-h-8 px-2.5 text-[13px] pointer-fine:min-h-8">
            Load images
          </Button>
        </div>
      ) : null}
      <iframe
        ref={frame}
        title="Message"
        sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        referrerPolicy="no-referrer"
        srcDoc={doc}
        onLoad={fit}
        style={{ height }}
        className="block w-full rounded-control border-0 bg-white"
      />
    </div>
  );
}
