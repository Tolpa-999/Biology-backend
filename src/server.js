import app from "./app.js";
import  env  from "./config/index.js";
import logger from "./utils/logger.js";

app.listen(env.PORT, () => {
  console.log(`server running at ${env.PORT}`)
  logger.info(`Server running on port ${env.PORT}`);
});
