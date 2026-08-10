/**
 * Configuration constants for the sub-bar extension
 */

/**
 * Google Workspace status API endpoint
 */
export const GOOGLE_STATUS_URL = "https://www.google.com/appsstatus/dashboard/incidents.json";

/**
 * Google product ID for Gemini in the status API
 */
export const GEMINI_PRODUCT_ID = "npdyhgECDJ6tB66MxXyo";

/**
 * Model multipliers for Copilot request counting
 * Maps model display names to their request multiplier
 */
export { MODEL_MULTIPLIERS } from "@eiei114/pi-sub-shared";

/**
 * Timeout for API requests in milliseconds
 */
export const API_TIMEOUT_MS = 5000;

/**
 * OpenRouter credits endpoint
 */
export const OPENROUTER_CREDITS_URL = "https://openrouter.ai/api/v1/credits";

/**
 * Timeout for CLI commands in milliseconds
 */
export const CLI_TIMEOUT_MS = 10000;

/**
 * Interval for automatic usage refresh in milliseconds
 */
export const REFRESH_INTERVAL_MS = 60_000;

