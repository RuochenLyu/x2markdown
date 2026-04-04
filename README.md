# x2markdown

English | [中文](README.zh-CN.md)

<a href="https://chromewebstore.google.com/detail/x2markdown/acljfllclafamkhdjjkldogcadfbigmo">
  <img src="https://raw.githubusercontent.com/GoogleChrome/webstore-docs/refs/heads/master/images/ChromeWebStore_BadgeWBorder_v2_496x150.png" alt="Available in the Chrome Web Store" width="248" height="75">
</a>

`x2markdown` is a Chrome extension that converts visible webpage content into clean Markdown with one right-click — ready to paste into LLM chats, append to personal knowledge bases, or save as `.md` reference files. On `x.com`, it additionally provides dedicated export for posts and longform articles.

This project is primarily for showcase and personal use. It is open-sourced under the MIT license and does not accept external code contributions by default.

![x2markdown overview](./docs/images/overview.svg?v=2)

## What Problem Does It Solve

LLMs work best when they receive well-structured text. But getting content from a browser into that form is surprisingly manual:

- Dropping a link into an AI chat often fails to capture the full content or context.
- Copying visible webpage content loses structure — titles, links, body text, and image URLs all need manual cleanup.
- On `x.com`, blogs, documentation sites, forums, and issue pages, there is frequently content that is "visible to me but unreadable by AI."

Whether you are pasting into a chat window, building an LLM-friendly knowledge base, or archiving web research as Markdown, `x2markdown` reduces the process to a single right-click.

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

## Non-Goals

- Does not export entire X threads.
- Does not capture video, GIF, poll results, or comment sections.
- Does not attempt to bypass login walls, paywalls, or unrendered content.
- Does not cover `twitter.com` or `mobile.x.com`.

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

See [docs/examples/post.md](./docs/examples/post.md) for X Article output examples.

## Implementation Overview

- Uses native Manifest V3.
- Uses Chrome's built-in `/_locales` mechanism to provide `zh_CN` and `en` runtime text; unmatched languages fall back to English.
- Uses a `background service worker` to create the Chrome right-click menu.
- Permission strategy is kept minimal:
  - Generic webpages rely only on `activeTab + scripting + contextMenus + clipboardWrite`.
  - No site-wide `host_permissions` are declared.
  - Only `x.com` retains a persistent content script for timeline card targeting.
- When the user clicks the menu item:
  - `x.com` routes through the persistent `content-x.js`.
  - Other pages inject `shared.js + readability.js + content-generic.js` on demand.
- Generic mode prioritizes selection; only attempts Readability for full-page extraction when there is no selection.
- When a truncated X post is hit in the timeline, the content script clicks `tweet-text-show-more-link` inside the target `article[data-testid="tweet"]` and waits for the text to expand before extracting.
- X extraction logic relies primarily on visible DOM and semantic nodes:
  - `article[data-testid="tweet"]`
  - `time[datetime]`
  - `data-testid="User-Name"`
  - `data-testid="tweetText"`
  - `data-testid="twitterArticleReadView"`
  - `data-testid="twitter-article-title"`
- Generic body extraction uses vendored `Mozilla Readability`, then converts structured content via a local Markdown walker.
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

- X's DOM structure changes frequently; dedicated extraction logic may break.
- Generic webpage mode is biased toward "article pages" rather than aggregate pages; homepages, navigation pages, and product pages work better with selection mode.
- Only the current post / article / right-clicked post card is exported; no thread merging.
- Regular X posts have no native title, so no title field is output.
- Some longform articles render directly as a reading view on `status` pages and are exported in longform format.
- Timeline posts rely on the most recently right-clicked visible card; if no post is hit, the extension reports failure.
- "Show more" depends on async rendering after a button click; if X does not return the full text, the extension extracts whatever is visible at that point.
- Only Simplified Chinese and English are built in; other browser languages fall back to English.
- Iframes, login walls, paywalls, and lazy-loaded unrendered content are not guaranteed to be exportable.

See [docs/troubleshooting.md](./docs/troubleshooting.md) for common issues.

## Documentation

- [Design Notes](./docs/design.md)
- [Troubleshooting](./docs/troubleshooting.md)
- [Output Examples](./docs/examples/post.md)

## Open Source

- License: MIT
- Repository purpose: showcase and reusable implementation reference
- Contribution policy: external PRs and issue workflow are not accepted by default

## License

This project is licensed under the [MIT License](./LICENSE).
