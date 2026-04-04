# smart-tab-closer

A Firefox/Zen Browser extension that closes inactive tabs — but learns which ones you always come back to, and leaves those alone.

## How it works

Every time you visit a tab it records a timestamp. Over time it calculates your average return interval per domain. If you typically return to a tab on a longer cycle than the inactivity limit, it protects it from being closed.

Example: inactivity limit is 5 minutes. You open Spotify and leave it. You come back every 30 minutes. The extension learns the 30-minute pattern and stops closing it.

No AI. No API. No server. Just timestamps and math, running entirely in your browser.

## Install

1. Clone this repo
2. Open `about:debugging` in Zen or Firefox
3. Click Load Temporary Add-on
4. Select `manifest.json`

## Adjust the defaults

At the top of `background.js`:
```js
const INACTIVITY_LIMIT = 5 * 60 * 1000; // change 5 to any number of minutes
```

## Built for

Zen Browser and Firefox. Uses Manifest V2 and the `browser.*` namespace.
