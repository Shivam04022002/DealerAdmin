// utils/logger.js
// lightweight logger for autoMerge and other services

export default {
  info: (...args) => console.log("[INFO]", ...args),
  // debug is silenced in production so it can be left in place safely
  debug: (...args) => {
    if (process.env.NODE_ENV !== "production") console.log("[DEBUG]", ...args);
  },
  error: (...args) => console.error("[ERROR]", ...args),
};
