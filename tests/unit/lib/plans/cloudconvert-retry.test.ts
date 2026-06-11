import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchWithRetry } from "@/lib/plans/dwg-converter";

/**
 * Regression test for the CloudConvert transient-5xx retry.
 *
 * A single 502 Bad Gateway at CloudConvert job creation permanently failed a
 * live DWG → PDF 3D render on 2026-06-11 (test_3d_jobs ff22b841) because the
 * call was single-shot. fetchWithRetry now retries transient server/network
 * failures, but must NOT retry a 4xx (our request, not an upstream blip).
 */
function makeResponse(status: number): Response {
  return new Response(status >= 400 ? "error-body" : "ok", { status });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("CloudConvert fetchWithRetry", () => {
  it("retries a transient 5xx then succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(makeResponse(502))
      .mockResolvedValueOnce(makeResponse(200));
    vi.stubGlobal("fetch", fetchMock);

    const resp = await fetchWithRetry(
      "https://api.cloudconvert.com/v2/jobs",
      { method: "POST" },
      { attempts: 3, backoffMs: 0, timeoutMs: 1000, label: "job-create" },
    );

    expect(resp.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does NOT retry a 4xx — returns it on the first call", async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeResponse(400));
    vi.stubGlobal("fetch", fetchMock);

    const resp = await fetchWithRetry(
      "https://api.cloudconvert.com/v2/jobs",
      {},
      { attempts: 3, backoffMs: 0, timeoutMs: 1000 },
    );

    expect(resp.status).toBe(400);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns the last 5xx after exhausting attempts", async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeResponse(503));
    vi.stubGlobal("fetch", fetchMock);

    const resp = await fetchWithRetry(
      "https://api.cloudconvert.com/v2/jobs",
      {},
      { attempts: 2, backoffMs: 0, timeoutMs: 1000 },
    );

    expect(resp.status).toBe(503);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries a network error then succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("ECONNRESET"))
      .mockResolvedValueOnce(makeResponse(200));
    vi.stubGlobal("fetch", fetchMock);

    const resp = await fetchWithRetry(
      "https://api.cloudconvert.com/v2/jobs",
      {},
      { attempts: 3, backoffMs: 0, timeoutMs: 1000 },
    );

    expect(resp.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
