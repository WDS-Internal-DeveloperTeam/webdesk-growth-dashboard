import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { ApiErrorResponse } from "@webdesk/shared-types";
import type { Response } from "express";
import { captureException } from "../observability/sentry.js";
import type { RequestWithCorrelationId } from "./correlation-id.middleware.js";

/**
 * Global exception filter — every unhandled error becomes a generic,
 * correlation-ID-tagged ApiErrorResponse. In production, internal error
 * detail (stack traces, raw error messages for non-HttpExceptions) is
 * never sent to the client — only a generic message. In development, the
 * real message is included to speed up debugging. Neither mode ever claims
 * more than it knows: this filter does not imply authentication,
 * authorization, or audit logging of the error is implemented (Phase 1B+).
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<RequestWithCorrelationId>();
    const correlationId = request.correlationId ?? "unknown";
    const isProduction = process.env["NODE_ENV"] === "production";

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const code =
      exception instanceof HttpException ? exception.constructor.name : "InternalServerError";

    const message =
      exception instanceof HttpException
        ? exception.message
        : isProduction
          ? "An unexpected error occurred"
          : exception instanceof Error
            ? exception.message
            : "An unexpected error occurred";

    // `ZodValidationPipe` throws `BadRequestException({ message: "Validation failed", issues })` —
    // `exception.message` above only ever resolves to the flat "Validation failed" string
    // (NestJS's own `HttpException.initMessage()` promotes just the object's own `.message`), so
    // the field-level detail has to be read separately from the raw response body here, or it's
    // silently dropped and never reaches the client at all.
    const responseBody = exception instanceof HttpException ? exception.getResponse() : null;
    const issues =
      responseBody && typeof responseBody === "object" && "issues" in responseBody
        ? (responseBody as { issues?: ApiErrorResponse["error"]["issues"] }).issues
        : undefined;

    this.logger.error(
      `[${correlationId}] ${request.method} ${request.url} -> ${status}: ${message}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    // Only server errors (5xx) are real incidents worth an event — an
    // expected 4xx HttpException (validation failure, not-found, etc.) is
    // normal traffic, not something Sentry should be paged on. A no-op
    // until a real SENTRY_DSN is configured (see observability/sentry.ts).
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      captureException(exception);
    }

    const body: ApiErrorResponse = {
      success: false,
      error: issues ? { code, message, issues } : { code, message },
      correlationId,
    };

    response.status(status).json(body);
  }
}
