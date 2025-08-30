export const STATUS_CODE = {
  // Success
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  
  // Client errors
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  
  // Server errors
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504
};

export const STATUS_MESSAGE = {
  // Success
  SUCCESS: 'success',
  CREATED: 'created',
  ACCEPTED: 'accepted',
  NO_CONTENT: 'no_content',
  
  // Client errors
  BAD_REQUEST: 'bad_request',
  UNAUTHORIZED: 'unauthorized',
  FORBIDDEN: 'forbidden',
  NOT_FOUND: 'not_found',
  CONFLICT: 'conflict',
  UNPROCESSABLE_ENTITY: 'unprocessable_entity',
  TOO_MANY_REQUESTS: 'too_many_requests',
  
  // Server errors
  INTERNAL_SERVER_ERROR: 'internal_server_error',
  NOT_IMPLEMENTED: 'not_implemented',
  BAD_GATEWAY: 'bad_gateway',
  SERVICE_UNAVAILABLE: 'service_unavailable',
  GATEWAY_TIMEOUT: 'gateway_timeout'
};