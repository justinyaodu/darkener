"use strict";

const dknConfig = {};

/**
 * Load the configuration from local storage.
 */
dknConfig.loadConfig = async function() {
  await dknConfig.loadConfigString();
  dknConfig.config = JSON.parse(dknConfig.configString);
}

/**
 * Load the configuration from local storage as a JSON string.
 */
dknConfig.loadConfigString = async function() {
  dknConfig.configString = (await browser.storage.local.get("config")).config;

  if (dknConfig.configString === undefined) {
    // Use the default configuration.
    dknConfig.configString = await
        window.fetch(browser.runtime.getURL("config/default.json"))
          .then((response) => response.text());
  }
}

/**
 * Save the configuration to local storage as a JSON string. Throws an exception
 * if the configuration string is invalid.
 */
dknConfig.saveConfigString = function(config) {
  dknConfig.validateConfigString(config);
  browser.storage.local.set({config: config})
    .then(() => dknConfig.loadConfig());
}

/**
 * Validate a JSON string specifying the style rules, throwing an appropriate
 * exception on failure.
 */
dknConfig.validateConfigString = function(configString) {
  const config = JSON.parse(configString);

  try {
    dknConfig.validateObject(config,
      {
        macros: macros => dknConfig.validateMacros(macros),
        templates: templates => dknConfig.validateTemplates(templates),
        rules: rules => dknConfig.validateRules(rules)
      },
      ["macros", "templates", "rules"]
    );
  } catch (error) {
    throw 'config' + error;
  }
}

// Parse manifest.json to get the names of the static styles.
window.fetch(browser.runtime.getURL("manifest.json"))
  .then((response) => response.json())
  .then((manifest) => {
    dknConfig.staticStyles = [null];
    for (const cssPath of manifest.web_accessible_resources) {
      // Add all CSS file names.
      const match = /^css\/(.*)\.css$/.exec(cssPath);
      if (match !== null) {
        dknConfig.staticStyles.push(match[1]);
      }
    }
  });

// Get the names of the available dynamic style functions.
dknConfig.dynamicStyles = [null].concat(Object.keys(dknDynamic));

/**
 * Validate each key of an object, given a dictionary which maps key names to
 * validation functions.
 */
