"use strict";

const dknConfig = {};

/**
 * Base class for configuration sources.
 */
dknConfig.ConfigSource = class {
  /**
   * Return a Promise resolving to the cached config string.
   */
  async getConfigString() {
    if (this.configString === undefined) {
      this.configString = await this.loadConfigString();
    }

    return this.configString;
  }

  /**
   * Return a Promise resolving to the stored config string.
   */
  async loadConfigString() {
    return "{}";
  }

  /**
   * Return a Promise resolving to the processed configuration.
   */
  async getConfig() {
    if (this.config !== undefined) {
      return this.config;
    } else if (this.configError !== undefined) {
      throw this.configError;
    }

    try {
      const configString = await this.getConfigString();
      return this.config = dknConfig.parseConfigString(configString);
    } catch (error) {
      throw this.configError = error;
    }
  }

  /**
   * Parse a config string, save it, and return the updated config. If the
   * given config string is invalid, the previous config is retained.
   */
  async setConfigString(configString) {
    const newConfig = dknConfig.parseConfigString(configString);

    this.saveConfigString(configString);

    this.config = newConfig;
    delete this.configError;

    return this.config;
  }

  /**
   * Return a Promise which is resolved when the configuration is saved.
   */
  async saveConfigString(configString) {
    throw new Error("This ConfigSource does not implement the save operation.");
  }
}

/**
 * Configuration source backed by a browser StorageArea.
 */
dknConfig.StorageConfigSource = class extends dknConfig.ConfigSource {
  constructor(storageArea) {
    super();
    this.storageArea = storageArea;
  }

  async loadConfigString() {
    const configString = (await this.storageArea.get("config")).config;

    if (configString === undefined) {
      throw new Error("No config available in storage area.");
    }

    return configString;
  }

  async saveConfigString(configString) {
    await this.storageArea.set({config: configString});
  }
}

/**
 * Configuration source backed by a JSON file.
 */
dknConfig.FileConfigSource = class extends dknConfig.ConfigSource {
  constructor(path) {
    super();
    this.path = path;
  }

  async loadConfigString() {
    return await window.fetch(browser.runtime.getURL(this.path))
      .then((response) => response.text());
  }
}

/**
 * Use the best of the available configuration sources.
 */
dknConfig.MultiConfigSource = class extends dknConfig.ConfigSource {
  constructor(...sources) {
    super();
    this.sources = sources;
  }

  async getConfig() {
    for (const source of this.sources) {
      try {
        return await source.getConfig();
      } catch (error) {
        // Try the next source.
      }
    }
  }

  async getConfigString() {
    for (const source of this.sources) {
      try {
        return await source.getConfigString();
      } catch (error) {
        // Try the next source.
      }
    }
  }

  async setConfigString(configString) {
    for (const source of this.sources) {
      try {
        await source.setConfigString(configString);
      } catch (error) {
        // Try the next source.
      }
    }
  }
}

dknConfig.configSource = new dknConfig.MultiConfigSource(
  new dknConfig.StorageConfigSource(browser.storage.local),
  new dknConfig.FileConfigSource("config/default.json"),
  // Shouldn't ever be used, unless the default config file is broken.
  new dknConfig.ConfigSource()
);

