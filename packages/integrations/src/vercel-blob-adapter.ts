import { Readable } from "node:stream";
import { del, get } from "@vercel/blob";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import type { BlobStorageAdapter } from "./adapters.js";

/**
 * The first real implementation of `BlobStorageAdapter` — see `adapters.ts`'s own doc comment for
 * why its shape was revised from the Phase 1A placeholder. Every `@vercel/blob`/`@vercel/blob/client`
 * import in this project is confined to this one file (`knowledge/08-vercel-blob-and-file-handling.md`'s
 * "object-storage adapter rule" — no scattered `put()`/`get()`/token calls in business
 * services/controllers).
 *
 * Authentication: private-store OIDC (`VERCEL_OIDC_TOKEN`/`BLOB_STORE_ID`, auto-provided by
 * Vercel when a store is connected to the project) is the SDK's own default and preferred
 * mechanism — this adapter passes no explicit `token` and relies on that default, except that
 * `handleUpload()` itself requires a static `BLOB_READ_WRITE_TOKEN` (documented: "OIDC tokens are
 * not sufficient for `handleUpload`"), read from `process.env.BLOB_READ_WRITE_TOKEN` by the SDK's
 * own default resolution — this adapter does not read or pass it explicitly either.
 */
export class VercelBlobAdapter implements BlobStorageAdapter {
  async handleClientUploadRequest(
    input: Parameters<BlobStorageAdapter["handleClientUploadRequest"]>[0],
  ): ReturnType<BlobStorageAdapter["handleClientUploadRequest"]> {
    return handleUpload({
      body: input.body as HandleUploadBody,
      request: input.request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const authorization = await input.onBeforeGenerateToken(pathname, clientPayload ?? null);
        return {
          allowedContentTypes: [...authorization.allowedContentTypes],
          maximumSizeInBytes: authorization.maximumSizeInBytes,
          addRandomSuffix: authorization.addRandomSuffix,
          tokenPayload: authorization.tokenPayload,
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        await input.onUploadCompleted({
          blob: { url: blob.url, pathname: blob.pathname, contentType: blob.contentType },
          tokenPayload: tokenPayload ?? null,
        });
      },
    });
  }

  async getObject(pathname: string): Promise<{ body: Buffer; contentType: string } | null> {
    const result = await get(pathname, { access: "private" });
    if (!result || result.statusCode !== 200 || !result.stream) {
      return null;
    }
    // `result.stream` is a WHATWG ReadableStream (per Vercel's own "Delivering private blobs"
    // example, which pipes it through `Readable.fromWeb()`) — converted to a Node Readable here so
    // a plain buffer can be collected, matching that same documented conversion.
    const chunks: Buffer[] = [];
    for await (const chunk of Readable.fromWeb(
      result.stream as Parameters<typeof Readable.fromWeb>[0],
    )) {
      chunks.push(chunk as Buffer);
    }
    return { body: Buffer.concat(chunks), contentType: result.blob.contentType };
  }

  async deleteObject(pathname: string): Promise<void> {
    await del(pathname);
  }
}