dknConfig.validateObject = function(obj, validators, required = []) {
  if (typeof obj !== "object" || Array.isArray(obj))
    throw ": must be an object.";

  for (const key of required) {
    if (obj[key] === undefined)
      throw `: missing required key "${key}".`
  }

  for (const key of Object.getOwnPropertyNames(obj)) {
    const validator = validators[key];

    if (validator === undefined)
      throw `: invalid key name "${key}". Valid key names are: `
          + dknConfig.prettyArray(Object.getOwnPropertyNames(validators));

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
dknConfig.validateArray = function(arr, validator) {
  if (!Array.isArray(arr))
    throw `: must be an array.`;

  for (let i = 0; i < arr.length; i++) {
    try {
      validator(arr[i]);
    } catch (error) {
      throw `[${i}]` + error;
    }
  }
}

/**
 * Throw an exception if the array contains non-string elements.
 */
dknConfig.validateStringArray = function(arr) {
  dknConfig.validateArray(arr, s => {
    if (typeof s !== "string")
      throw ": must be a string.";
  });
}

/**
 * Validate a rule object.
 */
dknConfig.validateRule = function(rule) {
  dknConfig.validateObject(rule,
    {
      comment:       comment => {},
      regex:         dknConfig.validateRegex,
      customStyles:  dknConfig.validateCustomStyles,
      dynamicStyles: dknConfig.validateDynamicStyles,
      staticStyles:  dknConfig.validateStaticStyles,
      enabled:       dknConfig.validateEnabled,
      macros:        dknConfig.validateMacros,
      templates:     dknConfig.validateTemplates,
      rules:         dknConfig.validateRules
    },
    ["regex"]
  );
}

/**
 * Validate an array of rule objects.
 */
dknConfig.validateRules = function(rules) {
  dknConfig.validateArray(rules, dknConfig.validateRule);
}

dknConfig.validateRegex = function(regex) {
  try {
    switch (typeof regex) {
      case "string":
        break;
      case "undefined":
        throw "not defined.";
      default:
        throw "must be a string.";
    }

    // Make sure that the regular expression is valid.
    RegExp(regex);
  } catch (error) {
    throw ": " + error;
  }
}

dknConfig.validateCustomStyle = function(customStyle) {
  if (customStyle === null || typeof customStyle === "string")
    return;
  else
    throw ": must be a string or null.";
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
 * Throw an exception if the enabled flag is invalid.
 */
dknConfig.validateEnabled = function(rule) {
  switch (typeof rule.enabled) {
    case "undefined":
    case "boolean":
      break;
    default:
      throw ": must be a boolean.";
  }
}

dknConfig.validateMacros = function(macros) {
  dknConfig.validateArray(macros, dknConfig.validateMacro);
}

dknConfig.validateMacro = function(macro) {
  dknConfig.validateStringArray(macro);

  if (macro.length < 2)
    throw ": must contain at least 2 elements.";

  if (macro[0].length == 0)
    throw ": macro name must not be empty.";
}

dknConfig.validateTemplate = function(template) {
  dknConfig.validateStringArray(template);

  if (template.length < 2)
    throw ": must contain at least 2 elements.";

  if (template[0].length == 0)
    throw ": function name must not be empty.";
}

dknConfig.validateTemplates = function(templates) {
  dknConfig.validateArray(templates, dknConfig.validateTemplate);
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
dknConfig.expand = function(value, macros, templates) {
  if (typeof value === "string") {
    return dknConfig.expandMacros(text, macros);
  } else if (Array.isArray(value)) {
    const templateName = value[0];
    const template = templates[templateName];

    if (template === undefined) {
      throw `[0]: template '${templateName}' is not defined.`;
    }

    const args = [];

    for (let i = 1; i < value.length; i++) {
      try {
        args.push(dknConfig.expand(value[i], macros, templates));
      } catch (error) {
        throw `[${i}]` + error;
      }
    }

    return dknConfig.expandTemplate(template, args);
  } else {
    throw `: must be a string or an array.`;
  }
}

/**
 * Given a website URL, return the computed rule from matching all rules against
 * it. Nested rules override their parents.
 */
dknConfig.getComputedRule = async function(url) {
  const computedRule = {
    enabled: true,
    customStyles: [],
    dynamicStyles: [],
    staticStyles: [],
    macros: [].concat(dknConfig.config.macros),
    templates: [].concat(dknConfig.config.templates)
  };

  dknConfig.mergeRulesRecursive(computedRule, dknConfig.config.rules, url);

  // Perform function expansion on custom styles.
  for (const template of computedRule.templates.reverse()) {
    const templateName = template[0];
    const templateExpand = template[1];
    for (let i = 0; i < computedRule.customStyles.length; i++) {
      const customStyle = computedRule.customStyles[i];
      if (customStyle.startsWith(templateName)
          && customStyle[templateName.length] === '('
          && customStyle[customStyle.length - 1] === ')') {
        computedRule.customStyles[i] = templateExpand.replaceAll("ARG_1",
            customStyle.substring(templateName.length + 1, customStyle.length - 1));
      }
    }
  }

  // Perform macro expansion on custom styles.
  for (const macro of computedRule.macros.reverse()) {
    for (let i = 0; i < computedRule.customStyles.length; i++) {
      computedRule.customStyles[i] =
          computedRule.customStyles[i].replaceAll(macro[0], macro[1]);
    }
  }

  delete computedRule.templates;
  delete computedRule.macros;

  return computedRule;
}

/**
 * Apply the first matching rule of the rules array to the computed rule.
 */
dknConfig.mergeRulesRecursive = function(computedRule, rules, url) {
  if (rules === undefined) return;

  for (const rule of rules) {
    if (RegExp(rule.regex).test(url)) {
      dknConfig.mergeRules(computedRule, rule);
      dknConfig.mergeRulesRecursive(computedRule, rule.rules, url);
      return;
    }
  }
}

/**
 * Merge properties from a matching rule into the computed rule.
 */
dknConfig.mergeRules = function(computedRule, rule) {
  for (const property of Object.keys(rule)) {
    switch (property) {
      case "customStyles":
      case "dynamicStyles":
      case "staticStyles":
      case "macros":
      case "templates":
        let values = rule[property];
        for (const value of values) {
          if (value === null) {
            computedRule[property] = [];
          } else {
            computedRule[property].push(value);
          }
        }
        break;

      case "enabled":
        computedRule[property] = rule[property];
        break;
    }
  }
}
