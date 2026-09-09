import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WordPressApiError, WordPressRestAdapter } from "./wordpress-adapter.js";

const BASE_URL = "https://example.wpcomstaging.com";

function jsonResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function textResponse(status: number, body: string): Response {
  return new Response(body, { status, headers: { "Content-Type": "text/html" } });
}

const samplePost = {
  id: 42,
  status: "draft",
  type: "post",
  slug: "hello-world",
  link: "https://example.wpcomstaging.com/?p=42",
  date: "2026-09-09T00:00:00",
  modified: "2026-09-09T00:00:00",
  title: { rendered: "Hello World" },
};

describe("WordPressRestAdapter", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function adapter(): WordPressRestAdapter {
    return new WordPressRestAdapter({
      baseUrl: BASE_URL,
      username: "claude-test",
      password: "abcd 1234",
    });
  }

  it("rejects a baseUrl with a trailing slash at construction time", () => {
    expect(
      () => new WordPressRestAdapter({ baseUrl: `${BASE_URL}/`, username: "u", password: "p" }),
    ).toThrow(/trailing slash/);
  });

  it("sends a Basic Auth header built from the given credentials", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, samplePost));
    await adapter().getPost("posts", 42);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(
      `Basic ${Buffer.from("claude-test:abcd 1234").toString("base64")}`,
    );
  });

  describe("getPost", () => {
    it("returns the parsed post on success", async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, samplePost));
      const result = await adapter().getPost("posts", 42);
      expect(result?.id).toBe(42);
      expect(result?.title.rendered).toBe("Hello World");
      const [url] = fetchMock.mock.calls[0] as [string];
      expect(url).toBe(`${BASE_URL}/wp-json/wp/v2/posts/42`);
    });

    it("returns null on a 404 — 'no data' is never conflated with an error", async () => {
      fetchMock.mockResolvedValue(jsonResponse(404, { code: "rest_post_invalid_id" }));
      const result = await adapter().getPost("posts", 999);
      expect(result).toBeNull();
    });

    it("throws WordPressApiError on a 500", async () => {
      fetchMock.mockResolvedValue(jsonResponse(500, { code: "internal_error" }));
      await expect(adapter().getPost("posts", 42)).rejects.toThrow(WordPressApiError);
    });

    it("throws (does not silently pass through) a response that fails schema validation", async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, { id: "not-a-number" }));
      await expect(adapter().getPost("posts", 42)).rejects.toThrow();
    });

    it("captures a non-JSON error body (e.g. an HTML error page) in the thrown error", async () => {
      fetchMock.mockResolvedValue(textResponse(500, "<html>Internal Server Error</html>"));
      const error = await adapter()
        .getPost("posts", 42)
        .catch((e: unknown) => e as WordPressApiError);
      expect(error).toBeInstanceOf(WordPressApiError);
      expect(error.body).toBe("<html>Internal Server Error</html>");
    });
  });

  describe("listPosts", () => {
    it("builds a query string from the given filters", async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, [samplePost]));
      await adapter().listPosts("posts", {
        page: 2,
        perPage: 10,
        search: "hello",
        status: ["draft", "pending"],
        orderby: "date",
        order: "desc",
      });
      const [url] = fetchMock.mock.calls[0] as [string];
      const parsed = new URL(url);
      expect(parsed.searchParams.get("page")).toBe("2");
      expect(parsed.searchParams.get("per_page")).toBe("10");
      expect(parsed.searchParams.get("search")).toBe("hello");
      expect(parsed.searchParams.get("status")).toBe("draft,pending");
      expect(parsed.searchParams.get("orderby")).toBe("date");
      expect(parsed.searchParams.get("order")).toBe("desc");
    });

    it("omits the query string entirely when no filters are given", async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, []));
      await adapter().listPosts("posts", {});
      const [url] = fetchMock.mock.calls[0] as [string];
      expect(url).toBe(`${BASE_URL}/wp-json/wp/v2/posts`);
    });

    it("throws WordPressApiError on a 404 (an invalid postType route), never a silent empty list", async () => {
      fetchMock.mockResolvedValue(jsonResponse(404, { code: "rest_no_route" }));
      const error = await adapter()
        .listPosts("not_a_real_type", {})
        .catch((e: unknown) => e as WordPressApiError);
      expect(error).toBeInstanceOf(WordPressApiError);
      expect(error.status).toBe(404);
    });
  });

  describe("getPostMeta", () => {
    it("returns the requested key from the post's meta object", async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, { meta: { _yoast_wpseo_title: "SEO Title" } }));
      const value = await adapter().getPostMeta("posts", 42, "_yoast_wpseo_title");
      expect(value).toBe("SEO Title");
    });

    it("treats WordPress's empty-meta '[]' quirk as an empty object, not a validation error", async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, { meta: [] }));
      const value = await adapter().getPostMeta("posts", 42, "anything");
      expect(value).toBeUndefined();
    });

    it("returns undefined on a 404", async () => {
      fetchMock.mockResolvedValue(jsonResponse(404, { code: "rest_post_invalid_id" }));
      expect(await adapter().getPostMeta("posts", 999, "x")).toBeUndefined();
    });

    it("requests the built-in post type's route when postType is 'posts'", async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, { meta: {} }));
      await adapter().getPostMeta("posts", 42, "x");
      const [url] = fetchMock.mock.calls[0] as [string];
      expect(url).toBe(`${BASE_URL}/wp-json/wp/v2/posts/42?_fields=meta`);
    });

    it("requests a custom post type's own route, not the built-in posts route", async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, { meta: {} }));
      await adapter().getPostMeta("case_study", 42, "x");
      const [url] = fetchMock.mock.calls[0] as [string];
      expect(url).toBe(`${BASE_URL}/wp-json/wp/v2/case_study/42?_fields=meta`);
    });
  });

  describe("getPublicationState", () => {
    it("returns status and url on success", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse(200, { status: "publish", link: "https://example.wpcomstaging.com/hello/" }),
      );
      const state = await adapter().getPublicationState("posts", 42);
      expect(state).toEqual({ status: "publish", url: "https://example.wpcomstaging.com/hello/" });
    });

    it("accepts a null link without throwing", async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, { status: "trash", link: null }));
      const state = await adapter().getPublicationState("posts", 42);
      expect(state).toEqual({ status: "trash", url: null });
    });

    it("returns a typed not_found state on a 404, not an error", async () => {
      fetchMock.mockResolvedValue(jsonResponse(404, { code: "rest_post_invalid_id" }));
      const state = await adapter().getPublicationState("posts", 999);
      expect(state).toEqual({ status: "not_found", url: null });
    });
  });

  describe("createDraft", () => {
    it("sends status: draft even when no status is given", async () => {
      fetchMock.mockResolvedValue(jsonResponse(201, samplePost));
      await adapter().createDraft("posts", { title: "Hello World" });
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string);
      expect(body.status).toBe("draft");
      expect(body.title).toBe("Hello World");
    });

    it("rejects an explicit non-draft status instead of silently overriding it", async () => {
      await expect(
        adapter().createDraft("posts", { title: "x", status: "publish" as never }),
      ).rejects.toThrow(/only ever writes status "draft"/);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("updateDraft", () => {
    it("PATCHes the given post type's route and forces status: draft when a status is given", async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, samplePost));
      await adapter().updateDraft("posts", 42, { title: "Updated", status: "draft" });
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${BASE_URL}/wp-json/wp/v2/posts/42`);
      const body = JSON.parse(init.body as string);
      expect(body.status).toBe("draft");
    });

    it("uses a custom post type's own route, not the built-in posts route", async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, samplePost));
      await adapter().updateDraft("case_study", 42, { title: "Updated" });
      const [url] = fetchMock.mock.calls[0] as [string];
      expect(url).toBe(`${BASE_URL}/wp-json/wp/v2/case_study/42`);
    });

    it("does not add a status field when none was given (a content-only edit)", async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, samplePost));
      await adapter().updateDraft("posts", 42, { title: "Updated" });
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string);
      expect(body.status).toBeUndefined();
    });

    it("rejects an explicit non-draft status", async () => {
      await expect(
        adapter().updateDraft("posts", 42, { status: "publish" as never }),
      ).rejects.toThrow(/only ever writes status "draft"/);
    });

    it("throws WordPressApiError (not a confusing ZodError) on a 404", async () => {
      fetchMock.mockResolvedValue(jsonResponse(404, { code: "rest_post_invalid_id" }));
      const error = await adapter()
        .updateDraft("posts", 999, { title: "x" })
        .catch((e: unknown) => e as WordPressApiError);
      expect(error).toBeInstanceOf(WordPressApiError);
      expect(error.status).toBe(404);
    });
  });

  describe("healthCheck", () => {
    it("reports ok when the REST root exposes the wp/v2 namespace", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse(200, { name: "Test Site", namespaces: ["wp/v2", "oembed/1.0"] }),
      );
      const result = await adapter().healthCheck();
      expect(result.ok).toBe(true);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it("reports not-ok on a non-2xx response, without throwing", async () => {
      fetchMock.mockResolvedValue(jsonResponse(503, { code: "service_unavailable" }));
      const result = await adapter().healthCheck();
      expect(result.ok).toBe(false);
    });

    it("reports not-ok when fetch itself throws (network failure), without propagating", async () => {
      fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));
      const result = await adapter().healthCheck();
      expect(result.ok).toBe(false);
    });

    it("fails fast on a 429 instead of inheriting the data-call retry/backoff", async () => {
      fetchMock.mockResolvedValue(jsonResponse(429, { code: "too_many_requests" }));
      const result = await adapter().healthCheck();
      expect(result.ok).toBe(false);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("429 backoff", () => {
    it("retries with the Retry-After delay and succeeds once the server stops throttling", async () => {
      vi.useFakeTimers();
      try {
        fetchMock
          .mockResolvedValueOnce(
            jsonResponse(429, { code: "too_many_requests" }, { "Retry-After": "1" }),
          )
          .mockResolvedValueOnce(jsonResponse(200, samplePost));

        const pending = adapter().getPost("posts", 42);
        await vi.advanceTimersByTimeAsync(1000);
        const result = await pending;

        expect(result?.id).toBe(42);
        expect(fetchMock).toHaveBeenCalledTimes(2);
      } finally {
        vi.useRealTimers();
      }
    });

    it("clamps an excessively large Retry-After value instead of holding the caller open indefinitely", async () => {
      vi.useFakeTimers();
      try {
        fetchMock
          .mockResolvedValueOnce(
            jsonResponse(429, { code: "too_many_requests" }, { "Retry-After": "999999999" }),
          )
          .mockResolvedValueOnce(jsonResponse(200, samplePost));

        const pending = adapter().getPost("posts", 42);
        // Clamped to 30s (MAX_RETRY_AFTER_SECONDS) — if unclamped, this would still be pending.
        await vi.advanceTimersByTimeAsync(30_000);
        const result = await pending;

        expect(result?.id).toBe(42);
      } finally {
        vi.useRealTimers();
      }
    });

    it("gives up and throws after exceeding the retry limit", async () => {
      vi.useFakeTimers();
      try {
        fetchMock.mockResolvedValue(jsonResponse(429, { code: "too_many_requests" }));

        const pending = adapter()
          .getPost("posts", 42)
          .catch((error: unknown) => error);
        await vi.advanceTimersByTimeAsync(10_000);
        const result = await pending;

        expect(result).toBeInstanceOf(WordPressApiError);
        expect((result as WordPressApiError).status).toBe(429);
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
