import {
  type ArgumentsHost,
  BadRequestException,
  HttpException,
  HttpStatus,
  NotFoundException,
} from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RequestWithCorrelationId } from "./correlation-id.middleware.js";

const captureException = vi.fn();
vi.mock("../observability/sentry.js", () => ({
  captureException: (e: unknown) => captureException(e),
}));

async function loadFilter() {
  const { AllExceptionsFilter } = await import("./all-exceptions.filter.js");
  return new AllExceptionsFilter();
}

function buildHost(): {
  host: ArgumentsHost;
  json: ReturnType<typeof vi.fn>;
  status: ReturnType<typeof vi.fn>;
} {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const request: Partial<RequestWithCorrelationId> = {
    correlationId: "test-correlation-id",
    method: "GET",
    url: "/test",
  };
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;
  return { host, json, status };
}

describe("AllExceptionsFilter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("does not report a 4xx HttpException to Sentry — expected traffic, not an incident", async () => {
    const filter = await loadFilter();
    const { host } = buildHost();
    filter.catch(new NotFoundException("not found"), host);
    expect(captureException).not.toHaveBeenCalled();
  });

  it("reports a 5xx HttpException to Sentry", async () => {
    const filter = await loadFilter();
    const { host } = buildHost();
    const exception = new HttpException("boom", HttpStatus.INTERNAL_SERVER_ERROR);
    filter.catch(exception, host);
    expect(captureException).toHaveBeenCalledWith(exception);
  });

  it("reports a non-HttpException (unhandled error) to Sentry as a 500", async () => {
    const filter = await loadFilter();
    const { host, status } = buildHost();
    const exception = new Error("unexpected");
    filter.catch(exception, host);
    expect(captureException).toHaveBeenCalledWith(exception);
    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
  });

  it("surfaces ZodValidationPipe's issues array in the response body, not just the flat message", async () => {
    const filter = await loadFilter();
    const { host, json } = buildHost();
    const issues = [{ path: "name", message: "String must contain at least 1 character(s)" }];
    filter.catch(new BadRequestException({ message: "Validation failed", issues }), host);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ message: "Validation failed", issues }),
      }),
    );
  });

  it("omits issues entirely for a plain-string HttpException (no validation detail to surface)", async () => {
    const filter = await loadFilter();
    const { host, json } = buildHost();
    filter.catch(new BadRequestException("publicId already in use: acme"), host);
    const body = json.mock.calls[0]?.[0] as { error: { message: string; issues?: unknown } };
    expect(body.error.message).toBe("publicId already in use: acme");
    expect(body.error.issues).toBeUndefined();
  });
});
