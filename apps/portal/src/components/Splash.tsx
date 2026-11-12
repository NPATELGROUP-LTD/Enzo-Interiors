import { useEffect, useState } from 'react';

import { EnzoMark } from '@/components/layout/AuthScreen';
import { api } from '@/lib/api';

/** When it last played, and the logo to show next time. public/theme-init.js reads the first one too. */
const SHOWN = 'enzo:splash-at';
const LOGO = 'enzo:splash-logo';
const AWAY = 8 * 60 * 60 * 1000;

/** True on this device's first load, and again 8 hours after it last played. No storage = it plays. */
function due(): boolean {
  try {
    const last = Number(localStorage.getItem(SHOWN));
    return !last || Date.now() - last >= AWAY;
  } catch {
    return true;
  }
}

/**
 * The opening animation: the studio's logo on brand green, the logo leaves
 * upwards, then the green lifts off the top with a sagging rounded edge
 * (styles/theme.css, `.splash`). About 1.6 seconds, over whatever page loads;
 * the app signs in and loads underneath meanwhile. It plays with reduced motion
 * too, at the owner's request.
 *
 * The logo is the one for dark backgrounds from Settings › Logo & icon. Its
 * address is remembered from the last time, so nothing waits on the network:
 * a device's first showing uses the shipped mark. apps/admin and apps/portal
 * keep identical copies.
 */
export function Splash() {
  const [playing, setPlaying] = useState(due);
  const [logo, setLogo] = useState<string | null>(() => {
    try {
      return localStorage.getItem(LOGO);
    } catch {
      return null;
    }
  });

  useEffect(() => {
    // theme-init.js painted the page green until this took over.
    document.documentElement.classList.remove('splash-due');
    if (!playing) return;
    try {
      localStorage.setItem(SHOWN, String(Date.now()));
    } catch {
      /* private mode: it plays on every load */
    }
    fetch(`${api.baseUrl}/content/site`)
      .then((response) => response.json())
      .then((bundle: { site?: { brand?: { logoDark?: string | null } }; media?: Array<{ id: string; src: string }> }) => {
        const src = bundle.media?.find((item) => item.id === bundle.site?.brand?.logoDark)?.src;
        if (src) localStorage.setItem(LOGO, src);
        else localStorage.removeItem(LOGO);
      })
      .catch(() => undefined);
    const done = window.setTimeout(() => setPlaying(false), 1650);
    return () => window.clearTimeout(done);
  }, [playing]);

  // An installed app comes back without a reload: play it then too.
  useEffect(() => {
    const back = () => {
      if (document.visibilityState === 'visible' && due()) setPlaying(true);
    };
    document.addEventListener('visibilitychange', back);
    return () => document.removeEventListener('visibilitychange', back);
  }, []);

  if (!playing) return null;
  return (
    <div className="splash" aria-hidden="true">
      {logo ? (
        <img src={logo} alt="" className="max-h-20 max-w-[60vw]" onError={() => setLogo(null)} />
      ) : (
        <EnzoMark className="h-16 text-[#f7f5f0]" />
      )}
    </div>
  );
}
