"use strict";

const dknBackground = {};

dknBackground.onRejected = function(error) {
  return {
    success: false,
    error: String(error)
  };
}

dknBackground.messageHandler = function(message, sender, sendResponse) {
  switch (message.type) {
    case "getConfigString":
      return dknConfig.configSource.getConfigString()
        .then((configString) => ({configString, success: true}))
        .catch(dknBackground.onRejected);
    case "setConfigString":
      return dknConfig.configSource.setConfigString(message.configString)
        .then((config) => ({success: true}))
        .catch(dknBackground.onRejected);
    case "getComputedRule":
      return dknConfig.getProcessedRule(message.url);
  }
}

dknBackground.main = async function() {
  await dknConfig.init();
  browser.runtime.onMessage.addListener(dknBackground.messageHandler);
}

dknBackground.main();
