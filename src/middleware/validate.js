// src/middleware/validate.js
import Joi from "joi";

function validateMiddleware(schema, property = "body", pass = false) {
  return (req, res, next) => {
    // If body/query/params is missing, reject immediately
    if (!req[property] || Object.keys(req[property]).length === 0) {
      if(!pass) {
        return res.status(400).json({
        field: property,
        message: `${property} cannot be empty`,
      });
      } else {
        console.log("pass the validator")
        return next()
      }
    }

    
    const { error } = schema.validate(req[property], {
      abortEarly: true,
      allowUnknown: false, // do not allow fields not in schema
    });
    
    if (!error) {
      return next();
    }
    
    const detail = error.details[0];
    const field = detail.context?.key || "unknown";
    
    let message = detail.message;
    
    if (detail.type === "object.unknown") {
      message = `Field "${field}" is not allowed`;
    }
    
    console.log("pass from validator")
    
    console.log("pass the validator 22222")
    return res.status(400).json({
      field,
      message,
    });
  };
}

export default validateMiddleware;
