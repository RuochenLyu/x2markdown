<p align="center">
  <img src="./icons/logo.png" width="96" height="96" alt="x2markdown" />
</p>

<h1 align="center">x2markdown</h1>

<p align="center">
  右键一下，把网页或 <code>x.com</code> 帖子转成整洁的 Markdown，粘给 LLM 就能用。
</p>

<p align="center">
  <a href="https://chromewebstore.google.com/detail/x2markdown/acljfllclafamkhdjjkldogcadfbigmo">
    <img src="https://img.shields.io/chrome-web-store/v/acljfllclafamkhdjjkldogcadfbigmo?label=Chrome%20Web%20Store" alt="Chrome Web Store" />
  </a>
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT" />
  <img src="https://img.shields.io/badge/manifest-v3-success" alt="Manifest V3" />
</p>

<p align="center">
  <a href="README.md">English</a> · 中文
</p>

---

`x2markdown` 是一个 Chrome 扩展。在网页上右键一下，当前内容就变成整洁的 Markdown——可以直接粘进 LLM 对话框、存进自己的知识库，或者保存成 `.md` 备用。在 `x.com` 上额外支持帖子和长文的专门导出。

这是一个以展示和自用为主的项目。代码用 MIT 协议开源，默认不接收外部贡献。

![x2markdown 示意图](./docs/images/overview.svg?v=2)

<p align="center">
  <a href="https://chromewebstore.google.com/detail/x2markdown/acljfllclafamkhdjjkldogcadfbigmo">
    <img src="https://raw.githubusercontent.com/GoogleChrome/webstore-docs/refs/heads/master/images/ChromeWebStore_BadgeWBorder_v2_496x150.png" alt="Available in the Chrome Web Store" width="248" height="75">
  </a>
</p>

## 为什么做这个

LLM 更擅长处理结构化文本，可从浏览器里拿到这种文本却意外地麻烦：

- 直接把链接丢给 AI，常常抓不到正文，或者上下文不全。
- 直接复制网页，标题、链接、正文和图片 URL 都会丢失结构，得手动理一遍。
- `x.com`、博客、文档站、论坛帖、issue 页面里，总能遇到"我看得见、但 AI 读不到"的内容。

不管是粘进对话窗口、喂进自己的知识库，还是把网页归档成 Markdown，`x2markdown` 都把这一步省成一次右键。

## 功能

- 在任意 `http/https` 网页的右键菜单里加一项"复制为 Markdown"。
- 普通网页：
  - 有选区就复制选区；
  - 没选区就提取整页正文；
  - 页面不是文章时，会提示先选中要复制的内容。
- 复制普通 X 帖子时输出：
  - 作者
  - 时间
  - 链接
  - 正文
  - 引用内容（如有）
  - 图片链接
- 在 `status` 详情页上，如果主贴后面紧跟着作者自己的连续回复，会按顺序一起导出整条帖子串。
- 复制 X Article 或长文阅读视图时，额外带上标题。
- 普通网页支持标题、站点、作者、时间、正文和图片链接；缺失字段就直接省略。
- 图片只输出成链接，不转成 Markdown 图片语法。
- 在时间线里碰到被截断的帖子时，会先点一下"显示更多"再复制。
- 运行时文案跟着 Chrome 界面语言在简体中文和英文之间切换。
- 成功和失败的提示也按浏览器语言显示。
- 支持的详情页地址：
  - `https://x.com/<user>/status/<id>`
  - `https://x.com/<user>/article/<id>`
- 在 `x.com` 时间线、列表和搜索结果里，可以对看到的单条帖子卡片右键导出。

## 不做的事

- 不导出完整的对话页，也不抓评论区里别人的回复。
- 不抓视频、GIF、投票结果或评论内容。
- 不绕登录墙、付费墙或没渲染出来的内容。
- 不管 `twitter.com` 和 `mobile.x.com`。

## 安装

