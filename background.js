const MENU_ID = "copy_as_markdown";
const COPY_MESSAGE_TYPE = "COPY_MARKDOWN_FROM_PAGE";
const MENU_VISIBILITY_MESSAGE_TYPE = "SET_CONTEXT_MENU_VISIBILITY";
const DOCUMENT_URL_PATTERNS = ["https://x.com/*"];
const PAGE_URL_PATTERN = /^https:\/\/x\.com\/(?:$|[?#]|.+)/;

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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== MENU_VISIBILITY_MESSAGE_TYPE) {
    return undefined;
  }

  void handleMenuVisibilityUpdate(Boolean(message.visible), sender)
    .then(() => {
      sendResponse({ ok: true });
    })
    .catch((error) => {
      console.error("[x2markdown] 更新菜单可见性失败", error);
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : "更新菜单失败"
      });
    });

  return true;
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
    title: t("contextMenuCopyAsMarkdown", undefined, "Copy as Markdown"),
    contexts: ["all"],
    documentUrlPatterns: DOCUMENT_URL_PATTERNS,
    visible: false
  });
}

async function handleMenuVisibilityUpdate(visible, sender) {
  if (!sender.tab || typeof sender.tab.id !== "number") {
    return;
  }

  await updateContextMenuVisibility(visible);
}

async function sendCopyMessageWithFallback(tabId) {
  try {
    return await chrome.tabs.sendMessage(tabId, {
      type: COPY_MESSAGE_TYPE
    });
  } catch (error) {
    if (!shouldInjectContentScript(error)) {
      throw error;
    }

    await ensureContentScript(tabId);

    return chrome.tabs.sendMessage(tabId, {
      type: COPY_MESSAGE_TYPE
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

function updateContextMenuVisibility(visible) {
  return new Promise((resolve, reject) => {
    chrome.contextMenus.update(
      MENU_ID,
      {
        visible
      },
      () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        resolve();
      }
    );
  });
}

function t(messageName, substitutions, fallback = "") {
  const message =
    typeof chrome !== "undefined" && chrome.i18n && typeof chrome.i18n.getMessage === "function"
      ? chrome.i18n.getMessage(messageName, substitutions)
      : "";

  return message || fallback || messageName;
}