///**
// * Load the configuration from local storage.
// */
//dknConfig.loadConfig = async function() {
//  await dknConfig.loadConfigString();
//  dknConfig.config = dknConfig.processConfig(JSON.parse(dknConfig.configString));
//  // TODO
//}
//
///**
// * Load the configuration from local storage as a JSON string.
// */
//dknConfig.loadConfigString = async function() {
//  dknConfig.configString = (await browser.storage.local.get("config")).config;
//
//  if (dknConfig.configString === undefined) {
//    // Use the default configuration.
//    dknConfig.configString = await
//        window.fetch(browser.runtime.getURL("config/default.json"))
//          .then((response) => response.text());
//  }
//}
//
///**
// * Save the configuration to local storage as a JSON string. Throws an exception
// * if the configuration string is invalid.
// */
//dknConfig.saveConfigString = function(config) {
//  dknConfig.validateConfigString(config);
//  browser.storage.local.set({config: config})
//    .then(() => dknConfig.loadConfig());
//}
//
///**
// * Validate a JSON string specifying the style rules, throwing an appropriate
// * exception on failure.
// */
//dknConfig.validateConfigString = function(configString) {
//  const config = JSON.parse(configString);
//
//  try {
//    dknConfig.validateObject(config, {
//      macros: macros => dknConfig.validateMacros(macros),
//      templates: templates => dknConfig.validateTemplates(templates),
//      // rules: rules => dknConfig.validateRules(rules)
//    });
//  } catch (error) {
//    throw 'config' + error;
//  }
//}

dknConfig.parseConfigString = function(configString) {
  let parsed;
  try {
    parsed = JSON.parse(configString);
  } catch (error) {
    throw "JSON parsing failed. " + error;
  }

  try {
    return dknConfig.processRule(parsed, dknConfig.defaultRule);
  } catch (error) {
    throw "config" + error;
  }
}

/**
 * Create arrays containing the valid static and dynamic style names, to use
 * during config validation.
 */
dknConfig.loadStyleNames = async function() {
  const manifest = await window.fetch(browser.runtime.getURL("manifest.json"))
    .then((response) => response.json());

  dknConfig.staticStyles = [null];
  for (const cssPath of manifest.web_accessible_resources) {
    // Add all CSS file names.
    const match = /^css\/(.*)\.css$/.exec(cssPath);
    if (match !== null) {
      dknConfig.staticStyles.push(match[1]);
    }
  }

  dknConfig.dynamicStyles = [null].concat(Object.keys(dknDynamic));
}

//// Parse manifest.json to get the names of the static styles.
//window.fetch(browser.runtime.getURL("manifest.json"))
//  .then((response) => response.json())
//  .then((manifest) => {
//  });
//
//// Get the names of the available dynamic style functions.

/**
 * Validate each key of an object, given a dictionary which maps key names to
 * validation functions.
 */
dknConfig.validateObject = function(obj, validators, optional = []) {
  if (typeof obj !== "object" || Array.isArray(obj)) {
    throw ": must be an object.";
  }

  for (const key of Object.getOwnPropertyNames(validators)) {
    if (key.length > 0 && obj[key] === undefined && !optional.includes(key)) {
      throw `: missing key "${key}".`;
    }
  }

  for (const key of Object.getOwnPropertyNames(obj)) {
    let validator = validators[key];

    if (validator === undefined) {
      validator = validators[""];
    }

    if (validator === undefined) {
      throw `: invalid key name "${key}". Valid key names are: `
          + dknConfig.prettyArray(Object.getOwnPropertyNames(validators));
    }

    try {
      validator(obj[key]);
    } catch (error) {
      throw `.${key}` + error;
    }
  }
}

/**
 * Throw an exception if the object is not an array, or if any of its elements
 * do not pass the validation function.
 */
dknConfig.validateArray = function(arr, validator, minLength = undefined) {
  if (!Array.isArray(arr)) {
    throw `: must be an array.`;
  }

  if (minLength !== undefined && arr.length < minLength) {
    throw `: must have at least ${minLength} elements.`;
  }

  for (let i = 0; i < arr.length; i++) {
    try {
      validator(arr[i]);
    } catch (error) {
      throw `[${i}]` + error;
    }
  }
}

/**
 * Throw an exception if the argument is not a string.
 */
dknConfig.assertString = function(value) {
  if (typeof value !== "string") {
    throw `: must be a string.`;
  }
}

/**
 * Throw an exception if the argument is not a non-empty string.
 */
dknConfig.assertNonEmptyString = function(value) {
  dknConfig.assertString(value);

  if (value.length == 0) {
    throw ": string must not be empty.";
  }
}

