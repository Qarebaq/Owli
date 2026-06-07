(() => {
  "use strict";

  const api = globalThis.browser ?? globalThis.chrome;
  const ROOT_CLASS = "smart-bidi-enabled";
  const PROCESSED = "data-smart-bidi";
  const ORIGINAL_DIR = "data-smart-bidi-original-dir";

  // Only real text blocks are processed. Large message/container elements are
  // intentionally excluded because styling both parent and child breaks mixed text.
  const TEXT_SELECTOR = [
    "p", "li", "blockquote", "dd", "dt", "figcaption",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "td", "th"
  ].join(",");

  const EDITABLE_SELECTOR = [
    "textarea",
    "input[type='text']",
    "input[type='search']",
    "input:not([type])",
    "[contenteditable='true']",
    "[contenteditable='']",
    "[role='textbox']"
  ].join(",");

  const ARABIC_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/u;
  const LATIN_RE = /[A-Za-z\u00C0-\u024F]/u;
  const STRONG_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFFA-Za-z\u00C0-\u024F]/gu;

  let settings = {
    enabled: true,
    mode: "auto",
    siteOverrides: {}
  };

  const hostname = location.hostname;

  function effectiveEnabled() {
    const override = settings.siteOverrides?.[hostname];
    return override ?? settings.enabled;
  }

  function isExcluded(el) {
    return Boolean(el.closest([
      "pre", "code", "kbd", "samp", "svg", "math",
      "script", "style", "select", "option",
      "[contenteditable='false']",
      "[aria-hidden='true']"
    ].join(",")));
  }

  function isEditable(el) {
    return el.matches?.(EDITABLE_SELECTOR);
  }

  function cleanText(el) {
    return (("value" in el ? el.value : el.textContent) || "")
      .replace(/\u200E|\u200F|\u202A|\u202B|\u202C|\u2066|\u2067|\u2068|\u2069/gu, "")
      .trim();
  }

  function firstStrongDirection(text) {
    for (const ch of text) {
      if (ARABIC_RE.test(ch)) return "rtl";
      if (LATIN_RE.test(ch)) return "ltr";
    }
    return null;
  }

  function directionStats(text) {
    let rtl = 0;
    let ltr = 0;
    const chars = text.match(STRONG_RE) || [];
    for (const ch of chars) {
      if (ARABIC_RE.test(ch)) rtl++;
      else if (LATIN_RE.test(ch)) ltr++;
    }
    return { rtl, ltr };
  }

  function preferredAlignment(text) {
    const first = firstStrongDirection(text);
    const { rtl, ltr } = directionStats(text);

    if (!rtl && !ltr) return null;

    // The first strong character is the safest paragraph-level signal.
    // A dominance fallback helps with text beginning with numbers or punctuation.
    if (first) return first;
    return rtl >= ltr ? "rtl" : "ltr";
  }

  function rememberOriginalDir(el) {
    if (!el.hasAttribute(ORIGINAL_DIR)) {
      el.setAttribute(ORIGINAL_DIR, el.hasAttribute("dir") ? el.getAttribute("dir") : "");
    }
  }

  function setAutoDirection(el, text) {
    const alignment = preferredAlignment(text);
    if (!alignment) return;

    rememberOriginalDir(el);
    el.setAttribute(PROCESSED, "auto");
    el.setAttribute("dir", "auto");
    el.style.setProperty("text-align", alignment === "rtl" ? "right" : "left", "important");

    // Do not force unicode-bidi here. dir=auto lets Firefox's Unicode bidi
    // algorithm correctly arrange Persian, English, numbers, punctuation and links.
    el.style.removeProperty("direction");
    el.style.removeProperty("unicode-bidi");
  }

  function setForcedDirection(el, dir) {
    rememberOriginalDir(el);
    el.setAttribute(PROCESSED, dir);
    el.setAttribute("dir", dir);
    el.style.setProperty("direction", dir, "important");
    el.style.setProperty("text-align", dir === "rtl" ? "right" : "left", "important");
    el.style.setProperty("unicode-bidi", "isolate", "important");
  }

  function processElement(el) {
    if (!(el instanceof HTMLElement) || isExcluded(el) || isEditable(el)) return;

    const text = cleanText(el);
    if (!text || text.length > 50000) return;

    if (settings.mode === "rtl" || settings.mode === "ltr") {
      setForcedDirection(el, settings.mode);
    } else {
      setAutoDirection(el, text);
    }
  }

  function processEditable(el) {
    if (!(el instanceof HTMLElement) || isExcluded(el)) return;

    const text = cleanText(el);
    rememberOriginalDir(el);
    el.setAttribute(PROCESSED, "editable");

    if (settings.mode === "rtl" || settings.mode === "ltr") {
      el.setAttribute("dir", settings.mode);
      el.style.setProperty("direction", settings.mode, "important");
      el.style.setProperty("text-align", settings.mode === "rtl" ? "right" : "left", "important");
    } else {
      // dir=auto updates naturally while typing and handles mixed input better
      // than repeatedly forcing RTL/LTR on every keystroke.
      el.setAttribute("dir", "auto");
      const alignment = preferredAlignment(text);
      el.style.setProperty("text-align", alignment === "rtl" ? "right" : alignment === "ltr" ? "left" : "start", "important");
      el.style.removeProperty("direction");
    }
    el.style.removeProperty("unicode-bidi");
  }

  function scan(root = document) {
    if (!effectiveEnabled()) return;
    document.documentElement.classList.add(ROOT_CLASS);

    if (root instanceof HTMLElement) {
      if (root.matches(TEXT_SELECTOR)) processElement(root);
      if (isEditable(root)) processEditable(root);
    }

    root.querySelectorAll?.(TEXT_SELECTOR).forEach(processElement);
    root.querySelectorAll?.(EDITABLE_SELECTOR).forEach(processEditable);
  }

  function restoreElement(el) {
    el.style.removeProperty("direction");
    el.style.removeProperty("text-align");
    el.style.removeProperty("unicode-bidi");

    const originalDir = el.getAttribute(ORIGINAL_DIR);
    if (originalDir === "") el.removeAttribute("dir");
    else if (originalDir !== null) el.setAttribute("dir", originalDir);

    el.removeAttribute(PROCESSED);
    el.removeAttribute(ORIGINAL_DIR);
  }

  function clearStyles() {
    document.documentElement.classList.remove(ROOT_CLASS);
    document.querySelectorAll(`[${PROCESSED}]`).forEach(restoreElement);
  }

  function apply() {
    clearStyles();
    if (effectiveEnabled()) scan(document);
  }

  let queued = false;
  const pendingRoots = new Set();

  function queueScan(root) {
    if (!effectiveEnabled()) return;
    if (root instanceof Element) pendingRoots.add(root);
    if (queued) return;

    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      const roots = [...pendingRoots];
      pendingRoots.clear();
      roots.forEach(scan);
    });
  }

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "characterData") {
        const parent = mutation.target.parentElement;
        const block = parent?.closest(TEXT_SELECTOR);
        if (block) queueScan(block);
      } else {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) queueScan(node);
        });
      }
    }
  });

  document.addEventListener("input", (event) => {
    const target = event.target;
    if (target instanceof HTMLElement && isEditable(target) && effectiveEnabled()) {
      processEditable(target);
    }
  }, true);

  api.storage.local.get(settings).then((saved) => {
    settings = { ...settings, ...saved };
    apply();
    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      characterData: true
    });
  });

  api.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    for (const [key, change] of Object.entries(changes)) {
      settings[key] = change.newValue;
    }
    apply();
  });

  api.runtime.onMessage.addListener((message) => {
    if (message?.type === "smart-bidi-refresh") {
      apply();
      return Promise.resolve({ enabled: effectiveEnabled(), hostname });
    }
  });
})();
