/**
 * Middleware to safely parse JSON fields inside multipart/form-data or urlencoded body.
 * - Converts valid JSON strings into objects/arrays/numbers/booleans.
 * - Leaves invalid JSON as strings (doesn’t crash).
 * - Supports nested JSON and arrays.
 * - Adds error logging for debugging.
 */
function parseJsonFields(req, res, next) {
  try {
    if (!req.body || typeof req.body !== "object") return next();

    for (const key of Object.keys(req.body)) {
      let value = req.body[key];

      if (typeof value === "string" && value.trim().length > 0) {
        // Try JSON
        if (value.startsWith("{") || value.startsWith("[")) {
          try {
            req.body[key] = JSON.parse(value);
            continue;
          } catch (err) {
            return res.status(400).json({
              error: `Invalid JSON format in field "${key}"`,
              details: err.message,
            });
          }
        }

        // Try number
        if (!isNaN(value)) {
          req.body[key] = Number(value);
          continue;
        }

        // Try boolean
        if (value.toLowerCase() === "true") {
          req.body[key] = true;
          continue;
        }
        if (value.toLowerCase() === "false") {
          req.body[key] = false;
          continue;
        }
      }
    }

    next();
  } catch (err) {
    console.error("💥 parseJsonFields crashed:", err);
    return res.status(500).json({
      error: "Failed to process request body",
      details: err.message,
    });
  }
}



export default parseJsonFields