//dknConfig.validateRegex = function(regex) {
//  try {
//    switch (typeof regex) {
//      case "string":
//        break;
//      case "undefined":
//        throw "not defined.";
//      default:
//        throw "must be a string.";
//    }
//
//    // Make sure that the regular expression is valid.
//    RegExp(regex);
//  } catch (error) {
//    throw ": " + error;
//  }
//}

dknConfig.validateCustomStyle = function(customStyle, topLevel = true) {
  if (typeof customStyle === "string") {
    return;
  } else if (customStyle === null) {
    if (topLevel) {
      return;
    } else {
      throw ": must be a string or an array.";
    }
  } else if (Array.isArray(customStyle)) {
    dknConfig.validateArray(customStyle,
        style => dknConfig.validateCustomStyle(style, false));
  } else {
    if (topLevel) {
      throw ": must be a string, an array, or null.";
    } else {
      throw ": must be a string or an array.";
    }
  }
}

dknConfig.validateCustomStyles = function(customStyles) {
  dknConfig.validateArray(customStyles, dknConfig.validateCustomStyle);
}

// Get the names of the available dynamic style functions.
dknConfig.dynamicStyles = [null].concat(Object.keys(dknDynamic));

dknConfig.validateDynamicStyle = function(dynamicStyle) {
  dknConfig.validateIncludes(dknConfig.dynamicStyles, dynamicStyle);
}

dknConfig.validateDynamicStyles = function(dynamicStyles) {
  dknConfig.validateArray(dynamicStyles, dknConfig.validateDynamicStyle);
}

// Parse manifest.json to get the names of the static styles.
window.fetch(browser.runtime.getURL("manifest.json"))
  .then((response) => response.json())
  .then((manifest) => {
    dknConfig.staticStyles = [null];

    for (const cssPath of manifest.web_accessible_resources) {
      // Add all CSS file names.
      const match = /^style\/(.*)\.css$/.exec(cssPath);

      if (match !== null) {
        dknConfig.staticStyles.push(match[1]);
      }
    }
  });

dknConfig.validateStaticStyle = function(staticStyle) {
  dknConfig.validateIncludes(dknConfig.staticStyles, staticStyle);
}

dknConfig.validateStaticStyles = function(staticStyles) {
  dknConfig.validateArray(staticStyles, dknConfig.validateStaticStyle);
}

dknConfig.validateIncludes = function(array, element) {
  if (!array.includes(element)) {
    throw `: invalid value "${String(element)}". Valid values are: `
        + dknConfig.prettyArray(array);
  }
}

/**
 * Nicely format an array containing strings and null values.
 */
dknConfig.prettyArray = function(array) {
  const strings = [];

  for (const element of array) {
    if (element === null) {
      strings.push("null");
    } else {
      strings.push(`"${element}"`);
    }
  }

  return strings.join(", ");
}

/**
 * Throw an exception if the argument is not a valid level value.
 */
dknConfig.validateLevel = function(level) {
  if (!Number.isInteger(level) || level < 1 || level > 9) {
    throw ": must be an integer between 1 and 9 inclusive.";
  }
}

dknConfig.validateMacros = function(macros) {
  dknConfig.validateArray(macros, dknConfig.validateMacro);
}

dknConfig.validateMacro = function(macro) {
  dknConfig.validateArray(macro, dknConfig.assertString, 2);

  if (macro[0].length == 0) {
    throw "[0]: macro name must not be empty.";
  }
}

dknConfig.validateTemplate = function(template) {
  dknConfig.validateObject(template,
      {
        template: dknConfig.assertString,
        comment: dknConfig.assertString,
      },
      ["comment"]);
}

dknConfig.validateTemplates = function(templates) {
  if (templates[""] !== undefined) {
    throw '[""]: template name must not be empty.';
  }

  dknConfig.validateObject(templates, {"": dknConfig.validateTemplate});
}

