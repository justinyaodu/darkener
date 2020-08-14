"use strict";

const dknBackground = {};

dknBackground.messageHandler = function(message, sender, sendResponse) {
  switch (message.type) {

    case "getConfigString":
      return Promise.resolve({
        success: true,
        message: "Configuration loaded.",
        data: dknConfig.configString
      });
      break;

    case "setConfigString":
      if (message.data === undefined) {
        return Promise.resolve({
          success: false,
          message: "Could not save configuration: no data provided."
        });
      } else {
        try {
          dknConfig.saveConfigString(message.data);
        } catch (error) {
          return Promise.resolve({
            success: false,
            message: String(error)
          });
        }
        return Promise.resolve({
          success: true,
          message: "Configuration saved."
        });
      }
      break;

    case "getComputedRule":
      return dknConfig.getComputedRule(message.data)
          .then(rule => ({
            success: true,
            data: rule
          }));
      break;
  }
}

dknBackground.main = async function() {
  await dknConfig.loadConfig();
  browser.runtime.onMessage.addListener(dknBackground.messageHandler);
}

dknBackground.main();
