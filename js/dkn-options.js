"use strict";

const dknOptions = {};

dknOptions.editArea      = document.getElementById("edit-area");
dknOptions.statusMessage = document.getElementById("status-message");
dknOptions.cursorPos     = document.getElementById("cursor-pos");
dknOptions.saveButton    = document.getElementById("save");

/**
 * Set the status message text and color from the background script reply.
 */
dknOptions.setStatus = function(text, isError) {
  dknOptions.statusMessage.textContent = text;

  if (isError) {
    dknOptions.statusMessage.classList.add("status-error");
  } else {
    dknOptions.statusMessage.classList.remove("status-error");
  }
}

/**
 * Update the displayed cursor position.
 */
dknOptions.updateCursorPos = function() {
  // Without this delay, the cursor position would sometimes fail to update.
  setTimeout(() => {
    const cursorIndex = (dknOptions.editArea.selectionDirection === "forward"
        ? dknOptions.editArea.selectionEnd
        : dknOptions.editArea.selectionStart);

    let line = 1;
    let col = 1;

    for (let i = 0; i < cursorIndex; i++) {
      if (dknOptions.editArea.value.charAt(i) == '\n') {
        line++;
        col = 1;
      } else {
        col++;
      }
    }

    dknOptions.cursorPos.textContent = `${line},${col}`;
  }, 5);
}

dknOptions.main = function() {
  // Load the user's rules into the JSON editing area.
  browser.runtime.sendMessage({type: "getConfigString"})
    .then((reply) => {
      if (reply.success) {
        dknOptions.editArea.value = reply.configString;
        dknOptions.setStatus("Configuration loaded.", false);
      } else {
        dknOptions.setStatus("Failed to load configuration: " + reply.error,
            true);
      }
    });

  // Save the user's rules when the Save button is clicked.
  dknOptions.saveButton.onclick = function() {
    browser.runtime.sendMessage(
        {type: "setConfigString", configString: dknOptions.editArea.value})
      .then((reply) => {
        if (reply.success) {
          dknOptions.setStatus("Configuration saved.", false);
        } else {
          dknOptions.setStatus(reply.error, true);
        }
      });
  };

  // Update the cursor position when a key is pressed or the mouse is clicked in
  // the JSON editing area.
  dknOptions.editArea.addEventListener("keydown", dknOptions.updateCursorPos);
  dknOptions.editArea.addEventListener("click", dknOptions.updateCursorPos);
}

dknOptions.main();
