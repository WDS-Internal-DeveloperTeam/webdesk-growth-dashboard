import { BadRequestException, Injectable, type PipeTransform } from "@nestjs/common";
import type { ZodType } from "zod";

/**
 * Global validation pipe wired to shared Zod schemas from
 * @webdesk/validation — per profile knowledge/03-nestjs-on-vercel.md:
 * "never a parallel class-validator DTO." Controllers pass a Zod schema
 * via @UsePipes(new ZodValidationPipe(schema)) per-route; there is no
 * global schema (validation is always explicit, per-endpoint).
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodType) {}

  transform(value: unknown): unknown {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: "Validation failed",
        issues: result.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
    }
    return result.data;
  }
}
