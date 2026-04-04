const PAGE_MENU_ID = "copy_as_markdown";
const SELECTION_MENU_ID = "copy_selection_as_markdown";
const COPY_MESSAGE_TYPE = "COPY_MARKDOWN_FROM_PAGE";
const DOCUMENT_URL_PATTERNS = ["http://*/*", "https://*/*"];
const HTTP_PAGE_URL_PATTERN = /^https?:\/\//i;
const X_PAGE_URL_PATTERN = /^https:\/\/x\.com\/(?:$|[?#]|.+)/i;
const CHROME_WEB_STORE_URL_PATTERN = /^https:\/\/(chromewebstore\.google\.com|chrome\.google\.com\/webstore)\//i;
const PDF_URL_PATTERN = /\.pdf(?:[?#]|$)/i;
const ERROR_BADGE_TEXT = "!";
const ERROR_TIMEOUTS = new Map();

chrome.runtime.onInstalled.addListener(() => {
  void ensureContextMenu();
});

chrome.runtime.onStartup.addListener(() => {
  void ensureContextMenu();
});

chrome.tabs.onRemoved.addListener((tabId) => {
  clearTimeoutForTab(tabId);
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== PAGE_MENU_ID && info.menuItemId !== SELECTION_MENU_ID) {
    return;
  }

  if (!tab || typeof tab.id !== "number" || !tab.url || !isSupportedPageUrl(tab.url)) {
    return;
  }

  const mode = info.menuItemId === SELECTION_MENU_ID ? "selection" : "main";
  void handleCopyRequest(tab.id, tab.url, mode);
});

async function handleCopyRequest(tabId, url, mode) {
  await clearActionError(tabId);

  try {
    if (isKnownBlockedPageUrl(url)) {
      await showActionError(tabId, t("errorPageInjectionBlocked", undefined, "This page does not allow script injection"));
      return;
    }

    if (isXPageUrl(url)) {
      const response = await sendCopyMessageToXPage(tabId, mode);
      if (!response || response.ok !== true) {
        console.error("[x2markdown] X 页面复制失败", response && response.error ? response.error : "未知错误");
      }
      return;
    }

    await chrome.scripting.executeScript({
      target: { tabId },
      func: (m) => { window.__x2markdownCopyMode = m; },
      args: [mode]
    });
    await injectFiles(tabId, ["shared.js", "readability.js", "content-generic.js"]);
  } catch (error) {
    console.error("[x2markdown] 无法触发页面复制", error);
    await showActionError(tabId, t("errorPageInjectionBlocked", undefined, "This page does not allow script injection"));
  }
}

async function ensureContextMenu() {
  await removeAllContextMenus();

  chrome.contextMenus.create({
    id: PAGE_MENU_ID,
    title: t("contextMenuCopyBodyAsMarkdown", undefined, "Copy Body as Markdown"),
    contexts: ["page", "frame", "link", "image", "audio", "video"],
    documentUrlPatterns: DOCUMENT_URL_PATTERNS
  });

  chrome.contextMenus.create({
    id: SELECTION_MENU_ID,
    title: t("contextMenuCopySelectionAsMarkdown", undefined, "Copy Selection as Markdown"),
    contexts: ["selection"],
    documentUrlPatterns: DOCUMENT_URL_PATTERNS
  });
}

async function sendCopyMessageToXPage(tabId, mode) {
  try {
    return await chrome.tabs.sendMessage(tabId, {
      type: COPY_MESSAGE_TYPE,
      mode
    });
  } catch (error) {
    if (!shouldInjectContentScript(error)) {
      throw error;
    }

    await injectFiles(tabId, ["shared.js", "content-x.js"]);

    return chrome.tabs.sendMessage(tabId, {
      type: COPY_MESSAGE_TYPE,
      mode
    });
  }
}

async function injectFiles(tabId, scriptFiles) {
  try {
    await chrome.scripting.insertCSS({
      target: { tabId },
      files: ["content.css"]
    });
  } catch (error) {
    console.warn("[x2markdown] 注入样式失败，将继续尝试注入脚本", error);
  }

  await chrome.scripting.executeScript({
    target: { tabId },
    files: scriptFiles
  });
}

function shouldInjectContentScript(error) {
  const message = error instanceof Error ? error.message : String(error || "");
  return message.includes("Receiving end does not exist") || message.includes("Could not establish connection");
}

function isSupportedPageUrl(url) {
  return HTTP_PAGE_URL_PATTERN.test(url);
}

function isXPageUrl(url) {
  return X_PAGE_URL_PATTERN.test(url);
}

function isKnownBlockedPageUrl(url) {
  return CHROME_WEB_STORE_URL_PATTERN.test(url) || PDF_URL_PATTERN.test(url);
}

async function showActionError(tabId, message) {
  if (!chrome.action || typeof chrome.action.setBadgeText !== "function") {
    return;
  }

  try {
    await chrome.action.setBadgeBackgroundColor({
      color: "#b42318",
      tabId
    });
    await chrome.action.setBadgeText({
      text: ERROR_BADGE_TEXT,
      tabId
    });
    await chrome.action.setTitle({
      title: `${t("extName", undefined, "X2Markdown")}\n${message}`,
      tabId
    });

    clearTimeoutForTab(tabId);
    const timeoutId = setTimeout(() => {
      void clearActionError(tabId);
    }, 4000);
    ERROR_TIMEOUTS.set(tabId, timeoutId);
  } catch (error) {
    console.error("[x2markdown] 无法显示错误徽标", error);
  }
}

async function clearActionError(tabId) {
  if (!chrome.action || typeof chrome.action.setBadgeText !== "function") {
    return;
  }

  clearTimeoutForTab(tabId);

  try {
    await chrome.action.setBadgeText({
      text: "",
      tabId
    });
    await chrome.action.setTitle({
      title: t("extName", undefined, "X2Markdown"),
      tabId
    });
  } catch (error) {
    console.error("[x2markdown] 无法清理错误徽标", error);
  }
}

function clearTimeoutForTab(tabId) {
  const timeoutId = ERROR_TIMEOUTS.get(tabId);
  if (timeoutId) {
    clearTimeout(timeoutId);
    ERROR_TIMEOUTS.delete(tabId);
  }
}

function removeAllContextMenus() {
  return new Promise((resolve, reject) => {
    chrome.contextMenus.removeAll(() => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      resolve();
    });
  });
}

function t(messageName, substitutions, fallback = "") {
  const message =
    typeof chrome !== "undefined" && chrome.i18n && typeof chrome.i18n.getMessage === "function"
      ? chrome.i18n.getMessage(messageName, substitutions)
      : "";

  return message || fallback || messageName;
}
