(() => {
  "use strict";

  const shared = window.__x2markdownShared;
  if (!shared) {
    return;
  }

  if (typeof Readability !== "function") {
    console.error("[x2markdown] Readability 未加载");
    shared.showToast(shared.t("errorReadabilityUnavailable", undefined, "Readability is not available"));
    return;
  }

  const mode = window.__x2markdownCopyMode || "main";
  delete window.__x2markdownCopyMode;

  void run();

  async function run() {
    try {
      if (mode === "selection") {
        const selectionPayload = shared.extractSelectionPayload();
        if (!selectionPayload) {
          throw new Error(shared.t("errorNoValidSelection", undefined, "No valid selection found"));
        }
        await copyPayload(selectionPayload, "selection");
        return;
      }

      const payload = extractReadablePayload();
      await copyPayload(payload, "main");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : shared.t("errorCopyFailedGeneric", undefined, "Copy failed");
      console.error("[x2markdown] 通用页面复制失败", error);
      shared.showToast(errorMessage);
    }
  }

  function extractReadablePayload() {
    const readerableSignal = getReaderableSignal();
    const documentClone = document.cloneNode(true);
    const article = new Readability(documentClone, {
      serializer(element) {
        return element;
      }
    }).parse();

    if (!article || !(article.content instanceof Element)) {
      throwUnreadablePageError();
    }

    const converted = shared.convertNodeToMarkdown(article.content);
    const bodyMarkdown = converted.markdown;
    const textLength = shared.normalizeText(article.textContent).length;
    const blockCount = countMeaningfulBlocks(bodyMarkdown);
    const minimumLength = readerableSignal ? 60 : 140;
    const minimumBlocks = readerableSignal ? 1 : 2;

    if (!bodyMarkdown || textLength < minimumLength || blockCount < minimumBlocks) {
      throwUnreadablePageError();
    }

    return {
      sourceKind: "page",
      title: shared.normalizeText(article.title) || shared.normalizeText(document.title),
      url: shared.cleanPageUrl(location.href),
      author: shared.normalizeText(article.byline),
      publishedAt: shared.formatTimeValue(article.publishedTime),
      siteName: shared.normalizeText(article.siteName) || shared.getDisplaySiteName(),
      bodyMarkdown,
      images: converted.images
    };
  }

  function getReaderableSignal() {
    const candidates = Array.from(document.querySelectorAll("article, main p, article p, pre, div > br")).filter((node) => {
      if (!(node instanceof Element)) {
        return false;
      }

      if (node instanceof HTMLElement && !shared.isVisible(node)) {
        return false;
      }

      const text = shared.normalizeText(node.textContent);
      return text.length >= 140;
    });

    return candidates.length >= 2 || candidates.some((node) => node.closest("article, main"));
  }

  function countMeaningfulBlocks(markdown) {
    return markdown
      .split(/\n{2,}/)
      .map((block) => shared.normalizeText(block.replace(/^[-#>|`*~\s]+/g, "")))
      .filter((block) => block.length >= 20).length;
  }

  function throwUnreadablePageError() {
    throw new Error(
      shared.t(
        "errorPageNotReadable",
        undefined,
        "This page does not look like a readable article. Select the content and try again."
      )
    );
  }

  async function copyPayload(payload, payloadMode) {
    const markdown = shared.buildGenericMarkdown(payload);

    await shared.copyToClipboard(markdown);
    const toastKey = payloadMode === "selection" ? "toastCopiedSelectionAsMarkdown" : "toastCopiedBodyAsMarkdown";
    const toastFallback = payloadMode === "selection" ? "Copied selection as Markdown" : "Copied body as Markdown";
    shared.showToast(shared.t(toastKey, undefined, toastFallback));
  }
})();
