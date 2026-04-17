# 🌙 Moontabs

> Tabs that sleep. Learns your patterns and protects the ones you always come back to.

[![Firefox Add-on](https://img.shields.io/badge/Firefox-Add--on-FF7139?logo=firefox-browser&logoColor=white)](https://addons.mozilla.org/en-US/firefox/addon/moontabs/)
[![License](https://img.shields.io/badge/License-Custom%20Non--Commercial-a78bfa)](#license)
[![Manifest V2](https://img.shields.io/badge/Manifest-V2-22d3ee)]()

---

## What it does

Moontabs automatically sleeps inactive tabs to save memory without actually closing them, so you can return exactly where you left off. Unlike traditional tab managers, it learns your browsing patterns over time and adapts to how you use the web.

Every time you visit a tab it records a timestamp. Over time it calculates your average return interval per domain. If you typically return to a tab on a longer cycle than the inactivity limit, it gets a grace period proportional to your pattern instead of being closed blindly.

**Example:** inactivity limit is 5 minutes. You open Spotify and leave it. You come back every 30 minutes. Moontabs learns the 30-minute pattern and stops discarding it.

No AI. No API. No server. Just timestamps and math, running entirely in your browser.

---

## Install

**[→ Get it on Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/moontabs/)**

---

## Configuration

Everything is configurable directly from the popup — no code editing needed. Click any value to change it:

| Setting | Default | What it does |
|---|---|---|
| Discard after | 5 mins | How long a tab can be inactive before being discarded |
| Ignore gaps over | 8 hrs | Gaps longer than this are excluded from pattern learning |
| Ignore gaps | same as discard after | Rapid tab switching noise, excluded from learning |
| Exceptions | — | Domains that are never discarded, regardless of activity |

---

## How the learning works

1. Each tab visit is timestamped and stored locally
2. On each check cycle, gaps between visits are filtered — anything under `MIN_GAP` (rapid switching noise) or over `MAX_GAP` (you just forgot about it) is excluded
3. The average of the remaining gaps is your **return interval** for that domain
4. If your return interval is shorter than the inactivity limit, the domain is protected
5. If it's longer, the tab gets a grace period of `1.5 × avg return interval` before being discarded

Up to 100 visits per domain are stored. It takes a minimum of 2 visits before any learning kicks in.

---

## Permissions

| Permission | Why |
|---|---|
| `tabs` | Read tab URLs and activity state |
| `storage` | Persist visit history and settings locally |
| `alarms` | Run the inactivity check every minute |
| `sessions` | Reserved for future session restore support |

No data leaves your browser.

---

## Built for

[Zen Browser](https://zen-browser.app/) and Firefox. Uses Manifest V2 and the `browser.*` namespace.

---

## License

Copyright (c) 2025 Aahan (AndroPwn)

Free to use, study, and share for **non-commercial purposes** with attribution and a link back to this repo. Commercial use requires explicit written permission.

Contact: andromedapwn@gmail.com# 🌙 Moontabs

> Tabs that sleep. Learns your patterns and protects the ones you always come back to.

[![Firefox Add-on](https://img.shields.io/badge/Firefox-Add--on-FF7139?logo=firefox-browser&logoColor=white)](https://addons.mozilla.org/en-US/firefox/addon/moontabs/)
[![License](https://img.shields.io/badge/License-Custom%20Non--Commercial-a78bfa)](#license)
[![Manifest V2](https://img.shields.io/badge/Manifest-V2-22d3ee)]()

