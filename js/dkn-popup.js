"use strict";

const dknPopup = {};

/**
 * Wrapper function for the "enabled" message. Optionally set the enabled state,
 * and update the checkbox to match the enabled state.
 */
dknPopup.enabled = async function(value) {
  let enabled = false;
  try {
    enabled = await browser.tabs.sendMessage(
        dknPopup.activeTab.id, {type: "enabled", value: value});
  } catch (error) {
    // The content script is not running, probably because plugins are disabled
    // on this page.
    dknPopup.enabledCheckbox.disabled = true;
  }
  dknPopup.enabledCheckbox.checked = enabled;
}

dknPopup.main = async function() {
  // Get the active tab.
  const tabs = await browser.tabs.query({active: true, currentWindow: true});
  dknPopup.activeTab = tabs[0];

  // Open the Options page in a new tab.
  document.getElementById("open-options-page").onclick = function() {
    browser.tabs.create({url: "/options.html"});
  };

  dknPopup.enabledCheckbox = document.getElementById("enabled");

  // Initialize the checkbox.
  dknPopup.enabled(null);

  // When the checkbox is clicked, toggle custom CSS in the active tab.
  dknPopup.enabledCheckbox.addEventListener("input", e => {
    dknPopup.enabled(Boolean(e.target.checked));
  });
}

dknPopup.main();