直接从 [Chrome Web Store](https://chromewebstore.google.com/detail/x2markdown/acljfllclafamkhdjjkldogcadfbigmo) 安装就行。

本地开发或调试：

1. 克隆本仓库。
2. 打开 Chrome，进入 `chrome://extensions`。
3. 打开右上角的"开发者模式"。
4. 点"加载已解压的扩展程序"。
5. 选仓库根目录。
6. 之后每次改完代码，在扩展页上点一下"重新加载"即可。

## 使用

1. 打开想复制的网页。
2. 只想复制一部分就先选中文本；想复制整页就直接在页面上右键。
3. 选"复制为 Markdown"。
4. 把结果粘到 AI 对话框、Markdown 编辑器或笔记工具里。

`x.com` 上的特殊规则：

- 详情页和长文页可以直接右键复制。
- `status` 详情页会先尝试导出"主贴 + 作者连发的帖子"这一整串。
- 时间线、列表、搜索结果里，要在目标帖子卡片内右键。

## 输出格式

普通帖子示例：

```md
作者: Example Author (@example)
时间: 2026-03-18 16:30:00
链接: https://x.com/example/status/1234567890123456789

正文:
这是一条示例帖子，里面有一个[外部链接](https://example.com)。

引用内容:
作者: Quoted Author (@quoted)
时间: 2024-01-02 12:55:59
链接: https://x.com/quoted/status/9876543210987654321
正文:
> 这是被引用帖子的正文。

图片:
- [图片 1](https://pbs.twimg.com/media/example-1.jpg?format=jpg&name=large)
```

普通网页示例：

```md
# Understanding React Server Components

站点: react.dev
作者: React Team
时间: 2026-04-01 10:00:00
链接: https://react.dev/example

正文:
这里是提取后的正文内容。

图片:
- [图片 1](https://example.com/hero.png)
```

X 帖子、帖子串、X Article 的完整输出示例见 [docs/examples/post.md](./docs/examples/post.md)。

## 实现要点

- 原生 Manifest V3。
- 本地化走 Chrome 的 `/_locales` 机制，提供 `zh_CN` 和 `en` 两套文案；没匹配的语言回退到英文。
- 右键菜单由 `background service worker` 创建。
- 权限尽量少：
  - 普通网页只要 `activeTab + scripting + contextMenus + clipboardWrite`；
  - 不声明全站 `host_permissions`；
  - 只有 `x.com` 保留一个常驻 content script，用来定位时间线上的帖子卡片。
- 点菜单之后：
  - `x.com` 走常驻的 `content-x.js`；
  - 其他网页按需注入 `shared.js + readability.js + content-generic.js`。
- 普通模式下，有选区就复制选区，没选区才用 Readability 提取整页正文。
- 时间线碰到被截断的帖子时，content script 会在当前 `article[data-testid="tweet"]` 里找 `tweet-text-show-more-link` 点一下，等文字展开再提取。
- 在 `status` 详情页上，只收集主贴和后面紧跟的同作者连续帖子；遇到第一条别人的回复就停下，不往评论区里抓。
- X 相关的提取主要依赖可见 DOM 和这些语义节点：
  - `article[data-testid="tweet"]`
  - `time[datetime]`
  - `data-testid="User-Name"`
  - `data-testid="tweetText"`
  - `data-testid="twitterArticleReadView"`
  - `data-testid="twitter-article-title"`
- 普通网页正文用内置的 `Mozilla Readability` 提取，再用本地写的 Markdown walker 把结构化内容转过去。
- 写剪贴板优先用 `navigator.clipboard.writeText()`，失败时退回 `document.execCommand('copy')`。

## 目录结构

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

## 已知限制

- X 的 DOM 经常变，专用提取逻辑随时可能失效。
- 普通模式更适合"正文页"；首页、导航页、产品页这些聚合类页面，还是用选区模式更稳。
- `status` 页的帖子串导出只管主贴加上作者连发的部分，作者后面零散回评论就不再收。
- 普通 X 帖子没有原生标题字段，所以不会输出标题。
- 有些长文会在 `status` 页面直接以阅读视图渲染，这种会按长文格式导出。
- 时间线里的帖子靠最近一次右键命中的卡片；没命中就直接提示失败。
- "显示更多"依赖点击后的异步加载，如果 X 没把完整内容返回，只能按当时看到的内容导出。
- 目前只内置简体中文和英文，其他浏览器语言回退到英文。
- iframe、登录墙、付费墙和懒加载没渲染的内容，不保证能导出。

碰到问题先看 [docs/troubleshooting.md](./docs/troubleshooting.md)。

## 文档

- [设计说明](./docs/design.md)
- [排障说明](./docs/troubleshooting.md)
- [输出示例](./docs/examples/post.md)

## 开源

- 许可证：MIT。
- 仓库定位：以项目展示和代码参考为主。
- 贡献策略：默认不走外部 PR 和 issue 流程。

## License

本项目使用 [MIT License](./LICENSE)。
