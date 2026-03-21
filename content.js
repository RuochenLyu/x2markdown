(() => {
  "use strict";

  if (window.__x2markdownInjected) {
    return;
  }

  window.__x2markdownInjected = true;

  const STATE = {
    toastTimer: null,
    contextMenuTargetNode: null,
    contextMenuPost: null,
    contextMenuStatusUrl: "",
    menuVisible: null
  };

  const COPY_MESSAGE_TYPE = "COPY_MARKDOWN_FROM_PAGE";
  const MENU_VISIBILITY_MESSAGE_TYPE = "SET_CONTEXT_MENU_VISIBILITY";
  const PATH_PATTERNS = {
    status: /^\/[^/]+\/status\/\d+(?:\/)?$/,
    article: /^\/[^/]+\/article\/\d+(?:\/)?$/
  };

  const SELECTORS = {
    article: 'article[data-testid="tweet"]',
    tweetText: '[data-testid="tweetText"]',
    tweetTextShowMore: '[data-testid="tweet-text-show-more-link"]',
    userName: '[data-testid="User-Name"]',
    longformRoot: '[data-testid="twitterArticleReadView"]',
    longformTitle: '[data-testid="twitter-article-title"]',
    longformRichText: '[data-testid="twitterArticleRichTextView"], [data-testid="longformRichTextComponent"]'
  };

  const LONGFORM_BLOCK_SELECTOR = [
    ".longform-header-one",
    ".longform-header-one-narrow",
    ".longform-header-two",
    ".longform-header-two-narrow",
    ".longform-unstyled",
    ".longform-unstyled-narrow",
    ".longform-blockquote",
    ".longform-blockquote-narrow",
    ".longform-unordered-list-item",
    ".longform-unordered-list-item-narrow",
    ".longform-ordered-list-item",
    ".longform-ordered-list-item-narrow",
    'section[data-block="true"]',
    '[data-testid="markdown-code-block"]'
  ].join(", ");

  document.addEventListener("contextmenu", handleContextMenuEvent, true);

  if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (!message || message.type !== COPY_MESSAGE_TYPE) {
        return undefined;
      }

      void handleCopyRequest()
        .then(() => {
          sendResponse({ ok: true });
        })
        .catch((error) => {
          const errorMessage = error instanceof Error ? error.message : "复制失败";
          console.error("[x2markdown] 复制失败", error);
          showToast(errorMessage);
          sendResponse({
            ok: false,
            error: errorMessage
          });
        });

      return true;
    });
  }

  async function handleCopyRequest() {
    const pageType = getSupportedPageType(location.pathname);
    const payload =
      pageType === "status"
        ? await extractCurrentStatusPage()
        : pageType === "article"
          ? await extractCurrentArticlePage()
          : await extractContextMenuPostPage();
    const markdown = buildMarkdown(payload);

    await copyToClipboard(markdown);
    showToast("已复制为 Markdown");
  }

  function getSupportedPageType(pathname) {
    if (PATH_PATTERNS.status.test(pathname)) {
      return "status";
    }

    if (PATH_PATTERNS.article.test(pathname)) {
      return "article";
    }

    return null;
  }

  async function extractCurrentStatusPage() {
    const longformRoot = getLongformRoot();
    if (longformRoot) {
      const payload = extractArticleData(longformRoot);
      return {
        ...payload,
        url: cleanPageUrl(location.href)
      };
    }

    const article = await expandTweetTextIfNeeded(getStatusPageArticle(), {
      resolveArticle: getStatusPageArticle
    });
    const payload = extractPostData(article);

    return {
      ...payload,
      url: cleanPageUrl(location.href)
    };
  }

  async function extractCurrentArticlePage() {
    const root = getArticlePageRoot();
    const payload = extractArticleData(root);

    return {
      ...payload,
      url: cleanPageUrl(location.href)
    };
  }

  function handleContextMenuEvent(event) {
    const pageType = getSupportedPageType(location.pathname);
    if (pageType) {
      clearContextMenuTarget();
      void syncContextMenuVisibility(true);
      return;
    }

    const article = findContextMenuArticle(event.target);
    if (!(article instanceof HTMLElement) || !isVisible(article)) {
      clearContextMenuTarget();
      void syncContextMenuVisibility(false);
      return;
    }

    const statusUrl = extractPrimaryStatusUrl(article);
    if (!statusUrl) {
      clearContextMenuTarget();
      void syncContextMenuVisibility(false);
      return;
    }

    STATE.contextMenuTargetNode = event.target instanceof Node ? event.target : null;
    STATE.contextMenuPost = article;
    STATE.contextMenuStatusUrl = statusUrl;

    void syncContextMenuVisibility(true);
  }

  async function extractContextMenuPostPage() {
    const article = await expandTweetTextIfNeeded(resolveContextMenuPostArticle(), {
      resolveArticle: resolveContextMenuPostArticle
    });
    return extractPostData(article);
  }

  async function expandTweetTextIfNeeded(article, options = {}) {
    const { resolveArticle = () => article } = options;
    let currentArticle = safelyResolveArticle(resolveArticle) || article;

    if (!(currentArticle instanceof HTMLElement)) {
      throw new Error("未找到当前帖子");
    }

    for (let index = 0; index < 4; index += 1) {
      const showMoreButton = findTweetTextShowMoreButton(currentArticle);
      if (!(showMoreButton instanceof HTMLButtonElement)) {
        return currentArticle;
      }

      const previousSnapshot = getTweetTextSnapshot(currentArticle);
      showMoreButton.click();
      await waitForTweetTextExpansion(resolveArticle, previousSnapshot);

      currentArticle = safelyResolveArticle(resolveArticle) || currentArticle;
      if (!(currentArticle instanceof HTMLElement)) {
        throw new Error("未找到当前帖子");
      }
    }

    return currentArticle;
  }

  async function waitForTweetTextExpansion(resolveArticle, previousSnapshot) {
    const startedAt = Date.now();

    while (Date.now() - startedAt < 1800) {
      await wait(60);

      const article = safelyResolveArticle(resolveArticle);
      if (!(article instanceof HTMLElement)) {
        continue;
      }

      const currentSnapshot = getTweetTextSnapshot(article);
      const hasShowMoreButton = Boolean(findTweetTextShowMoreButton(article));
      if (currentSnapshot !== previousSnapshot || !hasShowMoreButton) {
        await wait(120);
        return;
      }
    }
  }

  function findTweetTextShowMoreButton(article) {
    const candidates = getScopedVisibleElements(article, SELECTORS.tweetTextShowMore, article).filter((node) => {
      return node instanceof HTMLButtonElement && !node.disabled;
    });

    return candidates[0] || null;
  }

  function getTweetTextSnapshot(article) {
    return getScopedVisibleElements(article, SELECTORS.tweetText, article)
      .map((node) => normalizeMarkdownBlock(extractInlineMarkdown(node)))
      .filter(Boolean)
      .join("\n\n");
  }

  function safelyResolveArticle(resolveArticle) {
    try {
      const article = resolveArticle();
      return article instanceof HTMLElement ? article : null;
    } catch (error) {
      return null;
    }
  }

  function resolveContextMenuPostArticle() {
    if (isReusableContextMenuArticle(STATE.contextMenuPost)) {
      return STATE.contextMenuPost;
    }

    const fallbackArticle = findArticleByStatusUrl(STATE.contextMenuStatusUrl);
    if (fallbackArticle) {
      STATE.contextMenuPost = fallbackArticle;
      return fallbackArticle;
    }

    clearContextMenuTarget();
    throw new Error("未找到当前帖子");
  }

  function clearContextMenuTarget() {
    STATE.contextMenuTargetNode = null;
    STATE.contextMenuPost = null;
    STATE.contextMenuStatusUrl = "";
  }

  function isReusableContextMenuArticle(article) {
    return article instanceof HTMLElement && article.isConnected && article.matches(SELECTORS.article) && isVisible(article);
  }

  function findContextMenuArticle(target) {
    const element =
      target instanceof Element ? target : target instanceof Node ? target.parentElement : null;

    if (!(element instanceof Element)) {
      return null;
    }

    const article = element.closest(SELECTORS.article);
    return article instanceof HTMLElement ? article : null;
  }

  function findArticleByStatusUrl(statusUrl) {
    const cleanStatusUrl = cleanPageUrl(statusUrl);
    if (!cleanStatusUrl) {
      return null;
    }

    const candidates = Array.from(document.querySelectorAll(SELECTORS.article)).filter((article) => {
      return article instanceof HTMLElement && isVisible(article) && articleHasStatusUrl(article, cleanStatusUrl);
    });

    return candidates[0] || null;
  }

  function articleHasStatusUrl(article, statusUrl) {
    return Array.from(article.querySelectorAll("a[href]"))
      .map((link) => toAbsoluteUrl(link.getAttribute("href")))
      .map(cleanPageUrl)
      .some((href) => href === statusUrl);
  }

  function extractPrimaryStatusUrl(article) {
    const statusId = extractStatusIdFromArticle(article);
    const timeInfo = extractStatusTime(article, statusId);
    return extractStatusUrl(article, timeInfo.element);
  }

  function getStatusPageArticle() {
    if (getSupportedPageType(location.pathname) !== "status") {
      throw new Error("当前不是受支持的帖子页面");
    }

    const statusId = extractPathId(location.pathname, "status");
    const candidates = Array.from(document.querySelectorAll(SELECTORS.article)).filter((article) => {
      return article instanceof HTMLElement && isVisible(article) && articleHasStatusId(article, statusId);
    });

    const mainCandidate = candidates.find((article) => article.closest("main"));
    const article = mainCandidate || candidates[0];

    if (!(article instanceof HTMLElement)) {
      throw new Error("未找到当前帖子正文");
    }

    return article;
  }

  function articleHasStatusId(article, statusId) {
    const statusPattern = new RegExp(`https://x\\.com/[^/]+/status/${statusId}(?:[/?#]|$)`);
    return Array.from(article.querySelectorAll("a[href]"))
      .map((link) => toAbsoluteUrl(link.getAttribute("href")))
      .some((href) => statusPattern.test(href));
  }

  function extractStatusIdFromArticle(article) {
    const timeElements = Array.from(article.querySelectorAll("time[datetime]")).filter((element) => {
      if (!(element instanceof HTMLElement) || !isVisible(element)) {
        return false;
      }

      return element.closest(SELECTORS.article) === article;
    });

    const linkedTime = timeElements.find((element) => element.closest("a[href]") instanceof HTMLAnchorElement) || null;
    const linkedStatusId =
      linkedTime instanceof HTMLElement ? extractStatusIdFromUrl(linkedTime.closest("a[href]")?.getAttribute("href") || "") : "";

    if (linkedStatusId) {
      return linkedStatusId;
    }

    const statusLinks = Array.from(article.querySelectorAll("a[href]"))
      .map((link) => extractStatusIdFromUrl(link.getAttribute("href") || ""))
      .filter(Boolean);

    return statusLinks[0] || "";
  }

  function getArticlePageRoot() {
    if (getSupportedPageType(location.pathname) !== "article") {
      throw new Error("当前不是受支持的文章页面");
    }

    const longformRoot = getLongformRoot();
    if (longformRoot) {
      return longformRoot;
    }

    const main = document.querySelector("main");
    if (!(main instanceof HTMLElement)) {
      throw new Error("未找到文章容器");
    }

    const title = firstVisibleElement(main.querySelectorAll("h1"));
    if (!title) {
      throw new Error("未找到文章标题");
    }

    return main;
  }

  function getLongformRoot() {
    return firstVisibleElement(document.querySelectorAll(SELECTORS.longformRoot));
  }

  function extractPathId(pathname, kind) {
    const pattern = kind === "status" ? PATH_PATTERNS.status : PATH_PATTERNS.article;
    const match = pathname.match(pattern);
    if (!match) {
      throw new Error("页面路径不受支持");
    }

    const segments = pathname.split("/").filter(Boolean);
    return segments[2] || "";
  }

  function extractPostData(article) {
    if (!(article instanceof HTMLElement)) {
      throw new Error("帖子节点无效");
    }

    const statusId =
      getSupportedPageType(location.pathname) === "status" ? extractPathId(location.pathname, "status") : extractStatusIdFromArticle(article);
    const author = extractAuthor(article);
    const timeInfo = extractStatusTime(article, statusId);
    const timeElement = timeInfo.element;
    const statusUrl = extractStatusUrl(article, timeElement);
    const textElement = findPrimaryTweetText(article);
    const quote = extractQuotedPost(article, {
      primaryTextNode: textElement,
      currentStatusUrl: statusUrl
    });
    const body = textElement ? normalizeMarkdownBlock(extractInlineMarkdown(textElement)) : "";
    const images = extractPostImages(article, {
      excludeContainer: quote ? quote.container : null
    });

    if (!author.displayName && !author.handle) {
      throw new Error("未找到作者信息");
    }

    if (!timeElement) {
      throw new Error("未找到发布时间");
    }

    if (!statusUrl) {
      throw new Error("未找到帖子链接");
    }

    if (!body) {
      throw new Error("未找到正文内容");
    }

    return {
      kind: "post",
      title: "",
      author,
      time: formatTimeValue(timeInfo.datetime, timeInfo.text),
      url: statusUrl,
      body,
      images,
      quote
    };
  }

  function extractArticleData(root) {
    if (!(root instanceof HTMLElement)) {
      throw new Error("文章节点无效");
    }

    const titleElement = getArticleTitleElement(root);
    if (!titleElement) {
      throw new Error("未找到文章标题");
    }

    const author = extractLongformAuthor(root);
    const timeInfo = extractLongformTime(root);
    const longformBodyResult = buildLongformBody(root, titleElement);
    const body = longformBodyResult.body || buildArticleBody(root, titleElement);
    const images = extractLongformImages(root).filter((url) => !longformBodyResult.inlineImageUrls.includes(url));

    if (!body) {
      throw new Error("未找到文章正文");
    }

    return {
      kind: "article",
      title: normalizeText(titleElement.textContent),
      author,
      time: formatTimeValue(timeInfo.datetime, timeInfo.text),
      url: cleanPageUrl(location.href),
      body,
      images,
      quote: null
    };
  }

  function getArticleTitleElement(root) {
    return (
      firstVisibleElement(root.querySelectorAll(SELECTORS.longformTitle)) ||
      firstVisibleElement(root.querySelectorAll("h1.longform-header-one, h1.longform-header-one-narrow, h1"))
    );
  }

  function extractAuthor(root) {
    const candidate = findAuthorNode(root);
    if (!candidate) {
      return {
        displayName: "",
        handle: "",
        profileUrl: ""
      };
    }

    return parseAuthorNode(candidate);
  }

  function parseAuthorNode(candidate) {
    const tokens = collectTextTokens(candidate);
    const handle = tokens.find(isHandleText) || "";
    const displayName =
      tokens.find((token) => token !== handle && !isHandleText(token) && !isMetaToken(token) && !looksLikeCount(token)) ||
      (handle ? handle.replace(/^@/, "") : "");

    const profileUrl =
      unique(
        Array.from(candidate.querySelectorAll("a[href]"))
          .map((link) => toAbsoluteUrl(link.getAttribute("href")))
          .filter((href) => /^https:\/\/x\.com\/[A-Za-z0-9_]{1,15}\/?$/.test(href))
      )[0] || "";

    return {
      displayName,
      handle,
      profileUrl
    };
  }

  function findAuthorNode(root) {
    const candidates = Array.from(root.querySelectorAll(SELECTORS.userName)).filter((node) => {
      if (!(node instanceof HTMLElement) || !isVisible(node)) {
        return false;
      }

      const closestArticle = node.closest(SELECTORS.article);
      return !(root.matches(SELECTORS.article) && closestArticle && closestArticle !== root);
    });

    return candidates[0] || null;
  }

  function findPrimaryTweetText(article) {
    const candidates = getScopedVisibleElements(article, SELECTORS.tweetText, article);

    return candidates[0] || null;
  }

  function extractStatusUrl(root, timeElement) {
    if (timeElement instanceof HTMLElement) {
      const timeLink = timeElement.closest("a[href]");
      if (timeLink instanceof HTMLAnchorElement) {
        return cleanPageUrl(timeLink.href);
      }
    }

    const links = Array.from(root.querySelectorAll("a[href]"))
      .map((link) => toAbsoluteUrl(link.getAttribute("href")))
      .filter((href) => /https:\/\/x\.com\/[^/]+\/status\/\d+/.test(href));

    return links[0] ? cleanPageUrl(links[0]) : "";
  }

  function extractQuotedPost(article, options = {}) {
    const { primaryTextNode = null, currentStatusUrl = "" } = options;
    const textNodes = getScopedVisibleElements(article, SELECTORS.tweetText, article);
    const quoteTextNode = textNodes.find((node) => node !== primaryTextNode) || null;

    if (!(quoteTextNode instanceof HTMLElement)) {
      return null;
    }

    const primaryUserNode = findAuthorNode(article);
    const userNodes = getScopedVisibleElements(article, SELECTORS.userName, article);
    const quoteUserNode = userNodes.find((node) => node !== primaryUserNode) || null;
    const quoteContainer = findQuotedPostContainer(article, quoteTextNode, quoteUserNode, primaryTextNode);
    const author = quoteUserNode ? parseAuthorNode(quoteUserNode) : extractLongformAuthor(quoteContainer);
    const timeInfo = extractQuotedPostTime(quoteContainer, currentStatusUrl);
    const url = extractQuotedStatusUrl(quoteContainer, currentStatusUrl);
    const body = normalizeMarkdownBlock(extractInlineMarkdown(quoteTextNode));
    const images = extractPostImages(quoteContainer, { scopeArticle: article });

    if (!body) {
      return null;
    }

    return {
      author,
      time: formatTimeValue(timeInfo.datetime, timeInfo.text),
      url,
      body,
      images,
      container: quoteContainer
    };
  }

  function findQuotedPostContainer(article, quoteTextNode, quoteUserNode, primaryTextNode) {
    let current = quoteTextNode.parentElement;
    while (current && current !== article) {
      if (quoteUserNode && !current.contains(quoteUserNode)) {
        current = current.parentElement;
        continue;
      }

      if (primaryTextNode && current.contains(primaryTextNode)) {
        current = current.parentElement;
        continue;
      }

      return current;
    }

    return quoteTextNode.parentElement || article;
  }

  function extractQuotedPostTime(root, currentStatusUrl) {
    const times = Array.from(root.querySelectorAll("time[datetime]")).filter((element) => {
      return element instanceof HTMLElement && isVisible(element);
    });
    const cleanCurrentStatusUrl = cleanPageUrl(currentStatusUrl);
    const linkedTime = times.find((element) => {
      const link = element.closest("a[href]");
      if (!(link instanceof HTMLAnchorElement)) {
        return false;
      }

      return cleanPageUrl(link.href) !== cleanCurrentStatusUrl;
    });
    const unlinkedTime = times.find((element) => !(element.closest("a[href]") instanceof HTMLAnchorElement));

    return buildTimeInfo(linkedTime || unlinkedTime || times[0] || null);
  }

  function extractQuotedStatusUrl(root, currentStatusUrl) {
    const cleanCurrentStatusUrl = cleanPageUrl(currentStatusUrl);
    const links = Array.from(root.querySelectorAll("a[href]"))
      .map((link) => toAbsoluteUrl(link.getAttribute("href")))
      .filter((href) => /https:\/\/x\.com\/[^/]+\/status\/\d+/.test(href))
      .map(cleanPageUrl);

    return links.find((href) => href !== cleanCurrentStatusUrl) || "";
  }

  function extractPostImages(root, options = {}) {
    const { scopeArticle = root.closest ? root.closest(SELECTORS.article) : null, excludeContainer = null } = options;
    const images = Array.from(root.querySelectorAll('a[href*="/photo/"] img[src], img[src*="pbs.twimg.com/media"]')).filter((image) => {
      if (!(image instanceof HTMLImageElement) || !isVisible(image)) {
        return false;
      }

      if (excludeContainer instanceof HTMLElement && excludeContainer.contains(image)) {
        return false;
      }

      const closestArticle = scopeArticle instanceof HTMLElement ? image.closest(SELECTORS.article) : null;
      if (scopeArticle instanceof HTMLElement && closestArticle !== scopeArticle) {
        return false;
      }

      if (image.closest(SELECTORS.userName) || image.closest("[data-testid='UserAvatar-Container']")) {
        return false;
      }

      return image.src.includes("pbs.twimg.com/media");
    });

    return unique(images.map((image) => normalizeMediaUrl(image.src)).filter(Boolean));
  }

  function buildLongformBody(root, titleElement) {
    const richTextRoot =
      firstVisibleElement(root.querySelectorAll(SELECTORS.longformRichText)) ||
      firstVisibleElement(root.querySelectorAll(".public-DraftEditor-content")) ||
      root;
    const titleText = normalizeText(titleElement.textContent);
    const blocks = [];
    const inlineImageUrls = [];
    const leadingImageUrls = extractLeadingLongformMediaUrls(root, richTextRoot);

    if (leadingImageUrls.length > 0) {
      blocks.push(renderLongformMediaLinks(leadingImageUrls));
      inlineImageUrls.push(...leadingImageUrls);
    }

    Array.from(richTextRoot.querySelectorAll(LONGFORM_BLOCK_SELECTOR))
      .filter((node) => node instanceof HTMLElement && isVisible(node))
      .forEach((node) => {
        const rendered = renderLongformBlock(node, titleText);
        if (!rendered.text) {
          return;
        }

        blocks.push(rendered.text);
        inlineImageUrls.push(...rendered.imageUrls);
      });

    return {
      body: blocks.join("\n\n").trim(),
      inlineImageUrls: unique(inlineImageUrls)
    };
  }

  function renderLongformBlock(node, titleText) {
    const imageUrls = extractLongformMediaUrls(node);
    if (imageUrls.length > 0) {
      return {
        text: renderLongformMediaLinks(imageUrls),
        imageUrls
      };
    }

    const text = normalizeMarkdownBlock(extractInlineMarkdown(node));
    if (!text || text === titleText) {
      return {
        text: "",
        imageUrls: []
      };
    }

    if (node.matches(".longform-header-one, .longform-header-one-narrow, .longform-header-two, .longform-header-two-narrow")) {
      return {
        text: `## ${text}`,
        imageUrls: []
      };
    }

    if (node.matches(".longform-blockquote, .longform-blockquote-narrow")) {
      return {
        text: text
          .split("\n")
          .map((line) => `> ${line}`)
          .join("\n"),
        imageUrls: []
      };
    }

    if (
      node.matches(
        ".longform-unordered-list-item, .longform-unordered-list-item-narrow, .longform-ordered-list-item, .longform-ordered-list-item-narrow"
      )
    ) {
      return {
        text: `- ${text}`,
        imageUrls: []
      };
    }

    return {
      text,
      imageUrls: []
    };
  }

  function extractLeadingLongformMediaUrls(root, richTextRoot) {
    const containers = Array.from(root.children).filter((child) => {
      return child instanceof HTMLElement && !child.contains(richTextRoot);
    });

    for (const container of containers) {
      const imageUrls = extractLongformMediaUrls(container);
      if (imageUrls.length > 0) {
        return imageUrls;
      }
    }

    return [];
  }

  function renderLongformMediaLinks(imageUrls) {
    return imageUrls.map((url, index) => `[图片 ${index + 1}](${url})`).join("\n");
  }

  function extractLongformMediaUrls(root) {
    const urls = [];
    const containers = Array.from(root.querySelectorAll('a[href*="/media/"], img[src]'));

    containers.forEach((node) => {
      if (!(node instanceof HTMLElement) || !isVisible(node)) {
        return;
      }

      const anchor = node instanceof HTMLAnchorElement ? node : node.closest('a[href*="/media/"]');
      const image = node instanceof HTMLImageElement ? node : node.querySelector("img[src]");

      if (image instanceof HTMLImageElement && image.closest("[data-testid='UserAvatar-Container']")) {
        return;
      }

      const imageUrl = image instanceof HTMLImageElement ? normalizeMediaUrl(image.src) : "";
      const mediaUrl = anchor instanceof HTMLAnchorElement ? cleanPageUrl(anchor.href) : "";
      const resolvedUrl = imageUrl.includes("pbs.twimg.com/media") ? imageUrl : mediaUrl;

      if (resolvedUrl) {
        urls.push(resolvedUrl);
      }
    });

    return unique(urls);
  }

  function buildArticleBody(root, titleElement) {
    const blockSets = [
      collectArticleBodyBlocks(root, titleElement),
      collectArticleBodyBlocks(root, titleElement, { allowInteractiveAncestors: true }),
      collectArticleTweetTextFallback(root, titleElement),
      collectReadableArticleTextFallback(root, titleElement)
    ];

    for (const blocks of blockSets) {
      const body = blocks
        .map((block) => normalizeMarkdownBlock(extractInlineMarkdown(block)))
        .filter(Boolean)
        .filter((text, index, list) => list.indexOf(text) === index)
        .join("\n\n");

      if (body) {
        return body;
      }
    }

    return "";
  }

  function extractLongformAuthor(root) {
    const usernameFromPath = extractUsernameFromPath(location.pathname);
    const candidates = collectProfileLinkCandidates(root).concat(collectProfileLinkCandidates(document));
    const preferredCandidates = candidates.filter((candidate) => {
      return !usernameFromPath || extractUsernameFromUrl(candidate.href) === usernameFromPath;
    });
    const source = preferredCandidates.length > 0 ? preferredCandidates : candidates;
    const profileUrl = source[0] ? source[0].href : "";
    const handle = source.find((candidate) => isHandleText(candidate.text))?.text || "";
    const displayName =
      source.find((candidate) => candidate.text && !isHandleText(candidate.text) && !isMetaToken(candidate.text))?.text ||
      (handle ? handle.replace(/^@/, "") : "");

    return {
      displayName,
      handle,
      profileUrl
    };
  }

  function collectProfileLinkCandidates(root) {
    if (!root || typeof root.querySelectorAll !== "function") {
      return [];
    }

    const candidates = Array.from(root.querySelectorAll("a[href]"))
      .filter((link) => link instanceof HTMLAnchorElement && isVisible(link))
      .map((link) => ({
        href: cleanPageUrl(link.href),
        text: normalizeText(link.textContent)
      }))
      .filter((candidate) => /^https:\/\/x\.com\/[A-Za-z0-9_]{1,15}\/?$/.test(candidate.href));

    return uniqueByKey(candidates, (candidate) => `${candidate.href}::${candidate.text}`);
  }

  function extractLongformTime(root) {
    const currentPathId =
      getSupportedPageType(location.pathname) === "status"
        ? extractPathId(location.pathname, "status")
        : extractPathId(location.pathname, "article");
    const linkedTime =
      firstVisibleElement(document.querySelectorAll(`a[href*="/status/${currentPathId}"] time[datetime]`)) || null;
    const rootTime = firstVisibleElement(root.querySelectorAll("time[datetime]"));
    const pageTime = firstVisibleElement(document.querySelectorAll("time[datetime]"));

    return buildTimeInfo(linkedTime || rootTime || pageTime || null);
  }

  function extractLongformImages(root) {
    return extractLongformMediaUrls(root).filter((url) => {
      return url.includes("pbs.twimg.com/media") || /https:\/\/x\.com\/[^/]+\/article\/\d+\/media\/\d+/.test(url);
    });
  }

  function collectArticleBodyBlocks(root, titleElement, options = {}) {
    const { allowInteractiveAncestors = false } = options;
    const titleText = normalizeText(titleElement.textContent);
    const titleBottom = titleElement.getBoundingClientRect().bottom;
    const selector = ["p", "h2", "h3", "blockquote", "li", "pre", "div[dir='auto']"].join(", ");
    const blocks = Array.from(root.querySelectorAll(selector)).filter((node) => {
      if (!(node instanceof HTMLElement) || !isVisible(node)) {
        return false;
      }

      if (node === titleElement || node.contains(titleElement) || titleElement.contains(node)) {
        return false;
      }

      if (node.closest("nav, header, footer, aside, [role='menu'], [role='dialog']")) {
        return false;
      }

      if (node.closest(SELECTORS.userName)) {
        return false;
      }

      if (!allowInteractiveAncestors && node.closest("[role='button'], button")) {
        return false;
      }

      const rect = node.getBoundingClientRect();
      if (rect.bottom <= titleBottom) {
        return false;
      }

      const text = normalizeMarkdownBlock(extractInlineMarkdown(node));
      if (!text || text === titleText) {
        return false;
      }

      if (text.length < 2) {
        return false;
      }

      if (isHandleText(text) || isMetaToken(text) || looksLikeCount(text)) {
        return false;
      }

      return true;
    });

    return blocks.filter((node, index) => {
      return !blocks.some((other, otherIndex) => otherIndex !== index && other.contains(node));
    });
  }

  function collectArticleTweetTextFallback(root, titleElement) {
    const titleBottom = titleElement.getBoundingClientRect().bottom;
    return Array.from(root.querySelectorAll(SELECTORS.tweetText)).filter((node) => {
      if (!(node instanceof HTMLElement) || !isVisible(node)) {
        return false;
      }

      if (node.getBoundingClientRect().bottom <= titleBottom) {
        return false;
      }

      return normalizeMarkdownBlock(extractInlineMarkdown(node)).length > 0;
    });
  }

  function collectReadableArticleTextFallback(root, titleElement) {
    const titleText = normalizeText(titleElement.textContent);
    const titleBottom = titleElement.getBoundingClientRect().bottom;
    const selector = ["div", "p", "h2", "h3", "blockquote", "li", "pre", "span"].join(", ");
    const blocks = Array.from(root.querySelectorAll(selector)).filter((node) => {
      if (!(node instanceof HTMLElement) || !isVisible(node)) {
        return false;
      }

      if (node === titleElement || node.contains(titleElement) || titleElement.contains(node)) {
        return false;
      }

      if (node.closest("nav, header, footer, aside, [role='menu'], [role='dialog']")) {
        return false;
      }

      if (node.closest(SELECTORS.userName)) {
        return false;
      }

      if (node.getBoundingClientRect().bottom <= titleBottom) {
        return false;
      }

      const text = normalizeMarkdownBlock(extractInlineMarkdown(node));
      if (!text || text === titleText || text.length < 28) {
        return false;
      }

      if (isHandleText(text) || isMetaToken(text) || looksLikeCount(text)) {
        return false;
      }

      if (hasReadableChild(node, titleText)) {
        return false;
      }

      return true;
    });

    return blocks.filter((node, index) => {
      return !blocks.some((other, otherIndex) => otherIndex !== index && other.contains(node));
    });
  }

  function hasReadableChild(node, titleText) {
    return Array.from(node.children).some((child) => {
      if (!(child instanceof HTMLElement) || !isVisible(child)) {
        return false;
      }

      const text = normalizeMarkdownBlock(extractInlineMarkdown(child));
      if (!text || text === titleText) {
        return false;
      }

      return text.length >= 28;
    });
  }

  function extractArticleImages(root, titleElement) {
    const titleBottom = titleElement.getBoundingClientRect().bottom;
    const images = Array.from(root.querySelectorAll("img[src]")).filter((image) => {
      if (!(image instanceof HTMLImageElement) || !isVisible(image)) {
        return false;
      }

      if (!image.src.includes("pbs.twimg.com/media")) {
        return false;
      }

      if (image.closest(SELECTORS.userName) || image.closest("[data-testid='UserAvatar-Container']")) {
        return false;
      }

      return image.getBoundingClientRect().top >= titleBottom;
    });

    return unique(images.map((image) => normalizeMediaUrl(image.src)).filter(Boolean));
  }

  function extractStatusTime(article, statusId) {
    const timeElements = Array.from(article.querySelectorAll("time[datetime]")).filter((element) => {
      if (!(element instanceof HTMLElement) || !isVisible(element)) {
        return false;
      }

      const closestArticle = element.closest(SELECTORS.article);
      return closestArticle === article;
    });

    const matchingElement =
      timeElements.find((element) => {
        const link = element.closest("a[href]");
        return link instanceof HTMLAnchorElement && cleanPageUrl(link.href).includes(`/status/${statusId}`);
      }) || null;

    return buildTimeInfo(matchingElement || timeElements[0] || null);
  }

  function extractArticleTime(root, titleElement) {
    const titleRect = titleElement.getBoundingClientRect();
    const timeElements = Array.from(root.querySelectorAll("time[datetime]")).filter((element) => {
      if (!(element instanceof HTMLElement) || !isVisible(element)) {
        return false;
      }

      if (element.closest("nav, footer, aside, [role='menu'], [role='dialog']")) {
        return false;
      }

      return true;
    });

    const scored = timeElements
      .map((element) => {
        const rect = element.getBoundingClientRect();
        let score = Math.abs(rect.top - titleRect.top);

        if (rect.top > titleRect.bottom + 240) {
          score += 500;
        }

        if (element.closest(SELECTORS.article)) {
          score += 160;
        }

        return { element, score };
      })
      .sort((left, right) => left.score - right.score);

    return buildTimeInfo(scored[0] ? scored[0].element : null);
  }

  function buildTimeInfo(element) {
    if (!(element instanceof HTMLElement)) {
      return {
        element: null,
        datetime: "",
        text: ""
      };
    }

    return {
      element,
      datetime: element.getAttribute("datetime") || "",
      text: normalizeText(element.textContent)
    };
  }

  function buildMarkdown(payload) {
    const lines = [];
    const images = Array.isArray(payload.images) ? payload.images : [];
    const quote = payload.quote && payload.quote.body ? payload.quote : null;

    if (payload.title) {
      lines.push(`# ${payload.title}`, "");
    }

    lines.push(`作者: ${formatAuthor(payload.author)}`);

    if (payload.time) {
      lines.push(`时间: ${payload.time}`);
    }

    lines.push(`链接: ${payload.url}`, "", "正文:", payload.body);

    if (quote) {
      lines.push("", "引用内容:");
      lines.push(`作者: ${formatAuthor(quote.author)}`);

      if (quote.time) {
        lines.push(`时间: ${quote.time}`);
      }

      if (quote.url) {
        lines.push(`链接: ${quote.url}`);
      }

      lines.push("正文:");
      lines.push(
        quote.body
          .split("\n")
          .map((line) => `> ${line}`)
          .join("\n")
      );

      if (quote.images.length > 0) {
        lines.push("", "引用图片:");
        quote.images.forEach((imageUrl, index) => {
          lines.push(`- [引用图片 ${index + 1}](${imageUrl})`);
        });
      }
    }

    if (images.length > 0) {
      lines.push("", "图片:");
      images.forEach((imageUrl, index) => {
        lines.push(`- [图片 ${index + 1}](${imageUrl})`);
      });
    }

    return lines.join("\n").trim();
  }

  async function syncContextMenuVisibility(visible) {
    STATE.menuVisible = visible;

    if (typeof chrome === "undefined" || !chrome.runtime || typeof chrome.runtime.sendMessage !== "function") {
      return;
    }

    try {
      await chrome.runtime.sendMessage({
        type: MENU_VISIBILITY_MESSAGE_TYPE,
        visible
      });
    } catch (error) {
      // Ignore transient service worker timing errors and keep local state authoritative.
    }
  }

  function formatAuthor(author) {
    if (author.displayName && author.handle) {
      return `${author.displayName} (${author.handle})`;
    }

    return author.displayName || author.handle || "未知作者";
  }

  async function copyToClipboard(text) {
    if (copyWithExecCommand(text)) {
      return;
    }

    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      try {
        await navigator.clipboard.writeText(text);
        return;
      } catch (error) {
        // Some pages reject Clipboard API calls in content scripts even when fallback copy works.
      }
    }

    throw new Error("复制失败，请手动重试");
  }

  function copyWithExecCommand(text) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    textarea.style.pointerEvents = "none";
    textarea.style.top = "0";
    textarea.style.left = "0";

    document.body.appendChild(textarea);
    try {
      textarea.focus();
      textarea.select();
      return document.execCommand("copy");
    } catch (error) {
      return false;
    } finally {
      textarea.remove();
    }
  }

  function showToast(message) {
    let toast = document.querySelector("[data-x2markdown-toast='true']");
    if (!(toast instanceof HTMLElement)) {
      toast = document.createElement("div");
      toast.dataset.x2markdownToast = "true";
      toast.className = "x2markdown-toast";
      document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.classList.add("x2markdown-toast--visible");

    if (STATE.toastTimer) {
      window.clearTimeout(STATE.toastTimer);
    }

    STATE.toastTimer = window.setTimeout(() => {
      toast.classList.remove("x2markdown-toast--visible");
    }, 2200);
  }

  function extractInlineMarkdown(node) {
    const parts = [];

    for (const child of node.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        parts.push(child.textContent || "");
        continue;
      }

      if (!(child instanceof Element) || !isVisible(child)) {
        continue;
      }

      if (child.tagName === "BR") {
        parts.push("\n");
        continue;
      }

      if (child.tagName === "IMG") {
        const alt = normalizeText(child.getAttribute("alt"));
        if (alt && alt.toLowerCase() !== "image") {
          parts.push(alt);
        }
        continue;
      }

      if (child instanceof HTMLAnchorElement) {
        const href = toAbsoluteUrl(child.getAttribute("href"));
        const text = normalizeMarkdownBlock(extractInlineMarkdown(child) || child.textContent || "");

        if (!href) {
          parts.push(text);
          continue;
        }

        if (!text) {
          parts.push(href);
          continue;
        }

        if (looksLikeAbsoluteUrl(text)) {
          parts.push(href);
          continue;
        }

        parts.push(`[${escapeMarkdownText(text)}](${href})`);
        continue;
      }

      parts.push(extractInlineMarkdown(child));
    }

    return normalizeInlineText(parts.join(""));
  }

  function collectTextTokens(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.textContent || !node.textContent.trim()) {
          return NodeFilter.FILTER_REJECT;
        }

        const parent = node.parentElement;
        if (!parent || !isVisible(parent)) {
          return NodeFilter.FILTER_REJECT;
        }

        if (parent.closest("[role='menu'], [role='button'], button")) {
          return NodeFilter.FILTER_REJECT;
        }

        return NodeFilter.FILTER_ACCEPT;
      }
    });

    const tokens = [];
    let currentNode = walker.nextNode();
    while (currentNode) {
      const value = normalizeText(currentNode.textContent);
      if (value) {
        tokens.push(value);
      }

      currentNode = walker.nextNode();
    }

    return unique(tokens);
  }

  function firstVisibleElement(nodes) {
    for (const node of nodes) {
      if (node instanceof HTMLElement && isVisible(node)) {
        return node;
      }
    }

    return null;
  }

  function isVisible(element) {
    if (!(element instanceof Element)) {
      return false;
    }

    const style = window.getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
      return false;
    }

    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function normalizeText(value) {
    return (value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  }

  function normalizeInlineText(value) {
    return (value || "")
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n[ \t]+/g, "\n")
      .replace(/[ \t]{2,}/g, " ");
  }

  function normalizeMarkdownBlock(value) {
    return normalizeInlineText(value).replace(/\n{3,}/g, "\n\n").trim();
  }

  function normalizeMediaUrl(value) {
    try {
      return new URL(value, location.origin).href;
    } catch (error) {
      return "";
    }
  }

  function toAbsoluteUrl(value) {
    if (!value) {
      return "";
    }

    try {
      return new URL(value, location.origin).href;
    } catch (error) {
      return "";
    }
  }

  function cleanPageUrl(value) {
    try {
      const url = new URL(value, location.origin);
      url.search = "";
      url.hash = "";
      return url.href;
    } catch (error) {
      return value;
    }
  }

  function extractStatusIdFromUrl(value) {
    const cleanUrl = toAbsoluteUrl(value);
    const match = cleanUrl.match(/^https:\/\/x\.com\/[^/]+\/status\/(\d+)(?:[/?#]|$)/);
    return match ? match[1] : "";
  }

  function wait(milliseconds) {
    return new Promise((resolve) => {
      window.setTimeout(resolve, milliseconds);
    });
  }

  function escapeMarkdownText(value) {
    return value.replace(/\\/g, "\\\\").replace(/\[/g, "\\[").replace(/\]/g, "\\]");
  }

  function formatTimeValue(dateTime, fallbackText = "") {
    if (dateTime) {
      const date = new Date(dateTime);
      if (!Number.isNaN(date.getTime())) {
        return new Intl.DateTimeFormat("zh-CN", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false
        })
          .format(date)
          .replace(/\//g, "-");
      }
    }

    return fallbackText;
  }

  function looksLikeAbsoluteUrl(value) {
    return /^https?:\/\//i.test(value);
  }

  function looksLikeCount(value) {
    return /^[\d.,]+[KMB万亿]?$/.test(value);
  }

  function isHandleText(value) {
    return /^@[A-Za-z0-9_]{1,15}$/.test(value);
  }

  function isMetaToken(value) {
    return value === "·" || value === "Follow" || value === "Following" || value === "订阅" || value === "已订阅";
  }

  function getScopedVisibleElements(root, selector, scopeArticle = null) {
    return Array.from(root.querySelectorAll(selector)).filter((node) => {
      if (!(node instanceof HTMLElement) || !isVisible(node)) {
        return false;
      }

      if (!(scopeArticle instanceof HTMLElement)) {
        return true;
      }

      return node.closest(SELECTORS.article) === scopeArticle;
    });
  }

  function extractUsernameFromPath(pathname) {
    const segments = pathname.split("/").filter(Boolean);
    return segments[0] || "";
  }

  function extractUsernameFromUrl(value) {
    try {
      const url = new URL(value, location.origin);
      const segments = url.pathname.split("/").filter(Boolean);
      return segments.length === 1 ? segments[0] : "";
    } catch (error) {
      return "";
    }
  }

  function uniqueByKey(values, getKey) {
    const seen = new Set();
    return values.filter((value) => {
      const key = getKey(value);
      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
  }

  function unique(values) {
    return Array.from(new Set(values));
  }
})();
