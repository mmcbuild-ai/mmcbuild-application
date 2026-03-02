/**
 * Public API for the model registry + router.
 */

export { MODEL_REGISTRY, getModel, getModelOrThrow, getAvailableModels } from "./registry";
export type { ModelDefinition, AIFunction, AIProvider, QualityTier, ModelCapability } from "./registry";
export { route, callModel } from "./router";
export type { ChatMessage, ModelCallOptions, ModelCallResult, ToolDefinition, ToolUseBlock } from "./call";
export { trackUsage } from "./tracker";
