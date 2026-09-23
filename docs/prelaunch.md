# Pre-launch checklist

What has to happen outside the code before the site is switched to **Live** in
the admin (Settings → Website). Tick them off in order.

## Email

- [ ] Pick an SMTP provider (Postmark, Amazon SES, Resend, or the Google
      Workspace relay) and set `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`,
      `SMTP_USER`, `SMTP_PASS` in the root `.env`.
- [ ] Set `MAIL_FROM` to an address on the Enzo domain, e.g.
      `Enzo Interiors <no-reply@enzointeriors.co.uk>`.
- [ ] Add the provider's **SPF** and **DKIM** DNS records for that domain, and a
      **DMARC** record (`v=DMARC1; p=quarantine; rua=mailto:…`). Without these,
      reset links and enquiries land in spam.
- [ ] Remove `COMPOSE_PROFILES=dev` from the production `.env`, so Mailpit
      does not run.
- [ ] In the admin: Settings → Notifications, add the address(es) that should
      receive enquiries, then **Send test email**.

## Addresses and proxy

- [ ] `WEB_PUBLIC_URL`, `ADMIN_URL`, `API_PUBLIC_URL` and `MEDIA_BASE_URL` are
      the real `https://` hostnames. The admin and web images are built against
      them, so rebuild after changing them.
- [ ] `TRUST_PROXY=2` behind Coolify + Cloudflare Tunnel, so rate limits and
      login lockouts see visitors' IPs rather than the proxy's.
- [ ] Cloudflare: cache the media hostname (the objects are sent with
      `Cache-Control: public, max-age=31536000, immutable`).

## Content

- [ ] Replace the 27 placeholder images. In the admin they are the images whose
      source is `unsplash` or `randomuser` (search "unsplash" in the image
      picker). The testimonial faces are stock photos next to real-sounding
      reviews; replace them or remove the photo.
- [ ] Company → address: fill in the street and postcode. It feeds the local
      business listing Google reads.
- [ ] Each page's "Search results" section: check the title and description,
      and choose a share image if the generated card is not wanted.
- [ ] Read the privacy, terms and cookie pages against how the business
      actually operates (enquiry emails are now stored and emailed).

## Search

- [ ] Google Search Console: verify the domain (DNS, or put the HTML-tag code in
      `GOOGLE_SITE_VERIFICATION`), then submit `https://<site>/sitemap.xml`.
- [ ] Bing Webmaster Tools: import from Search Console.
- [ ] Google Business Profile for the studio, with the same name, phone and
      address as the site.
- [ ] After launch: validate a service page at https://validator.schema.org and
      run Lighthouse (SEO ≥ 95).

## Going live

- [ ] Settings → Website: either set an opening time (the site opens itself and
      the countdown reloads visitors' pages) or switch to **Live**.
- [ ] Change the first admin's password (app menu → Change password). The
      `ADMIN_PASSWORD` in `.env` is only used on the very first boot.
