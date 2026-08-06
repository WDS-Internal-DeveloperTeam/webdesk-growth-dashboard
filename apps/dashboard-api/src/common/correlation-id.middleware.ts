import { Injectable, type NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";

export const CORRELATION_ID_HEADER = "x-correlation-id";

/**
 * Extends Express's Request locally rather than via global module
 * augmentation — augmenting `express-serve-static-core` proved fragile
 * across @types/express versions/module-resolution modes; an explicit
 * intersection type is more portable and just as safe at the call sites
 * that actually need `correlationId` (all-exceptions.filter.ts).
 */
export interface RequestWithCorrelationId extends Request {
  correlationId?: string;
}

/**
 * Every request gets a correlation ID — reused from the incoming header if
 * the caller (e.g. dashboard-web) already set one, otherwise generated here.
 * Echoed back on the response so the web→API boundary can be traced
 * end-to-end (docs/architecture/decisions/0002-nextjs-nestjs-responsibility-separation.md's
 * "Operational considerations").
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: RequestWithCorrelationId, res: Response, next: NextFunction): void {
    const incoming = req.header(CORRELATION_ID_HEADER);
    const correlationId = incoming && incoming.length > 0 ? incoming : uuidv4();
    req.correlationId = correlationId;
    res.setHeader(CORRELATION_ID_HEADER, correlationId);
    next();
  }
}
