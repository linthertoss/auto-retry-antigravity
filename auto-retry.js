// =============================================================================
// Auto-Retry for Antigravity IDE v3.0
// NO innerHTML, NO trusted-types, NO require('fs')
// Floating inspection panel — no DevTools needed
// =============================================================================
(function () {
  "use strict";

  // ─── Configuration ──────────────────────────────────────────────────────────
  var CONFIG = {
    maxRetries: 10,
    initialDelay: 800,
    maxDelay: 10000,
    backoffMultiplier: 1.5,
    cooldownPeriod: 2000,
    debug: true,
    showIndicator: true,

    // CSS selectors to find retry buttons
    selectors: [
      'button[title*="Retry" i]',
      'button[aria-label*="Retry" i]',
      '[data-action="retry"]',
      ".retry-button",
      ".action-retry",
      'button[title*="Resend" i]',
      'button[title*="Try again" i]',
      'button[aria-label*="Try again" i]',
      'button[title*="Regenerate" i]',
      ".error-retry-button",
    ],

    // Text patterns for button detection
    textPatterns: [
      /^retry$/i,
      /^try again$/i,
      /^resend$/i,
      /^regenerate$/i,
      /retry request/i,
      /click to retry/i,
    ],

    // Icon selectors
    iconSelectors: [
      ".codicon-refresh",
      ".codicon-sync",
      ".codicon-debug-restart",
    ],
  };

  // ─── State ──────────────────────────────────────────────────────────────────
  var retryCount = 0;
  var lastRetryTime = 0;
  var currentDelay = CONFIG.initialDelay;
  var retryTimeout = null;
  var isWaitingForRetry = false;
  var indicator = null;
  var indicatorText = null;
  var totalRetries = 0;
  var observer = null;
  var checkDebounceTimer = null;
  var inspectPanel = null;
  var inspectPanelBody = null;
  var inspectPanelVisible = false;

  // ─── Logging ────────────────────────────────────────────────────────────────
  var PREFIX = "[Auto-Retry]";

  function log() {
    if (!CONFIG.debug) return;
    try {
      var args = Array.prototype.slice.call(arguments);
      args.unshift("%c" + PREFIX, "color: #ff9800; font-weight: bold;");
      console.log.apply(console, args);
    } catch (e) {}
  }

  function logSuccess() {
    try {
      var args = Array.prototype.slice.call(arguments);
      args.unshift("%c" + PREFIX, "color: #4caf50; font-weight: bold;");
      console.log.apply(console, args);
    } catch (e) {}
  }

  function logWarn() {
    try {
      var args = Array.prototype.slice.call(arguments);
      args.unshift("%c" + PREFIX, "color: #f44336; font-weight: bold;");
      console.warn.apply(console, args);
    } catch (e) {}
  }

  // ─── Status Indicator ─────────────────────────────────────────────────────
  function createIndicator() {
    if (!CONFIG.showIndicator) return;

    indicator = document.createElement("div");
    indicator.id = "auto-retry-indicator";
    indicator.style.position = "fixed";
    indicator.style.bottom = "3px";
    indicator.style.right = "12px";
    indicator.style.zIndex = "999999";
    indicator.style.padding = "2px 8px";
    indicator.style.borderRadius = "10px";
    indicator.style.fontSize = "11px";
    indicator.style.fontFamily =
      "var(--vscode-font-family, 'Segoe UI', sans-serif)";
    indicator.style.fontWeight = "500";
    indicator.style.color = "#fff";
    indicator.style.background = "rgba(76, 175, 80, 0.85)";
    indicator.style.backdropFilter = "blur(8px)";
    indicator.style.cursor = "pointer";
    indicator.style.transition = "all 0.3s ease";
    indicator.style.userSelect = "none";
    indicator.style.display = "flex";
    indicator.style.alignItems = "center";
    indicator.style.gap = "5px";
    indicator.style.boxShadow = "0 2px 8px rgba(0,0,0,0.2)";
    indicator.style.pointerEvents = "auto";

    indicatorText = document.createTextNode("\u26A1 Auto-Retry: ON");
    indicator.appendChild(indicatorText);

    indicator.title = "Click = show inspection panel | Double-click = toggle on/off";

    // Single click → toggle inspection panel
    indicator.addEventListener("click", function (e) {
      e.stopPropagation();
      toggleInspectPanel();
    });

    // Double-click → toggle auto-retry
    indicator.addEventListener("dblclick", function (e) {
      e.stopPropagation();
      if (observer) {
        observer.disconnect();
        observer = null;
        updateIndicator("disabled");
        logWarn("Auto-Retry DISABLED");
      } else {
        startObserving();
        updateIndicator("idle");
        logSuccess("Auto-Retry RE-ENABLED");
      }
    });

    document.body.appendChild(indicator);
  }

  function updateIndicator(state) {
    if (!indicator || !indicatorText) return;

    var bg, text;
    switch (state) {
      case "retrying":
        bg = "rgba(255, 152, 0, 0.9)";
        text = "\uD83D\uDD04 Retrying... (" + retryCount + "/" + CONFIG.maxRetries + ")";
        break;
      case "maxReached":
        bg = "rgba(244, 67, 54, 0.9)";
        text = "\u26D4 Max retries (" + CONFIG.maxRetries + ")";
        break;
      case "disabled":
        bg = "rgba(158, 158, 158, 0.7)";
        text = "\uD83D\uDCA4 Auto-Retry: OFF";
        break;
      case "success":
        bg = "rgba(76, 175, 80, 0.85)";
        text = "\u2705 OK! (total: " + totalRetries + ")";
        break;
      default:
        bg = "rgba(76, 175, 80, 0.85)";
        text = "\u26A1 Auto-Retry: ON";
        break;
    }

    indicator.style.background = bg;
    indicatorText.nodeValue = text;
  }

  // ─── Floating Inspection Panel ─────────────────────────────────────────────
  function createInspectPanel() {
    inspectPanel = document.createElement("div");
    inspectPanel.id = "auto-retry-inspect-panel";
    inspectPanel.style.position = "fixed";
    inspectPanel.style.bottom = "30px";
    inspectPanel.style.right = "12px";
    inspectPanel.style.width = "500px";
    inspectPanel.style.maxHeight = "400px";
    inspectPanel.style.zIndex = "999998";
    inspectPanel.style.background = "var(--vscode-editor-background, #1e1e1e)";
    inspectPanel.style.color = "var(--vscode-editor-foreground, #ccc)";
    inspectPanel.style.border = "1px solid var(--vscode-widget-border, #444)";
    inspectPanel.style.borderRadius = "8px";
    inspectPanel.style.boxShadow = "0 8px 32px rgba(0,0,0,0.5)";
    inspectPanel.style.fontFamily = "var(--vscode-editor-font-family, monospace)";
    inspectPanel.style.fontSize = "11px";
    inspectPanel.style.display = "none";
    inspectPanel.style.flexDirection = "column";
    inspectPanel.style.overflow = "hidden";

    // Header
    var header = document.createElement("div");
    header.style.padding = "8px 12px";
    header.style.background = "var(--vscode-titleBar-activeBackground, #333)";
    header.style.fontWeight = "bold";
    header.style.fontSize = "12px";
    header.style.display = "flex";
    header.style.justifyContent = "space-between";
    header.style.alignItems = "center";

    var headerTitle = document.createTextNode("\uD83D\uDD0D Auto-Retry Inspector");
    header.appendChild(headerTitle);

    var refreshBtn = document.createElement("span");
    refreshBtn.style.cursor = "pointer";
    refreshBtn.style.padding = "2px 6px";
    refreshBtn.style.borderRadius = "4px";
    refreshBtn.style.background = "rgba(255,255,255,0.1)";
    refreshBtn.appendChild(document.createTextNode("\u21BB Refresh"));
    refreshBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      populateInspectPanel();
    });
    header.appendChild(refreshBtn);

    inspectPanel.appendChild(header);

    // Body (scrollable)
    inspectPanelBody = document.createElement("div");
    inspectPanelBody.style.padding = "8px";
    inspectPanelBody.style.overflowY = "auto";
    inspectPanelBody.style.maxHeight = "360px";
    inspectPanel.appendChild(inspectPanelBody);

    document.body.appendChild(inspectPanel);
  }

  function toggleInspectPanel() {
    if (!inspectPanel) createInspectPanel();

    inspectPanelVisible = !inspectPanelVisible;
    inspectPanel.style.display = inspectPanelVisible ? "flex" : "none";

    if (inspectPanelVisible) {
      populateInspectPanel();
    }
  }

  function populateInspectPanel() {
    if (!inspectPanelBody) return;

    // Clear body using DOM API (no innerHTML)
    while (inspectPanelBody.firstChild) {
      inspectPanelBody.removeChild(inspectPanelBody.firstChild);
    }

    // Scan all clickable elements
    var allClickable = document.querySelectorAll(
      'button, [role="button"], a, [onclick], span[class*="action"], div[class*="action"]'
    );
    var results = [];

    allClickable.forEach(function (el) {
      if (el.id === "auto-retry-indicator" || el.id === "auto-retry-inspect-panel") return;
      if (el.closest("#auto-retry-inspect-panel")) return;

      var text = (el.textContent || "").trim().substring(0, 60);
      var title = el.getAttribute("title") || "";
      var ariaLabel = el.getAttribute("aria-label") || "";
      var className = (el.className || "").toString().substring(0, 100);
      var tagName = el.tagName;
      var visible = isVisible(el);

      if (!visible) return;
      if (!text && !title && !ariaLabel) return;

      var searchText = (text + " " + title + " " + ariaLabel + " " + className).toLowerCase();
      var isRetryLike =
        searchText.indexOf("retry") !== -1 ||
        searchText.indexOf("try again") !== -1 ||
        searchText.indexOf("resend") !== -1 ||
        searchText.indexOf("regenerate") !== -1 ||
        searchText.indexOf("error") !== -1 ||
        searchText.indexOf("refresh") !== -1;

      results.push({
        el: el,
        tag: tagName,
        text: text,
        title: title,
        ariaLabel: ariaLabel,
        className: className,
        isRetryLike: isRetryLike,
      });
    });

    // Status line
    var statusLine = document.createElement("div");
    statusLine.style.padding = "4px 4px 8px";
    statusLine.style.borderBottom = "1px solid rgba(255,255,255,0.1)";
    statusLine.style.marginBottom = "8px";
    statusLine.style.color = "#4caf50";
    statusLine.appendChild(
      document.createTextNode(
        "Found " + results.length + " clickable elements. " +
        "Retry-like: " + results.filter(function(r) { return r.isRetryLike; }).length +
        " | Status: retries=" + retryCount + " total=" + totalRetries
      )
    );
    inspectPanelBody.appendChild(statusLine);

    // Show retry-like first, then others
    var sorted = results.sort(function (a, b) {
      if (a.isRetryLike && !b.isRetryLike) return -1;
      if (!a.isRetryLike && b.isRetryLike) return 1;
      return 0;
    });

    // Only show first 50
    var shown = sorted.slice(0, 50);
    shown.forEach(function (item, idx) {
      var row = document.createElement("div");
      row.style.padding = "4px";
      row.style.marginBottom = "2px";
      row.style.borderRadius = "4px";
      row.style.background = item.isRetryLike
        ? "rgba(255, 152, 0, 0.15)"
        : "rgba(255,255,255,0.03)";
      row.style.borderLeft = item.isRetryLike
        ? "3px solid #ff9800"
        : "3px solid transparent";
      row.style.cursor = "pointer";
      row.style.lineHeight = "1.4";

      var line1 = document.createElement("div");
      line1.style.fontWeight = "bold";
      line1.style.color = item.isRetryLike ? "#ff9800" : "#ccc";
      line1.appendChild(
        document.createTextNode(
          (item.isRetryLike ? "\u26A0 " : "") +
          "<" + item.tag + "> " +
          (item.text || "(no text)")
        )
      );
      row.appendChild(line1);

      if (item.title || item.ariaLabel) {
        var line2 = document.createElement("div");
        line2.style.color = "#888";
        line2.style.fontSize = "10px";
        line2.appendChild(
          document.createTextNode(
            "title=\"" + item.title + "\" aria=\"" + item.ariaLabel + "\""
          )
        );
        row.appendChild(line2);
      }

      var line3 = document.createElement("div");
      line3.style.color = "#666";
      line3.style.fontSize = "10px";
      line3.style.wordBreak = "break-all";
      line3.appendChild(
        document.createTextNode("class: " + item.className.substring(0, 80))
      );
      row.appendChild(line3);

      // Click to highlight on page
      row.addEventListener("click", function (e) {
        e.stopPropagation();
        item.el.style.outline = "3px solid #ff0000";
        item.el.style.outlineOffset = "2px";
        setTimeout(function () {
          item.el.style.outline = "";
          item.el.style.outlineOffset = "";
        }, 3000);
        item.el.scrollIntoView({ behavior: "smooth", block: "center" });
      });

      inspectPanelBody.appendChild(row);
    });

    if (results.length > 50) {
      var more = document.createElement("div");
      more.style.color = "#888";
      more.style.padding = "4px";
      more.appendChild(
        document.createTextNode("... and " + (results.length - 50) + " more")
      );
      inspectPanelBody.appendChild(more);
    }
  }

  // ─── Button Detection ──────────────────────────────────────────────────────
  function isVisible(el) {
    if (!el) return false;
    try {
      var style = window.getComputedStyle(el);
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        style.opacity !== "0" &&
        el.offsetParent !== null
      );
    } catch (e) {
      return false;
    }
  }

  function findRetryButton() {
    var i, btn, el, text, icon;

    // Strategy 1: CSS Selectors
    for (i = 0; i < CONFIG.selectors.length; i++) {
      try {
        btn = document.querySelector(CONFIG.selectors[i]);
        if (btn && isVisible(btn)) {
          log("Found via selector:", CONFIG.selectors[i]);
          return btn;
        }
      } catch (e) {}
    }

    // Strategy 2: Text content matching
    var candidates = document.querySelectorAll(
      'button, [role="button"], a.action-label, .monaco-button, .action-item a'
    );
    for (i = 0; i < candidates.length; i++) {
      el = candidates[i];
      text = (
        (el.textContent || "").trim() +
        " " +
        (el.getAttribute("title") || "") +
        " " +
        (el.getAttribute("aria-label") || "")
      ).trim();
      if (text) {
        for (var j = 0; j < CONFIG.textPatterns.length; j++) {
          if (CONFIG.textPatterns[j].test(text) && isVisible(el)) {
            log("Found via text:", text);
            return el;
          }
        }
      }
    }

    // Strategy 3: Icon-based
    for (i = 0; i < CONFIG.iconSelectors.length; i++) {
      try {
        icon = document.querySelector(CONFIG.iconSelectors[i]);
        if (icon && isVisible(icon)) {
          btn =
            icon.closest("button") ||
            icon.closest('[role="button"]') ||
            icon.closest("a") ||
            icon;
          log("Found via icon:", CONFIG.iconSelectors[i]);
          return btn;
        }
      } catch (e) {}
    }

    return null;
  }

  // ─── Retry Logic ───────────────────────────────────────────────────────────
  function handleRetry(button) {
    var now = Date.now();

    if (now - lastRetryTime < CONFIG.cooldownPeriod) {
      log("Still in cooldown, skipping...");
      return;
    }
    if (retryCount >= CONFIG.maxRetries) {
      logWarn("Max retries (" + CONFIG.maxRetries + ") reached! Stopping.");
      updateIndicator("maxReached");
      return;
    }
    if (isWaitingForRetry) {
      log("Already waiting for retry, skipping...");
      return;
    }

    isWaitingForRetry = true;
    retryCount++;
    totalRetries++;
    updateIndicator("retrying");

    log("Scheduling retry " + retryCount + "/" + CONFIG.maxRetries + " in " + currentDelay + "ms...");

    retryTimeout = setTimeout(function () {
      var btn = findRetryButton();
      if (btn) {
        logSuccess("Clicking retry! (attempt " + retryCount + "/" + CONFIG.maxRetries + ")");
        btn.click();
        try {
          btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
          btn.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
        } catch (e) {}
      } else {
        log("Button disappeared before click, might be resolved.");
        resetState();
      }

      isWaitingForRetry = false;
      currentDelay = Math.min(currentDelay * CONFIG.backoffMultiplier, CONFIG.maxDelay);
      lastRetryTime = Date.now();
    }, currentDelay);
  }

  function resetState() {
    retryCount = 0;
    currentDelay = CONFIG.initialDelay;
    isWaitingForRetry = false;
    if (retryTimeout) {
      clearTimeout(retryTimeout);
      retryTimeout = null;
    }
    if (totalRetries > 0) {
      updateIndicator("success");
      setTimeout(function () { updateIndicator("idle"); }, 3000);
    } else {
      updateIndicator("idle");
    }
  }

  // ─── DOM Observer ──────────────────────────────────────────────────────────
  function onDOMMutation() {
    if (checkDebounceTimer) return;

    checkDebounceTimer = setTimeout(function () {
      checkDebounceTimer = null;

      var btn = findRetryButton();
      if (btn) {
        handleRetry(btn);
      } else if (retryCount > 0 && !isWaitingForRetry) {
        log("Retry button gone, request probably succeeded!");
        resetState();
      }
    }, 300);
  }

  function startObserving() {
    observer = new MutationObserver(onDOMMutation);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
    log("Observer started.");
  }

  // ─── Global helpers ────────────────────────────────────────────────────────
  window.__autoRetryConfig = CONFIG;
  window.__autoRetryReset = resetState;
  window.__autoRetryStatus = function () {
    return {
      retryCount: retryCount,
      totalRetries: totalRetries,
      currentDelay: currentDelay,
      isWaitingForRetry: isWaitingForRetry,
      observerActive: !!observer,
    };
  };
  window.__autoRetryInspect = toggleInspectPanel;

  // ─── Initialize ────────────────────────────────────────────────────────────
  function init() {
    logSuccess("Auto-Retry v3.0 loaded. Max retries: " + CONFIG.maxRetries);
    createIndicator();
    startObserving();
  }

  if (document.readyState === "complete") {
    setTimeout(init, 3000);
  } else {
    window.addEventListener("load", function () {
      setTimeout(init, 3000);
    });
  }
})();
