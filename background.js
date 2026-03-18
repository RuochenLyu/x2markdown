const MENU_ID = "copy_as_markdown";
const MESSAGE_TYPE = "COPY_MARKDOWN_FROM_PAGE";
const DOCUMENT_URL_PATTERNS = ["https://x.com/*/status/*", "https://x.com/*/article/*"];
const PAGE_URL_PATTERN = /^https:\/\/x\.com\/[^/]+\/(?:status|article)\/\d+(?:[/?#]|$)/;

chrome.runtime.onInstalled.addListener(() => {
  void ensureContextMenu();
});

chrome.runtime.onStartup.addListener(() => {
  void ensureContextMenu();
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ID) {
    return;
  }

  if (!tab || typeof tab.id !== "number" || !tab.url || !isSupportedPageUrl(tab.url)) {
    return;
  }

  void handleCopyRequest(tab.id);
});

async function handleCopyRequest(tabId) {
  try {
    const response = await sendCopyMessageWithFallback(tabId);
    if (!response || response.ok !== true) {
      console.error("[x2markdown] 页面复制失败", response && response.error ? response.error : "未知错误");
    }
  } catch (error) {
    console.error("[x2markdown] 无法触发页面复制", error);
  }
}

async function ensureContextMenu() {
  await removeAllContextMenus();

  chrome.contextMenus.create({
    id: MENU_ID,
    title: "复制为 Markdown",
    contexts: ["page"],
    documentUrlPatterns: DOCUMENT_URL_PATTERNS
  });
}

async function sendCopyMessageWithFallback(tabId) {
  try {
    return await chrome.tabs.sendMessage(tabId, {
      type: MESSAGE_TYPE
    });
  } catch (error) {
    if (!shouldInjectContentScript(error)) {
      throw error;
    }

    await ensureContentScript(tabId);

    return chrome.tabs.sendMessage(tabId, {
      type: MESSAGE_TYPE
    });
  }
}

async function ensureContentScript(tabId) {
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
    files: ["content.js"]
  });
}

function shouldInjectContentScript(error) {
  const message = error instanceof Error ? error.message : String(error || "");
  return message.includes("Receiving end does not exist") || message.includes("Could not establish connection");
}

function isSupportedPageUrl(url) {
  return PAGE_URL_PATTERN.test(url);
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
