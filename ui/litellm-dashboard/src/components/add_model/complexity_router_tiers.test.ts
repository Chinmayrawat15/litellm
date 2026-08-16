import { describe, expect, it } from "vitest";

import { extractTierModelParams, normalizeTierModels, serializeTierConfig } from "./complexity_router_tiers";

// The backend types a tier as `str | list[str]` and widens with
// `models if isinstance(models, list) else [models]`
// (litellm/router_strategy/complexity_router/config.py:255, :441). These cases assert the
// expected verdict per input rather than just agreement between call sites, so the test still
// has teeth if every reader were changed at once.
describe("normalizeTierModels", () => {
  it("widens a pinned single model to a one-element pool", () => {
    expect(normalizeTierModels("gpt-4o-mini")).toEqual(["gpt-4o-mini"]);
  });

  it("passes a pool through in order", () => {
    expect(normalizeTierModels(["a", "b"])).toEqual(["a", "b"]);
  });

  it("treats an empty string as no models, not a pool containing an empty name", () => {
    expect(normalizeTierModels("")).toEqual([]);
  });

  it("drops non-string entries rather than typing them as models", () => {
    expect(normalizeTierModels(["a", 3, null, "b"])).toEqual(["a", "b"]);
  });

  it.each([[undefined], [null], [{}], [42]])("returns no models for %s", (value) => {
    expect(normalizeTierModels(value)).toEqual([]);
  });

  it("widens a single object entry", () => {
    expect(normalizeTierModels({ model_name: "o3", litellm_params: { reasoning_effort: "high" } })).toEqual(["o3"]);
  });

  it("widens mixed string and object entries", () => {
    expect(
      normalizeTierModels(["gpt-4o-mini", { model_name: "o3", litellm_params: { reasoning_effort: "high" } }]),
    ).toEqual(["gpt-4o-mini", "o3"]);
  });

  it("extracts per-model params while preserving unrelated request params", () => {
    expect(
      extractTierModelParams([
        "gpt-4o-mini",
        { model_name: "o3", litellm_params: { reasoning_effort: "high", max_tokens: 1000 } },
      ]),
    ).toEqual({ o3: { reasoning_effort: "high", max_tokens: 1000 } });
  });

  it("serializes unset entries as strings and configured entries as objects", () => {
    expect(
      serializeTierConfig(
        { SIMPLE: ["gpt-4o-mini", "o3"], REASONING: ["o3"] },
        { SIMPLE: { o3: { reasoning_effort: "high" } } },
      ),
    ).toEqual({
      SIMPLE: ["gpt-4o-mini", { model_name: "o3", litellm_params: { reasoning_effort: "high" } }],
      REASONING: ["o3"],
    });
  });

  it("round-trips a stored single object entry with unknown params", () => {
    const stored = {
      model_name: "o3",
      litellm_params: { reasoning_effort: "xhigh", custom_request_param: "preserve-me" },
    };
    const tiers = { REASONING: normalizeTierModels(stored) };
    const params = { REASONING: extractTierModelParams(stored) };

    expect(serializeTierConfig(tiers, params)).toEqual({ REASONING: stored });
  });
});
