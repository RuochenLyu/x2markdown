# x2markdown

`x2markdown` 是一个面向 `x.com` 的 Chrome 浏览器插件。它会在受支持页面和帖子卡片的浏览器右键菜单中增加一个“复制为 Markdown”入口，用来把当前内容快速整理成适合粘贴到 AI 对话中的 Markdown 文本。

这个项目以展示和自用为主，使用 MIT 协议开源，默认不接收外部代码贡献。

![x2markdown 示意图](./docs/images/overview.svg?v=2)

## 解决什么问题

- X 经常存在登录墙、反爬限制或分享链路丢正文的问题。
- 复制网页可见内容时，作者、时间、正文和图片链接通常需要手动整理。
- 把帖子内容贴给 AI 时，纯文本上下文不完整，容易丢失出处与时间信息。

`x2markdown` 的目标是把这一步缩短成一次点击。

## 功能范围

- 在受支持页面和帖子卡片的浏览器右键菜单中增加“复制为 Markdown”。
- 复制普通 post 时输出：
  - 作者
  - 时间
  - 链接
  - 正文
  - 引用内容（如果存在）
  - 图片链接
- 复制 X Article 或长文阅读视图时额外输出标题。
- 长文中的插图会按正文顺序转换成 Markdown 链接。
- 图片以链接形式输出，不转成 Markdown 图片嵌入。
- 时间线中命中被截断的 post 时，会先尝试点击“显示更多”再复制。
- 复制成功或失败时显示中文提示。
- 支持以下详情页格式：
  - `https://x.com/<user>/status/<id>`
  - `https://x.com/<user>/article/<id>`
- 支持 `x.com` 信息流、列表和搜索结果中可见的单条 post 卡片右键导出。

## 非目标

- 不导出整条 thread。
- 不抓取视频、GIF、投票结果或评论区内容。
- 不覆盖 `twitter.com`、`mobile.x.com`。

## 安装方式

1. 克隆仓库到本地。
2. 打开 Chrome，进入 `chrome://extensions`。
3. 打开右上角“开发者模式”。
4. 点击“加载已解压的扩展程序”。
5. 选择当前仓库根目录。
6. 如果扩展已经加载过，后续每次改代码后都需要在扩展页点击一次“重新加载”。

## 使用方式

1. 打开 `x.com` 上要复制的帖子详情页、长文页，或包含目标 post 的时间线页面。
2. 在当前帖子区域内点击右键；如果是详情页，也可以直接在当前页面主内容区域点击右键。
3. 选择“复制为 Markdown”。
4. 直接把结果粘贴到 AI 对话框、Markdown 编辑器或笔记工具中。

## 输出格式

普通 post 输出示例：

```md
作者: Example Author (@example)
时间: 2026-03-18 16:30:00
链接: https://x.com/example/status/1234567890123456789

正文:
这是一条示例帖子，包含一个[外部链接](https://example.com)。

引用内容:
作者: Quoted Author (@quoted)
时间: 2024-01-02 12:55:59
链接: https://x.com/quoted/status/9876543210987654321
正文:
> 这是被引用帖子的正文。

图片:
- [图片 1](https://pbs.twimg.com/media/example-1.jpg?format=jpg&name=large)
```

X Article 输出示例见 [docs/examples/post.md](./docs/examples/post.md)。

## 实现思路

- 使用原生 Manifest V3。
- 使用 `background service worker` 创建 Chrome 右键菜单。
- 用户点击右键菜单后，由 service worker 向当前页 content script 发送复制消息。
- 内容脚本会在 `contextmenu` 事件中缓存最近一次命中的 post 卡片，并按命中结果动态更新菜单可见性。
- 命中时间线里被截断的 post 时，内容脚本会先在当前 `article[data-testid="tweet"]` 内尝试点击 `tweet-text-show-more-link`，等待正文展开后再提取。
- 提取逻辑优先依赖可见 DOM 与语义节点：
  - `article[data-testid="tweet"]`
  - `time[datetime]`
  - `data-testid="User-Name"`
  - `data-testid="tweetText"`
  - `data-testid="twitterArticleReadView"`
  - `data-testid="twitter-article-title"`
- 复制优先走 `navigator.clipboard.writeText()`，失败时回退到 `document.execCommand('copy')`。

## 目录结构

```text
x2markdown/
├── AGENTS.md
├── LICENSE
├── README.md
├── background.js
├── content.css
├── content.js
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

- X 的 DOM 结构经常调整，正文提取逻辑可能失效。
- 当前版本只保证“当前帖子 / 当前文章 / 右键命中的单条帖子卡片”的导出，不做 thread 合并。
- 普通 post 没有原生标题，因此不会输出标题字段。
- 某些长文会在 `status` 页面直接渲染为阅读视图，此时会按长文格式导出。
- 信息流帖子依赖最近一次右键命中的可见卡片；如果右键时没有命中帖子，插件会明确提示失败。
- “显示更多”依赖按钮点击后的页面异步渲染；如果 X 没有返回完整正文，插件仍会按当时可见内容提取。
- 如果页面本身没有渲染出正文，插件会明确提示失败，而不是复制残缺内容。

遇到问题时，先看 [docs/troubleshooting.md](./docs/troubleshooting.md)。

## 文档索引

- [设计说明](./docs/design.md)
- [排障说明](./docs/troubleshooting.md)
- [输出示例](./docs/examples/post.md)

## 开源说明

- 许可证：MIT
- 仓库定位：展示型开源仓库，主要服务于项目说明和可复用实现展示
- 贡献策略：默认不接收外部 PR 或 issue 流程约束

## License

本项目代码使用 [MIT License](./LICENSE)。
