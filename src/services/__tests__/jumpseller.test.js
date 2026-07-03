import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../lib/api", () => ({
  api: vi.fn(),
}));

import { getJumpsellerOrdenPorId } from "../jumpseller";
import { api } from "../../lib/api";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getJumpsellerOrdenPorId", () => {
  it("llama api con la URL correcta y auth=true", async () => {
    api.mockResolvedValue({ id: 42, status: "paid" });

    const result = await getJumpsellerOrdenPorId(42);

    expect(api).toHaveBeenCalledWith("/jumpseller/orders/42", { auth: true });
    expect(result).toEqual({ id: 42, status: "paid" });
  });

  it("propaga errores del api()", async () => {
    api.mockRejectedValue(new Error("404 Not Found"));
    await expect(getJumpsellerOrdenPorId(999)).rejects.toThrow("404 Not Found");
  });
});
