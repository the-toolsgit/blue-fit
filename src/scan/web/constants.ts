// Shared by the scan worker and the main thread (kept apart so the main bundle doesn't pull in the worker).
export const SCANNER_ID = "web-camera";
export const SCANNER_VERSION = "1";
/** Size of the masks the fit uses (portrait 3:4). */
export const FIT_W = 480, FIT_H = 640;