/**
 * Expand the macros in the provided text.
 */
dknConfig.expandMacros = function(text, macros) {
  for (let i = macros.length - 1; i >= 0; i--) {
    const name = macros[i][0];
    const value = macros[i][1];
    text = text.replaceAll(name, value);
  }

  return text;
}

/**
 * Expand a template using the provided arguments.
 */
dknConfig.expandTemplate = function(template, args) {
  const macros = [];

  for (let i = 0; i < args.length; i++) {
    macros.push([`ARG_${i + 1}`, args[i]]);
  }

  return dknConfig.expandMacros(template, macros);
}

/**
 * Recursively expand macros and templates.
 */
dknConfig.expandValue = function(value, macros, templates) {
  if (typeof value === "string") {
    return dknConfig.expandMacros(value, macros);
  } else if (Array.isArray(value)) {
    const templateName = value[0];
    const template = templates[templateName].template;

    if (template === undefined) {
      throw `[0]: template '${templateName}' is not defined.`;
    }

    const args = [];

    for (let i = 1; i < value.length; i++) {
      try {
        args.push(dknConfig.expandValue(value[i], macros, templates));
      } catch (error) {
        throw `[${i}]` + error;
      }
    }

    const templateExpanded = dknConfig.expandTemplate(template, args);
    return dknConfig.expandMacros(templateExpanded, macros);
  } else {
    throw `: must be a string or an array.`;
  }
}

dknConfig.defaultRule = {
  level: 5,
  macros: [],
  templates: {},
  staticStyles: [],
  dynamicStyles: [],
  customStyles: [],
  rules: [],
};

dknConfig.ruleValidators = {
  regex:         dknConfig.assertString,
  level:         dknConfig.validateLevel,
  comment:       dknConfig.assertString,
  macros:        dknConfig.validateMacros,
  templates:     dknConfig.validateTemplates,
  staticStyles:  dknConfig.validateStaticStyles,
  dynamicStyles: dknConfig.validateDynamicStyles,
  customStyles:  dknConfig.validateCustomStyles,
  rules:         rules => dknConfig.validateArray(rules, (rule) => {}),
};

dknConfig.ruleOptional = ["regex", "comment"];

/**
 * Validate a rule object.
 */
dknConfig.validateRule = function(rule) {
  dknConfig.validateObject(rule, dknConfig.ruleValidators,
      dknConfig.ruleOptional);
}

/**
 * Inherit properties from ancestor rules, then expand macros and templates
 * in this rule's custom styles. Return an array of one or more rules, which
 * will replace this rule in the parent's child list.
 */
dknConfig.processRule = function(rule, parentRule) {
  // Assign default values to undefined properties.
  rule = Object.assign(
    {},
    dknConfig.defaultRule,
    {level: parentRule.level},
    rule
  );

  dknConfig.validateRule(rule);

  // Inherit macros and templates.
  rule.macros = parentRule.macros.concat(rule.macros);
  rule.templates = Object.assign({}, parentRule.templates, rule.templates);

  // Inherit styles.
  for (const key of ["staticStyles", "dynamicStyles", "customStyles"]) {
    let arr = parentRule[key].slice();

    for (const element of rule[key]) {
      if (element === null) {
        arr = [];
      } else {
        arr.push(element);
      }
    }

    rule[key] = arr;
  }

  // Join successive comments with newlines.
  if (rule.comment !== undefined) {
    rule.comment = parentRule.comment + '\n' + rule.comment;
  } else {
    rule.comment = parentRule.comment;
  }

  // Expand macros and templates in custom styles.
  rule.customStyles = rule.customStyles.map(
    (style) => dknConfig.expandValue(style, rule.macros, rule.templates)
  );

  // Process all child rules.

  const newRules = [];

  for (let i = 0; i < rule.rules.length; i++) {
    const child = rule.rules[i];

    try {
      for (const newRule of dknConfig.processRule(child, rule)) {
        newRules.push(newRule);
      }
    } catch (error) {
      throw `[${i}]` + error;
    }
  }

  rule.rules = newRules;

  // Macro and template definitions no longer needed.
  delete rule.macros;
  delete rule.templates;

  if (rule.regex === undefined)
  {
    // This rule was only used to define attributes shared by child rules;
    // flatten the tree by returning this rule's children.
    return rule.rules;
  } else {
    // Compile the regular expression.
    try {
      rule.regex = RegExp(rule.regex);
    } catch (error) {
      throw ": " + error;
    }

    return [rule];
  }
}

