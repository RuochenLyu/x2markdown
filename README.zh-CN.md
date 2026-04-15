# x2markdown

[English](README.md) | 中文

<a href="https://chromewebstore.google.com/detail/x2markdown/acljfllclafamkhdjjkldogcadfbigmo">
  <img src="https://raw.githubusercontent.com/GoogleChrome/webstore-docs/refs/heads/master/images/ChromeWebStore_BadgeWBorder_v2_496x150.png" alt="Available in the Chrome Web Store" width="248" height="75">
</a>

`x2markdown` 是一个 Chrome 浏览器插件，右键一次就能把当前网页内容转成干净的 Markdown——可以直接粘进 LLM 对话、存进个人知识库、或保存为 `.md` 参考文件。在 `x.com` 上则额外保留帖子和长文的专用导出能力。

这个项目以展示和自用为主，使用 MIT 协议开源，默认不接收外部代码贡献。

![x2markdown 示意图](./docs/images/overview.svg?v=2)

## 解决什么问题

LLM 处理结构化文本效果最好，但从浏览器里拿到这种格式却意外地麻烦：

- 直接把链接丢给 AI，经常拿不到正文或上下文不完整。
- 复制网页可见内容时，标题、链接、正文和图片链接会丢失结构，需要手动整理。
- `x.com`、博客、文档页、论坛帖和 issue 页面都可能出现"我能看见，但 AI 读不到"的情况。

无论是粘贴到对话窗口、构建 LLM 友好的知识库、还是把网页研究归档为 Markdown，`x2markdown` 都可以把这个过程缩短成一次右键。

## 功能范围

- 在 `http/https` 网页的浏览器右键菜单中增加"复制为 Markdown"。
- 对普通网页：
  - 用户有选区时优先复制选区
  - 无选区时尝试提取当前页正文
  - 未识别为文章时明确提示"请选中内容后重试"
- 复制普通 X post 时输出：
  - 作者
  - 时间
  - 链接
  - 正文
  - 引用内容（如果存在）
  - 图片链接
- 在 `status` 详情页中，如果主贴后方存在顶部连续自回复，会按顺序导出整条 thread。
- 复制 X Article 或长文阅读视图时额外输出标题。
- 通用网页模式支持标题、站点、作者、时间、正文和图片链接；缺失字段不会强行补全。
- 图片以链接形式输出，不转成 Markdown 图片嵌入。
- 时间线中命中被截断的 post 时，会先尝试点击"显示更多"再复制。
- 运行时文案会跟随 Chrome UI 语言在简体中文和英文之间切换。
- 复制成功或失败时显示与浏览器语言一致的提示。
- 支持以下详情页格式：
  - `https://x.com/<user>/status/<id>`
  - `https://x.com/<user>/article/<id>`
- 支持 `x.com` 信息流、列表和搜索结果中可见的单条 post 卡片右键导出。

## 非目标

- 不导出整页 conversation，也不抓取评论区里其他人的回复流。
- 不抓取视频、GIF、投票结果或评论区内容。
- 不尝试绕过登录墙、付费墙或未渲染内容。
- 不覆盖 `twitter.com`、`mobile.x.com`。

## 安装方式

从 [Chrome Web Store](https://chromewebstore.google.com/detail/x2markdown/acljfllclafamkhdjjkldogcadfbigmo) 直接安装。

如果需要本地开发或调试：

1. 克隆仓库到本地。
2. 打开 Chrome，进入 `chrome://extensions`。
3. 打开右上角"开发者模式"。
4. 点击"加载已解压的扩展程序"。
5. 选择当前仓库根目录。
6. 如果扩展已经加载过，后续每次改代码后都需要在扩展页点击一次"重新加载"。

## 使用方式

1. 打开任意要复制的网页内容。
2. 如果只想复制局部内容，先选中文本；如果要复制整页文章，则直接右键当前页面。
3. 选择"复制为 Markdown"。
4. 直接把结果粘贴到 AI 对话框、Markdown 编辑器或笔记工具中。

`x.com` 的额外规则：

- 详情页和长文页可以直接右键复制。
- `status` 详情页会优先尝试导出“主贴 + 顶部连续自回复”的完整 thread。
- 时间线、列表和搜索结果里，要在目标帖子卡片内右键。

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

通用网页输出示例：

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

X Article 输出示例见 [docs/examples/post.md](./docs/examples/post.md)。
完整 thread 输出示例也见 [docs/examples/post.md](./docs/examples/post.md)。

## 实现思路

- 使用原生 Manifest V3。
- 使用 Chrome 扩展原生 `/_locales` 机制提供 `zh_CN` 和 `en` 两套运行时文案。
- 使用 `background service worker` 创建 Chrome 右键菜单。
- 权限策略尽量收敛：
  - 通用网页只依赖 `activeTab + scripting + contextMenus + clipboardWrite`
  - 不声明全站 `host_permissions`
  - 只有 `x.com` 保留常驻 content script，用于时间线卡片右键命中
- 用户点击右键菜单后：
  - `x.com` 走常驻 `content-x.js`
  - 其他网页按需注入 `shared.js + readability.js + content-generic.js`
- 通用模式优先处理选区；没有选区时再尝试 Readability 提取整页正文。
- 命中时间线里被截断的 X post 时，内容脚本会先在当前 `article[data-testid="tweet"]` 内尝试点击 `tweet-text-show-more-link`，等待正文展开后再提取。
- 命中 `status` 详情页时，会从主贴开始收集顶部连续的同作者续帖；遇到第一条非作者回复后停止，不继续并入评论区对话。
- X 提取逻辑优先依赖可见 DOM 与语义节点：
  - `article[data-testid="tweet"]`
  - `time[datetime]`
  - `data-testid="User-Name"`
  - `data-testid="tweetText"`
  - `data-testid="twitterArticleReadView"`
  - `data-testid="twitter-article-title"`
- 通用正文提取使用 vendored `Mozilla Readability`，再由本地 Markdown walker 转换结构化内容。
- 复制优先走 `navigator.clipboard.writeText()`，失败时回退到 `document.execCommand('copy')`。

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

- X 的 DOM 结构经常调整，专用提取逻辑可能失效。
- 通用网页模式偏向"正文页"而不是整站聚合页；首页、导航页、产品页等场景更适合先选中局部内容再复制。
- `status` 详情页里的完整 thread 只覆盖主贴后的顶部连续自回复，不包含作者后面对评论的零散回帖。
- 普通 X post 没有原生标题，因此不会输出标题字段。
- 某些长文会在 `status` 页面直接渲染为阅读视图，此时会按长文格式导出。
- 信息流帖子依赖最近一次右键命中的可见卡片；如果右键时没有命中帖子，插件会明确提示失败。
- "显示更多"依赖按钮点击后的页面异步渲染；如果 X 没有返回完整正文，插件仍会按当时可见内容提取。
- 当前只内置简体中文和英文两套文案；其他浏览器语言会回退到默认英文文案。
- 对 iframe 主体、登录墙、付费墙、懒加载未渲染内容，当前版本不保证可导出。

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
