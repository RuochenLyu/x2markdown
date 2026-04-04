# 设计说明

## 目标

通过浏览器右键菜单，把当前网页的文章正文或选区转换成干净的 Markdown——可以直接粘进 LLM 对话、存进个人知识库、或保存为参考文件。在 `x.com` 上保留帖子与长文的专用导出能力。

## v1 范围

- 支持任意 `http/https` 页面右键复制
- 有选区时优先复制选区
- 无选区时尝试提取当前页正文
- 支持 `https://x.com/<user>/status/<id>`
- 支持 `https://x.com/<user>/article/<id>`
- 支持 `x.com` 各类时间线中可见的单条 post 卡片右键复制
- 支持时间线中被截断正文的 post 在复制前自动展开“显示更多”
- 支持运行时文案随 Chrome UI 语言在简体中文与英文之间切换
- 支持正文中的普通链接
- 支持正文附件图片链接
- 支持普通 post 中的 quoted post 作为附录输出
- 通用网页模式使用 Readability + 本地 walker 提取正文
- 不支持 thread 合并
- 不支持视频、GIF、投票和评论导出

## 架构概览

```mermaid
flowchart LR
  A["用户在网页中右键"] --> B["Chrome 右键菜单显示 复制为 Markdown"]
  B --> C["background.js 收到点击事件"]
  C --> D{"当前页是否 x.com"}
  D -->|是| E["向 content-x.js 发送复制消息"]
  D -->|否| F["按需注入 shared.js + readability.js + content-generic.js"]
  E --> G["优先检查选区，再走 X 专用提取"]
  F --> H["优先检查选区，再尝试 Readability"]
  G --> I["生成 Markdown"]
  H --> I
  I --> J["写入剪贴板"]
  J --> K["显示提示"]
```

## 模块拆分

### 1. 右键菜单入口

- `background.js` 在扩展安装和浏览器启动时创建唯一右键菜单项。
- `manifest.json` 通过 `default_locale: en` 和 `/_locales/en`、`/_locales/zh_CN` 提供扩展名、描述和运行时文案；未匹配语言时回退到英文。
- 菜单挂载在所有 `http/https` 页面。
- 对通用网页，菜单点击后才使用 `activeTab + scripting` 按需注入脚本，不保留常驻站点权限。
- 对 `x.com`，保留常驻 content script，用于时间线卡片命中和专用提取。

### 2. 通用网页提取

- 优先级：
  1. 有有效选区时，直接复制选区
  2. 无选区时，尝试 Readability 提取整页正文
  3. 如果结果过短、块数不足或明显不像文章，明确失败并提示“请选中内容后重试”
- 选区：`window.getSelection()` + `Range.cloneContents()`
- 全页：对 `document.cloneNode(true)` 运行 `Readability`
- Markdown 转换：本地 walker 负责标题、段落、列表、引用、代码块、表格、链接和图片链接

### 3. X 专用提取

普通 post：

- 定位：最近一次右键命中的 `article[data-testid="tweet"]`，或详情页主贴容器
- 预处理：若命中 `data-testid="tweet-text-show-more-link"`，先点击按钮并等待正文展开
- 作者：`data-testid="User-Name"`
- 时间：`time[datetime]`
- 链接：时间节点对应的状态链接或第一个 `/status/` 链接
- 正文：`data-testid="tweetText"`
- 引用：同一 `article` 内第二组 `User-Name / time / tweetText`
- 图片：`pbs.twimg.com/media` 附件图

Article 或长文阅读视图：

- 标题：`data-testid="twitter-article-title"`，回退到 `h1`
- 作者：页面顶部作者区中的个人主页链接
- 时间：当前页面对应的 `time[datetime]`
- 正文：`data-testid="twitterArticleReadView"` 下的 `longform-*` 内容块，图片按正文顺序转换成 Markdown 链接
- 图片：长文阅读视图中的 `pbs.twimg.com/media` 图片

## Markdown 模板

通用网页：

```md
# {title}

站点: {siteName}
作者: {author}
时间: {publishedAt}
链接: {url}

正文:
{bodyMarkdown}

图片:
- [图片 1]({imageUrl})
```

普通 X post：

```md
作者: {displayName} (@handle)
时间: {datetime}
链接: {url}

正文:
{body}

引用内容:
作者: {quotedDisplayName} (@quotedHandle)
时间: {quotedDatetime}
链接: {quotedUrl}
正文:
> {quotedBody}

图片:
- [图片 1]({imageUrl})
```

X Article：

```md
# {title}

作者: {displayName} (@handle)
时间: {datetime}
链接: {url}

正文:
{body}
```

## 关键取舍

- 通用网页模式优先保证权限最小化，因此不声明全站 `host_permissions`。
- 通用脚本采用“注入即执行”模式，不注册监听器，也不做 SPA 常驻缓存。
- 通用全页模式只保留一条主路径：Readability 成功则复制，失败则引导用户改用选区。
- X 主路径只依赖可见 DOM，不把 X 内部状态对象作为主数据源。
- 复制失败时明确提示，不输出不完整 Markdown。
- 入口改为 Chrome 原生右键菜单，避免继续跟页面内菜单结构耦合。
- 信息流场景缓存最近一次右键命中的帖子和状态链接，节点被回收时按状态链接重定位。
- “显示更多”只在当前命中的外层帖子作用域内展开，不跨帖子或整页批量点击。

## 已知脆弱点

- `status` 页面详情区的主贴定位依赖当前 URL 和正文 DOM。
- 信息流中的帖子节点可能被虚拟列表回收，重定位依赖帖子内可见的状态链接。
- 时间线里的“显示更多”是异步加载行为，若 X 没有及时回填完整正文，提取结果仍可能保留截断内容。
- 长文可能同时出现在 `status` 和 `article` 两种 URL 下，且 DOM 与普通 post 完全不同。
- 通用模式对首页、聚合页、产品页、iframe 主体和未渲染正文支持有限。
- 某些页面如果正文尚未渲染完成，提取会失败。

## 后续可扩展方向

- 支持 thread 合并导出
- 支持输出模板自定义
- 支持 `twitter.com` 和 `mobile.x.com`
- 支持更多浏览器语言
