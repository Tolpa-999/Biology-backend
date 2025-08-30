// import { verifyAccessToken } from "../../utils/jwt.js";

// function verifyWebhook(req, res, next) {
//   const token = req.headers["x-webhook-token"];
//   if (!token) return res.status(401).json({ message: "No webhook token provided" });

//   try {
//     verifyAccessToken(token);
//     next();
//   } catch (err) {
//     res.status(401).json({ message: "Invalid webhook token" });
//   }
// }

// export default verifyWebhook;
