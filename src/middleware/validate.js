// src/middleware/validate.js
import Joi from "joi";

function validateMiddleware(schema) {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: true });

    if (!error) {
      return next();
    }

    // Always pick the first error only
    const detail = error.details[0];
    const field = detail.context?.key || "unknown";

    let message = detail.message;

    // Custom handling for unknown fields
    if (detail.type === "object.unknown") {
      message = `Field "${field}" is not allowed`;
    }

    return res.status(400).json({
      field,
      message,
    });
  };
}

export default validateMiddleware;
