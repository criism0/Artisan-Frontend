import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../api", () => ({
  api: vi.fn(),
}));

import { uploadToS3 } from "../uploadToS3";
import { api } from "../api";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("uploadToS3", () => {
  it("envía FormData a /s3/upload mediante api()", async () => {
    api.mockResolvedValue({
      s3_reference: { s3_key: "abc.pdf" },
    });

    const file = new File(["x"], "x.pdf", { type: "application/pdf" });
    const result = await uploadToS3(file);

    expect(api).toHaveBeenCalledTimes(1);
    const [path, options] = api.mock.calls[0];
    expect(path).toBe("/s3/upload");
    expect(options.method).toBe("POST");
    expect(options.body).toBeInstanceOf(FormData);
    expect(options.body.get("file")).toBe(file);
    expect(result).toEqual({ s3_key: "abc.pdf" });
  });

  it("propaga errores del helper api()", async () => {
    api.mockRejectedValue(new Error("Permiso denegado"));

    const file = new File(["x"], "fail.pdf");

    await expect(uploadToS3(file)).rejects.toThrow("Permiso denegado");
  });

  it("retorna data.s3_reference, no la respuesta entera", async () => {
    const ref = { s3_key: "key", s3_bucket: "bucket", original_name: "x.pdf" };
    api.mockResolvedValue({
      s3_reference: ref, 
      otros: "campos",
    });

    const result = await uploadToS3(new File(["x"], "x.pdf"));
    expect(result).toBe(ref);
  });
});
