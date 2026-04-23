<p align="center">
  <img src="./icons/logo.png" width="96" height="96" alt="x2markdown" />
</p>

<h1 align="center">x2markdown</h1>

<p align="center">
  Right-click any webpage — or <code>x.com</code> post — into clean Markdown, ready for your LLM workflow.
</p>

<p align="center">
  <a href="https://chromewebstore.google.com/detail/x2markdown/acljfllclafamkhdjjkldogcadfbigmo">
    <img src="https://img.shields.io/chrome-web-store/v/acljfllclafamkhdjjkldogcadfbigmo?label=Chrome%20Web%20Store" alt="Chrome Web Store" />
  </a>
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT" />
  <img src="https://img.shields.io/badge/manifest-v3-success" alt="Manifest V3" />
</p>

<p align="center">
  English · <a href="README.zh-CN.md">中文</a>
</p>

---

`x2markdown` is a Chrome extension. Right-click any page and it turns into clean Markdown — paste it into an LLM chat, drop it into your knowledge base, or save it as `.md`. On `x.com`, it also adds dedicated export for posts and longform articles.

A showcase and personal-use project. Open-sourced under MIT, but not actively accepting external contributions.

![x2markdown overview](./docs/images/overview.svg?v=2)

<p align="center">
  <a href="https://chromewebstore.google.com/detail/x2markdown/acljfllclafamkhdjjkldogcadfbigmo">
    <img src="https://raw.githubusercontent.com/GoogleChrome/webstore-docs/refs/heads/master/images/ChromeWebStore_BadgeWBorder_v2_496x150.png" alt="Available in the Chrome Web Store" width="248" height="75">
  </a>
</p>

## Why

LLMs handle well-structured text best. But getting a browser page into that shape is surprisingly fiddly:

- Drop a link into an AI chat and it often misses the body or the surrounding context.
- Copy straight from the browser and the structure is gone — titles, links, body, image URLs all need manual cleanup.
- Across `x.com`, blogs, docs sites, forums, and issue pages, you keep running into content that's "visible to me but unreadable by AI."

Whether you're pasting into a chat window, feeding a personal knowledge base, or archiving research as Markdown, `x2markdown` shortens the whole thing to one right-click.

## Features

- Adds "Copy as Markdown" to the right-click menu on any `http/https` page.
- For generic webpages:
  - Copies the user's selection when one exists.
  - Falls back to extracting the full page body when there is no selection.
  - Shows a clear prompt to select content when the page is not recognized as an article.
- Copying a regular X post outputs:
  - Author
  - Time
  - Link
  - Body
  - Quoted post (if present)
  - Image links
- On `status` detail pages, if the main post is followed by consecutive self-replies at the top, the extension exports the whole thread in order.
- Copying an X Article or longform reading view additionally outputs the title.
- Generic webpage mode supports title, site name, author, time, body, and image links; missing fields are omitted.
- Images are output as links, not as embedded Markdown images.
- When a truncated post is hit in the timeline, it attempts to click "Show more" before copying.
- Runtime text follows the Chrome UI language, switching between Simplified Chinese and English.
- Success and failure toasts match the browser language.
- Supported detail page formats:
  - `https://x.com/<user>/status/<id>`
  - `https://x.com/<user>/article/<id>`
- Supports right-click export of individual post cards visible in `x.com` feeds, lists, and search results.

## What It Doesn't Do

- No full-conversation export and no pulling other users' reply threads.
- No video, GIF, poll results, or comment sections.
- No bypassing login walls, paywalls, or unrendered content.
- No `twitter.com` or `mobile.x.com`.

## Installation

