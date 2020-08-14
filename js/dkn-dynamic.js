// Functions which, given an element, return an array of CSS rules which should
// be applied to that element.
const dknDynamic = {};

/**
 * Apply a black background to an element.
 */
dknDynamic.blackBg = function(element, computedStyle) {
  switch (dknUtil.imageType(computedStyle.backgroundImage)) {
    case "image":
      const imageAlpha = dknUtil.getOrDefault(computedStyle,
          "--dkn-blackbg-preserve-image-alpha", "true");
      if (imageAlpha === "true") {
        // Preserve any transparency in the original image by not setting the
        // background color.
        return [];
      }
      break;
    case "gradient":
      // Use background instead of background-image to override the gradient.
      return ["background: rgb(0, 0, 0) !important;"];
    case "none":
      const bgAlpha = dknUtil.getOrDefault(computedStyle,
          "--dkn-blackbg-preserve-color-alpha", "true");
      if (bgAlpha !== "ignore") {
        // Set the color to black, but preserve the original alpha value.
        const color = dknUtil.parseColor(computedStyle.backgroundColor);
        return [`background-color: rgba(0, 0, 0, ${color[3]}) !important;`];
      }
      break;
  }

  return ["background-color: rgb(0, 0, 0) !important;"];
}

/**
 * Brighten text while preserving its hue.
 */
dknDynamic.brightText = function(element, computedStyle) {
  let color = computedStyle.color;
  if (!color) return;
  color = dknUtil.parseColor(color);

  let brightenedColor = dknUtil.brightenColor(color);
  if (color == brightenedColor) return [];

  brightenedColor = dknUtil.formatColor(brightenedColor);
  return [`color: ${brightenedColor} !important;`];
}

// Utility functions.
const dknUtil = {};

/**
 * Return a custom property value, or the default value if not specified.
 */
dknUtil.getOrDefault = function(style, key, defaultValue) {
  const value = style.getPropertyValue(key);
  return value === "" ? defaultValue : value;
}

/**
 * Return whether the given property value represents an image ("image"), a
 * gradient ("gradient"), or none ("none").
 */
dknUtil.imageType = function(image) {
  if (image === "none") return "none";
  if (/[-a-z]+-gradient\(/.test(image)) return "gradient";
  return "image";
}

// Map color strings to RGBA arrays.
dknUtil.parseColorCache = {};

/**
 * Parse a rgb() or rgba() color string into an array of four integers.
 */
dknUtil.parseColor = function(text) {
  let rgba = dknUtil.parseColorCache[text];
  if (rgba !== undefined) return rgba;

  if (text.charAt(3) == 'a') {
    // Parse rgba().
    const result = /(\d+)\D+(\d+)\D+(\d+)\D+(\d+)/.exec(text);
    rgba = [
      parseInt(result[1]),
      parseInt(result[2]),
      parseInt(result[3]),
      parseInt(result[4])
    ];
  } else {
    // Parse rgb().
    const result = /(\d+)\D+(\d+)\D+(\d+)/.exec(text);
    rgba = [
      parseInt(result[1]),
      parseInt(result[2]),
      parseInt(result[3]),
      255
    ];
  }

  dknUtil.parseColorCache[text] = rgba;
  return rgba;
}

/**
 * Given an array [r, g, b, a], increase the brightness as much as possible
 * without desaturating the color.
 */
dknUtil.brightenColor = function(rgba) {
  const boost = 255 - Math.max(rgba[0], rgba[1], rgba[2]);
  if (boost == 0) return rgba;
  return [rgba[0] + boost, rgba[1] + boost, rgba[2] + boost, rgba[3]];
}

/**
 * Format an RGBA array as a string "rgba(...)".
 */
dknUtil.formatColor = function(rgba) {
  return `rgba(${rgba[0]}, ${rgba[1]}, ${rgba[2]}, ${rgba[3]})`;
}