/**
 * Return the processed rule matching an URL.
 */
dknConfig.getProcessedRule = async function(url, rule = null) {
  const rules = rule !== null
      ? rule.rules
      : await dknConfig.configSource.getConfig();

  for (const child of rules) {
    console.log(`Testing '${url}' with regex '${child.regex}'`); // TODO
    if (child.regex.test(url)) {
      return dknConfig.getProcessedRule(url, child);
    }
  }

  const toReturn = Object.assign({}, rule || dknConfig.defaultRule);
  delete toReturn.regex;
  return toReturn;
}

///**
// * Given a website URL, return the computed rule from matching all rules against
// * it. Nested rules override their parents.
// */
//dknConfig.getComputedRule = async function(url) {
//  const computedRule = {
//    enabled: true,
//    customStyles: [],
//    dynamicStyles: [],
//    staticStyles: [],
//    macros: [].concat(dknConfig.config.macros),
//    templates: [].concat(dknConfig.config.templates)
//  };
//
//  dknConfig.mergeRulesRecursive(computedRule, dknConfig.config.rules, url);
//
//  // Perform function expansion on custom styles.
//  for (const template of computedRule.templates.reverse()) {
//    const templateName = template[0];
//    const templateExpand = template[1];
//    for (let i = 0; i < computedRule.customStyles.length; i++) {
//      const customStyle = computedRule.customStyles[i];
//      if (customStyle.startsWith(templateName)
//          && customStyle[templateName.length] === '('
//          && customStyle[customStyle.length - 1] === ')') {
//        computedRule.customStyles[i] = templateExpand.replaceAll("ARG_1",
//            customStyle.substring(templateName.length + 1, customStyle.length - 1));
//      }
//    }
//  }
//
//  // Perform macro expansion on custom styles.
//  for (const macro of computedRule.macros.reverse()) {
//    for (let i = 0; i < computedRule.customStyles.length; i++) {
//      computedRule.customStyles[i] =
//          computedRule.customStyles[i].replaceAll(macro[0], macro[1]);
//    }
//  }
//
//  delete computedRule.templates;
//  delete computedRule.macros;
//
//  return computedRule;
//}
//
///**
// * Apply the first matching rule of the rules array to the computed rule.
// */
//dknConfig.mergeRulesRecursive = function(computedRule, rules, url) {
//  if (rules === undefined) return;
//
//  for (const rule of rules) {
//    if (RegExp(rule.regex).test(url)) {
//      dknConfig.mergeRules(computedRule, rule);
//      dknConfig.mergeRulesRecursive(computedRule, rule.rules, url);
//      return;
//    }
//  }
//}
//
///**
// * Merge properties from a matching rule into the computed rule.
// */
//dknConfig.mergeRules = function(computedRule, rule) {
//  for (const property of Object.keys(rule)) {
//    switch (property) {
//      case "customStyles":
//      case "dynamicStyles":
//      case "staticStyles":
//      case "macros":
//      case "templates":
//        let values = rule[property];
//        for (const value of values) {
//          if (value === null) {
//            computedRule[property] = [];
//          } else {
//            computedRule[property].push(value);
//          }
//        }
//        break;
//
//      case "enabled":
//        computedRule[property] = rule[property];
//        break;
//    }
//  }
//}

dknConfig.init = async function() {
  await dknConfig.loadStyleNames();
}
