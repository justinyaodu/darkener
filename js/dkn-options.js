"use strict";

const dknOptions = {};

dknOptions.editArea      = document.getElementById("edit-area");
dknOptions.statusMessage = document.getElementById("status-message");
dknOptions.cursorPos     = document.getElementById("cursor-pos");
dknOptions.saveButton    = document.getElementById("save");

/**
 * Set the status message text and color from the background script reply.
 */
dknOptions.setStatus = function(reply) {
  dknOptions.statusMessage.textContent = reply.message;
  if (reply.success) {
    dknOptions.statusMessage.classList.remove("status-error");
    dknOptions.statusMessage.classList.add("status-success");
  } else {
    dknOptions.statusMessage.classList.remove("status-success");
    dknOptions.statusMessage.classList.add("status-error");
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
    dknOptions.cursorPos.textContent = `${line},${col}`
  }, 5);
}

dknOptions.main = function() {
  // Load the user's rules into the JSON editing area.
  browser.runtime.sendMessage({type: "getConfigString"})
      .then(reply => {
        dknOptions.editArea.value = reply.data;
        dknOptions.setStatus(reply);
      });

  // Save the user's rules when the Save button is clicked.
  dknOptions.saveButton.onclick = function() {
    browser.runtime.sendMessage(
        {type: "setConfigString", data: dknOptions.editArea.value})
        .then(reply => dknOptions.setStatus(reply));
  };

  // Update the cursor position when a key is pressed or the mouse is clicked in
  // the JSON editing area.
  dknOptions.editArea.addEventListener("keydown",
      dknOptions.updateCursorPos);
  dknOptions.editArea.addEventListener("click",
      dknOptions.updateCursorPos);
}

dknOptions.main();
