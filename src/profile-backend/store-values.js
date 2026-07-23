// Store values shared by Worker-safe services and adapter implementations.
// Keeping these constants separate avoids importing the memory adapter's
// AsyncLocalStorage implementation into a Worker bundle.
export const PROFILE_VISIBILITY = Object.freeze({
  PRIVATE: "private",
  PUBLIC: "public"
});

export const PROFILE_BACKEND_STORE_SCHEMA_VERSION = 1;
