import type { ComplexityTiers } from "./ComplexityRouterConfig";

/**
 * A complexity tier maps to `str | list[str] | object | list[object]` on the backend
 * (litellm/router_strategy/complexity_router/config.py: "string = pin; list = random pick"),
 * and the router widens the bare string with `models if isinstance(models, list) else [models]`.
 *
 * Every UI reader of a STORED complexity_router_config must widen the same way, so this is the
 * single owner of that rule. Readers of in-memory ComplexityTiers state are already string[]
 * and do not need it.
 */
export const normalizeTierModels = (value: unknown): string[] => {
  const entries = Array.isArray(value) ? value : [value];
  return entries.flatMap((entry) => {
    if (typeof entry === "string" && entry) return [entry];
    if (
      typeof entry === "object" &&
      entry !== null &&
      !Array.isArray(entry) &&
      typeof (entry as { model_name?: unknown }).model_name === "string"
    ) {
      return [(entry as { model_name: string }).model_name];
    }
    return [];
  });
};

export type TierModelParams = Record<string, unknown>;
export type SerializedTierModel = string | { model_name: string; litellm_params: TierModelParams };

export type TierModelParamsByTier = Partial<Record<keyof ComplexityTiers, Record<string, TierModelParams>>>;

export const extractTierModelParams = (value: unknown): Record<string, TierModelParams> => {
  const entries = Array.isArray(value) ? value : [value];
  return Object.fromEntries(
    entries.flatMap((entry) => {
      if (
        typeof entry !== "object" ||
        entry === null ||
        Array.isArray(entry) ||
        typeof (entry as { model_name?: unknown }).model_name !== "string"
      ) {
        return [];
      }
      const params = (entry as { litellm_params?: unknown }).litellm_params;
      if (typeof params !== "object" || params === null || Array.isArray(params)) return [];
      return [[(entry as { model_name: string }).model_name, params as TierModelParams] as const];
    }),
  );
};

export const serializeTierModels = (
  models: string[],
  paramsByModel: Record<string, TierModelParams> | undefined,
): SerializedTierModel[] => {
  const entries = models.map((model) => {
    const params = paramsByModel?.[model];
    return params && Object.keys(params).length > 0 ? { model_name: model, litellm_params: params } : model;
  });
  return entries;
};

export type SerializedTierConfig = Partial<Record<keyof ComplexityTiers, SerializedTierModel[]>>;

export const serializeTierConfig = (
  tiers: Partial<ComplexityTiers>,
  paramsByTier: TierModelParamsByTier | undefined,
): SerializedTierConfig =>
  Object.fromEntries(
    Object.entries(tiers).map(([tier, models]) => [
      tier,
      serializeTierModels(models ?? [], paramsByTier?.[tier as keyof ComplexityTiers]),
    ]),
  ) as SerializedTierConfig;
