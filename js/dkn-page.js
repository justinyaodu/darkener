"use strict";

// Create namespace.
const dknPage = {};

// Array of stylesheets injected into this page (except for "unhide").
dknPage.styleSheets = [];

/**
 * Return a link element pointing to a custom stylesheet.
 */
dknPage.createCssLink = function(cssName) {
  const link = document.createElement("link");
  link.href = browser.runtime.getURL(`style/${cssName}.css`);
  link.rel = "stylesheet";
  link.type = "text/css";
  return link;
}

/**
 * Add a stylesheet element to the document head, optionally registering it as
 * an injected stylesheet so that it can be toggled later.
 */
dknPage.addStyleSheet = function(styleSheet, register = true) {
  if (register) {
    dknPage.styleSheets.push(styleSheet);
  }

  document.head.appendChild(styleSheet);
}

/**
 * Enable or disable a stylesheet element.
 */
dknPage.setStyleSheetEnabled = function(styleSheet, enabled) {
  switch (styleSheet.tagName) {
    case "LINK":
      styleSheet.disabled = !enabled;
      break;

    case "STYLE":
      // (Ab)use media queries to enable/disable the stylesheet.
      styleSheet.media = enabled ? "all" : "not all";
      break;
  }
}

/**
 * Inject and enable all of the styles for this page.
 */
dknPage.initializeStyles = function() {
  dknPage.initializeStaticStyles();
  dknPage.initializeCustomStyles();
  dknPage.initializeDynamicStyles();
}

dknPage.initializeStaticStyles = function() {
  for (const staticStyle of dknPage.rule.staticStyles) {
    dknPage.addStyleSheet(dknPage.createCssLink(staticStyle));
  }
}

dknPage.initializeCustomStyles = function() {
  const customStyles = document.createElement("style");
  customStyles.textContent = dknPage.rule.customStyles.join('\n');
  dknPage.addStyleSheet(customStyles);
}

dknPage.initializeDynamicStyles = function() {
  if (dknPage.rule.dynamicStyles.length == 0) return;

  dknPage.dynamicStyles = [];
  for (const dynamicStyleName of dknPage.rule.dynamicStyles) {
    dknPage.dynamicStyles.push(dknDynamic[dynamicStyleName]);
  }

  // Create a stylesheet which is modified by dynamic styles.
  dknPage.dynamicStyleSheet = document.createElement("style");
  dknPage.addStyleSheet(dknPage.dynamicStyleSheet);

  // Apply dynamic styles to all nodes which are added later.
  const observer = new MutationObserver((mutations, observer) => {
    for (const mutation of mutations) {
      for (const addedNode of mutation.addedNodes) {
        dknPage.applyDynamicStyles(addedNode);
      }
    }
  });

  const observeOptions = {
    childList: true,
    subtree: true
  };

  observer.observe(document.body, observeOptions);

  // Apply custom styles to all nodes which are currently present.
  dknPage.applyDynamicStyles(document.body);
}

/**
 * Enable or disable all injected stylesheets (except for "unhide").
 */
dknPage.setEnabled = function(enabled) {
  dknPage.enabled = enabled;

  if (!dknPage.stylesInitialized && enabled) {
    dknPage.initializeStyles();
    dknPage.stylesInitialized = true;
  } else {
    for (const styleSheet of dknPage.styleSheets) {
      dknPage.setStyleSheetEnabled(styleSheet, enabled);
    }
  }
}

/**
 * Handle messages from the popup script.
 */
dknPage.messageHandler = function(message) {
  switch (message.type) {
    case "enabled":
      if (message.value != null) {
        dknPage.setEnabled(message.value);
      }
      return Promise.resolve(dknPage.enabled);
  }
}

// Map a dynamically generated CSS rule to the corresponding class name.
dknPage.dynamicRules = {};

// Store the number of dynamic rules separately, to avoid generating an array
// just to query its length.
dknPage.numDynamicRules = 0;

/**
 * Return the class name corresponding to a dynamically generated style rule,
 * assigning one and generating the CSS if needed.
 */
dknPage.getDynamicRuleClass = function(rule) {
  // If the same rule has been created before, return the existing class.
  let cssClass = dknPage.dynamicRules[rule];
  if (cssClass != null) return cssClass;
  
  // Number the classes from 0 increasing to get unique names.
  cssClass = "dkn-dynamic-" + (dknPage.numDynamicRules++);
  dknPage.dynamicRules[rule] = cssClass;

  // Append the rule to the dynamic stylesheet.
  dknPage.dynamicStyleSheet.textContent +=
      // Increase specificity by repeating the same class multiple times. This
      // is useful if the site's original CSS also uses !important (ew).
      `.${cssClass}`.repeat(5) + ` {\n  ${rule}\n}\n`;

  return cssClass;
}

// Tags which cannot contain displayable content.
dknPage.noContentTags =
    new Set(["BASE", "HEAD", "LINK", "META", "SCRIPT", "STYLE", "TITLE"]);

/**
 * Recursively apply all active dynamic styles to a subtree. Ignores non-element
 * nodes and elements which have already been dynamically styled.
 */
dknPage.applyDynamicStyles = function(node) {
  // Ignore nodes which are not elements.
  if (!(node instanceof Element)) return;

  // Ignore nodes which contain no content.
  if (dknPage.noContentTags.has(node.tagName)) return;

  // Ignore nodes which have already been styled.
  if (node.classList.contains("dkn-dynamic")) return;
  node.classList.add("dkn-dynamic");

  // Style children recursively.
  for (const child of node.children) {
    dknPage.applyDynamicStyles(child);
  }

  // Style this node.
  window.setTimeout(dknPage.applyDynamicStylesInner, 0, node);
  // dknPage.applyDynamicStylesInner(node);
}

dknPage.applyDynamicStylesInner = function(node) {
  const computedStyle = window.getComputedStyle(node);
  // Get the CSS rules which should be applied to this element.
  for (const dynamicStyleFunction of dknPage.dynamicStyles) {
    for (const css of dynamicStyleFunction(node, computedStyle)) {
      // Apply the CSS by adding the corresponding class to this element.
      node.classList.add(dknPage.getDynamicRuleClass(css));
    }
  }
}

dknPage.main = async function() {
  dknPage.rule = await browser.runtime.sendMessage({
    type: "getComputedRule",
    url: window.location.href
  });

  dknPage.setEnabled(dknPage.rule.level >= 5);

  // Unhide content now that styles are loaded. Do not register this stylesheet
  // (or the page would disappear when the user turns dark mode off).
  dknPage.addStyleSheet(dknPage.createCssLink("unhide"), false);

  // Handle messages from the popup.
  browser.runtime.onMessage.addListener(dknPage.messageHandler);
}

dknPage.main();