Install directly from the [Chrome Web Store](https://chromewebstore.google.com/detail/x2markdown/acljfllclafamkhdjjkldogcadfbigmo).

For local development or debugging:

1. Clone the repository.
2. Open Chrome and navigate to `chrome://extensions`.
3. Enable "Developer mode" in the top right.
4. Click "Load unpacked."
5. Select the repository root directory.
6. After making code changes, click "Reload" on the extension card.

## Usage

1. Open any webpage whose content you want to copy.
2. To copy only part of the content, select the text first; to copy the entire article, right-click directly on the page.
3. Choose "Copy Body as Markdown" or "Copy Selection as Markdown."
4. Paste the result into an AI chat, Markdown editor, or note-taking tool.

Extra rules for `x.com`:

- On detail pages and longform pages, right-click anywhere to copy.
- On `status` detail pages, it first tries to export the full thread defined as the main post plus the top consecutive self-replies.
- In feeds, lists, and search results, right-click inside the target post card.

## Output Formats

Regular post example:

```md
Author: Example Author (@example)
Time: 2026-03-18 16:30:00
Link: https://x.com/example/status/1234567890123456789

Body:
This is an example post containing an [external link](https://example.com).

Quoted Post:
Author: Quoted Author (@quoted)
Time: 2024-01-02 12:55:59
Link: https://x.com/quoted/status/9876543210987654321
Body:
> This is the body of the quoted post.

Images:
- [Image 1](https://pbs.twimg.com/media/example-1.jpg?format=jpg&name=large)
```

Generic webpage example:

```md
# Understanding React Server Components

Site: react.dev
Author: React Team
Time: 2026-04-01 10:00:00
Link: https://react.dev/example

Body:
This is the extracted body content.

Images:
- [Image 1](https://example.com/hero.png)
```

See [docs/examples/post.md](./docs/examples/post.md) for X post, thread, and X Article output examples.

## How It Works

- Native Manifest V3.
- Localization via Chrome's `/_locales` — `zh_CN` and `en` are shipped, anything else falls back to English.
- The right-click menu is created by a `background service worker`.
- Permissions kept tight:
  - Generic pages only need `activeTab + scripting + contextMenus + clipboardWrite`.
  - No site-wide `host_permissions`.
  - Only `x.com` keeps a persistent content script, used to target timeline cards on right-click.
- When the menu is clicked:
  - `x.com` routes through the persistent `content-x.js`.
  - Other pages inject `shared.js + readability.js + content-generic.js` on demand.
- Generic mode copies the selection if there is one; otherwise it runs Readability on the full page.
- When a truncated X post is hit in the timeline, the content script clicks `tweet-text-show-more-link` inside the target `article[data-testid="tweet"]` and waits for the text to expand before extracting.
- On `status` detail pages it starts at the main post and collects the top consecutive same-author replies; it stops at the first reply from someone else.
- X extraction leans on visible DOM and semantic nodes:
  - `article[data-testid="tweet"]`
  - `time[datetime]`
  - `data-testid="User-Name"`
  - `data-testid="tweetText"`
  - `data-testid="twitterArticleReadView"`
  - `data-testid="twitter-article-title"`
- Generic body extraction uses a vendored copy of `Mozilla Readability`, then a local Markdown walker converts the structured content.
- Clipboard write prefers `navigator.clipboard.writeText()`, falling back to `document.execCommand('copy')`.

## Directory Structure

```text
x2markdown/
├── AGENTS.md
├── LICENSE
├── README.md
├── README.zh-CN.md
├── background.js
├── content-generic.js
├── content-x.js
├── content.css
├── readability.js
├── shared.js
├── docs
│   ├── design.md
│   ├── examples
│   │   └── post.md
│   ├── images
│   │   └── overview.svg
│   └── troubleshooting.md
├── icons
│   ├── icon-16.png
│   ├── icon-32.png
│   ├── icon-48.png
│   ├── icon-128.png
│   └── logo.png
├── manifest.json
└── .gitignore
```

## Known Limitations

- X's DOM changes often, so the dedicated extraction logic can break at any time.
- Generic mode is tuned for "article pages"; homepages, navigation pages, and product pages are better handled with selection mode.
- Thread export on `status` pages only covers the main post and the consecutive same-author replies right after it — not the author's later scattered replies in the comment section.
- Regular X posts have no native title, so no title field is emitted.
- Some longform articles render directly as a reading view on `status` pages and get exported in the longform format.
- Timeline posts rely on the most recently right-clicked visible card; if nothing is hit, the extension just reports failure.
- "Show more" depends on async rendering after the click — if X doesn't return the full text, the extension takes whatever is visible at that point.
- Only Simplified Chinese and English are built in; other browser languages fall back to English.
- Iframes, login walls, paywalls, and lazy-loaded unrendered content aren't guaranteed to export.

For common issues, see [docs/troubleshooting.md](./docs/troubleshooting.md).

## Documentation

- [Design Notes](./docs/design.md)
- [Troubleshooting](./docs/troubleshooting.md)
- [Output Examples](./docs/examples/post.md)

## Open Source

- License: MIT.
- Purpose: project showcase and a reference implementation to reuse.
- Contributions: external PRs and issue workflow aren't accepted by default.

## License

This project is licensed under the [MIT License](./LICENSE).
