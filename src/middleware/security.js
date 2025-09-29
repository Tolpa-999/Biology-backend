// src/middleware/security.js
import helmet from "helmet";
import cors from "cors";
import compression from "compression";

const securityMiddleware = [
  helmet({


    // contentSecurityPolicy: {
    //   directives: {
    //     defaultSrc: ["'self'"],          // Only your domain
    //     scriptSrc: ["'self'"],           // No inline JS
    //     styleSrc: ["'self'", "https:"],  // Allow HTTPS styles (e.g. fonts, CDN CSS)
    //     imgSrc: ["'self'", "data:", "https:"], // Allow images
    //     objectSrc: ["'none'"],           // Block Flash, plugins
    //     frameAncestors: ["'none'"],      // Prevent clickjacking
    //     baseUri: ["'self'"],             // Disallow base tag injection
    //     formAction: ["'self'"],          // Forms only submit back to self
    //     upgradeInsecureRequests: [],     // Force HTTPS
    //   },
    // },
    // crossOriginEmbedderPolicy: true, // Needed for secure uploads
    // crossOriginResourcePolicy: { policy: "same-origin" },
    // frameguard: { action: "deny" },  // Extra clickjacking protection
    // referrerPolicy: { policy: "no-referrer" }, // Hide referrer info
  

  }),
  compression(),
];

export default securityMiddleware;
