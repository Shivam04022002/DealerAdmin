// utils/logger.js
// lightweight logger for autoMerge and other services

export default {
  info: (...args) => console.log("[INFO]", ...args),
  debug: (...args) => console.log("[DEBUG]", ...args),
  error: (...args) => console.error("[ERROR]", ...args),
};
