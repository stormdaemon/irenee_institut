const SAFE_COURSE_STYLE_RULES: Record<string, RegExp> = {
  border: /^[#(),.%\-\w\s]+$/,
  "border-bottom": /^[#(),.%\-\w\s]+$/,
  "border-left": /^[#(),.%\-\w\s]+$/,
  "border-radius": /^[.\d]+(?:px|rem|em|%)$/,
  "font-style": /^(?:italic|normal)$/,
  "font-weight": /^(?:normal|bold|[1-9]00)$/,
  margin: /^[.\d\s-]+(?:px|rem|em|%)?(?:\s+[.\d-]+(?:px|rem|em|%)?){0,3}$/,
  "margin-bottom": /^[.\d-]+(?:px|rem|em|%)$/,
  "margin-top": /^[.\d-]+(?:px|rem|em|%)$/,
  padding: /^[.\d\s-]+(?:px|rem|em|%)?(?:\s+[.\d-]+(?:px|rem|em|%)?){0,3}$/,
  "text-align": /^(?:left|right|center|justify)$/,
  "text-decoration": /^(?:none|underline|line-through)$/,
};

const SAFE_COURSE_CLASSES = new Set([
  "biblical-quote",
  "comparison-table",
  "course-block",
  "course-callout",
  "course-callout-info",
  "course-callout-warning",
  "course-quote",
  "definition-box",
  "example-box",
  "note-box",
  "quote-box",
  "styled-list",
  "success-box",
  "warning-box",
]);

function lengthsAreBounded(property: string, value: string) {
  const limits: Record<string, number> = property.startsWith("border")
    ? { px: 32, rem: 2, em: 2, "%": 100 }
    : { px: 160, rem: 10, em: 10, "%": 100 };
  const spacing = new Set(["margin", "margin-bottom", "margin-top", "padding", "border-radius"]);

  if (spacing.has(property)) {
    return value.split(/\s+/).every(token => {
      const match = token.match(/^(-?(?:\d+(?:\.\d+)?|\.\d+))(px|rem|em|%)?$/);
      if (!match) return false;
      const amount = Math.abs(Number(match[1]));
      const unit = match[2] || "";
      return Number.isFinite(amount) && (unit ? amount <= (limits[unit] ?? 0) : amount === 0);
    });
  }

  if (property.startsWith("border")) {
    if (/(?:\d|\.)e[+-]?\d/i.test(value) || /\b(?:calc|clamp|max|min|var|url|expression)\s*\(/i.test(value)) return false;
    let invalidColorFunction = false;
    const withoutColorFunctions = value.replace(/\b(?:rgb|rgba|hsl|hsla)\(([^()]*)\)/gi, (_match, body: string) => {
      if (body.length > 80 || !/^[\d\s.,%+-]+$/.test(body)) invalidColorFunction = true;
      return " coursecolor ";
    });
    if (invalidColorFunction || /[()]/.test(withoutColorFunctions)) return false;

    const widths = new Set(["thin", "medium", "thick"]);
    const styles = new Set(["none", "hidden", "dotted", "dashed", "solid", "double", "groove", "ridge", "inset", "outset"]);
    let widthCount = 0;
    let styleCount = 0;
    let colorCount = 0;
    for (const token of withoutColorFunctions.trim().split(/\s+/).filter(Boolean)) {
      const length = token.match(/^(\d+(?:\.\d+)?|\.\d+)(px|rem|em|%)$/i);
      if (length) {
        widthCount += 1;
        if (Number(length[1]) > (limits[length[2].toLowerCase()] ?? 0)) return false;
        continue;
      }
      if (token === "0" || widths.has(token)) {
        widthCount += 1;
        continue;
      }
      if (styles.has(token)) {
        styleCount += 1;
        continue;
      }
      if (token === "coursecolor" || /^#[\da-f]{3,8}$/i.test(token) || /^[a-z]+$/i.test(token)) {
        colorCount += 1;
        continue;
      }
      return false;
    }
    return widthCount <= 1 && styleCount <= 1 && colorCount <= 1;
  }
  return true;
}

/** Keeps only the presentation subset accepted by the course API. */
export function sanitizeCourseStyleAttribute(value: string) {
  if (!value || value.length > 2_048 || /[\u0000-\u001f\u007f]/.test(value)) return "";

  const declarations: string[] = [];
  for (const declaration of value.split(";")) {
    const separator = declaration.indexOf(":");
    if (separator <= 0) continue;
    const property = declaration.slice(0, separator).trim().toLowerCase();
    const rawValue = declaration.slice(separator + 1).trim().toLowerCase();
    const rule = SAFE_COURSE_STYLE_RULES[property];
    if (!rule || !rawValue || /(?:!important|expression|url\s*\(|var\s*\()/i.test(rawValue) || !rule.test(rawValue) || !lengthsAreBounded(property, rawValue)) continue;
    declarations.push(`${property}: ${rawValue}`);
  }
  return declarations.join("; ");
}

/** Prevents authored HTML from borrowing application-level layout classes. */
export function sanitizeCourseClassAttribute(value: string) {
  return Array.from(new Set(value.split(/\s+/).filter(className => SAFE_COURSE_CLASSES.has(className)))).join(" ");
}
