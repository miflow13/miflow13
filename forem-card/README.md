# Forem README Card — v1

A live, embeddable DEV Community profile card for GitHub READMEs.

The card uses the public [Forem API](https://developers.forem.com/api/v1) and renders a cache-friendly SVG. No DEV API key is required for the default card.

## What v1 shows

- DEV avatar, display name, username, bio, location, and join date
- Published post count
- Total public reactions
- Total comments
- Total published reading time
- Top five tags
- Dark and light themes
- Inline avatar embedding so the SVG remains self-contained when GitHub proxies it

> DEV's follower endpoint is authenticated, so follower totals are intentionally not faked or scraped in v1.

## Endpoint

```text
/api/card?username=miflow13
```

Optional theme:

```text
/api/card?username=miflow13&theme=light
```

## GitHub README usage

After deployment:

```md
[![Mika's DEV profile](https://YOUR-DEPLOYMENT.vercel.app/api/card?username=miflow13)](https://dev.to/miflow13)
```

Or centered:

```html
<p align="center">
  <a href="https://dev.to/miflow13">
    <img
      src="https://YOUR-DEPLOYMENT.vercel.app/api/card?username=miflow13"
      alt="Mika Flowers on DEV Community"
      width="800"
    />
  </a>
</p>
```

## Deploy to Vercel

This v1 is currently staged inside Mika's profile repository under `forem-card/`.

When deploying from this repository:

1. Import the repository into Vercel.
2. Set **Root Directory** to `forem-card`.
3. Deploy.
4. Open `/api/card?username=miflow13`.

No environment variables are required.

## Data source

v1 requests:

```text
GET https://dev.to/api/users/:username
GET https://dev.to/api/articles?username=:username&page=:page&per_page=100
```

Responses are cached for about 15 minutes at the card endpoint.

## Safety / rendering notes

- Usernames are restricted to alphanumeric, underscore, and hyphen characters.
- All Forem-provided text is XML-escaped before SVG rendering.
- Remote avatars are fetched server-side and embedded as data URIs.
- Oversized avatar payloads are ignored rather than bloating the SVG.
- Upstream failures render a valid error SVG instead of a broken image.

## v1.1 ideas

- Compact layout
- More theme presets
- Custom accent colors
- Hide/show individual stats
- Generic Forem-instance support with a safe host allowlist
- Optional authenticated self-host mode for follower stats
- Recent article card mode

---

Built with the Forem API for developer profile READMEs.
