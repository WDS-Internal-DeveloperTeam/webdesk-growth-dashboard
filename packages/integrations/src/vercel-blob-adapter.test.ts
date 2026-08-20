import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";

const delMock = vi.fn();
const getMock = vi.fn();
const handleUploadMock = vi.fn();

vi.mock("@vercel/blob", () => ({
  del: (...args: unknown[]) => delMock(...args),
  get: (...args: unknown[]) => getMock(...args),
}));

vi.mock("@vercel/blob/client", () => ({
  handleUpload: (...args: unknown[]) => handleUploadMock(...args),
}));

import { VercelBlobAdapter } from "./vercel-blob-adapter.js";

describe("VercelBlobAdapter", () => {
  describe("handleClientUploadRequest", () => {
    it("forwards onBeforeGenerateToken's result to handleUpload, translated into @vercel/blob's shape", async () => {
      handleUploadMock.mockImplementation(async ({ onBeforeGenerateToken }) => {
        const authorization = await onBeforeGenerateToken("path/to/file.pdf", "payload");
        return { type: "blob.generate-client-token", clientToken: "test-token", authorization };
      });

      const adapter = new VercelBlobAdapter();
      const result = await adapter.handleClientUploadRequest({
        body: { type: "blob.generate-client-token" },
        request: {} as never,
        onBeforeGenerateToken: async (pathname, clientPayload) => {
          expect(pathname).toBe("path/to/file.pdf");
          expect(clientPayload).toBe("payload");
          return {
            allowedContentTypes: ["application/pdf"],
            maximumSizeInBytes: 1000,
            addRandomSuffix: true,
            tokenPayload: "record-123",
          };
        },
        onUploadCompleted: async () => {},
      });

      expect(result).toEqual(
        expect.objectContaining({
          authorization: {
            allowedContentTypes: ["application/pdf"],
            maximumSizeInBytes: 1000,
            addRandomSuffix: true,
            tokenPayload: "record-123",
          },
        }),
      );
    });

    it("translates a null clientPayload from @vercel/blob's shape (which may pass undefined)", async () => {
      handleUploadMock.mockImplementation(async ({ onBeforeGenerateToken }) => {
        await onBeforeGenerateToken("path/to/file.pdf", undefined);
        return { type: "blob.generate-client-token", clientToken: "test-token" };
      });

      const adapter = new VercelBlobAdapter();
      let receivedClientPayload: string | null = "not-called";
      await adapter.handleClientUploadRequest({
        body: { type: "blob.generate-client-token" },
        request: {} as never,
        onBeforeGenerateToken: async (_pathname, clientPayload) => {
          receivedClientPayload = clientPayload;
          return { allowedContentTypes: [], maximumSizeInBytes: 1 };
        },
        onUploadCompleted: async () => {},
      });

      expect(receivedClientPayload).toBeNull();
    });

    it("forwards onUploadCompleted's blob/tokenPayload through, defaulting a missing tokenPayload to null", async () => {
      let receivedEvent: unknown;
      handleUploadMock.mockImplementation(async ({ onUploadCompleted }) => {
        await onUploadCompleted({
          blob: {
            url: "https://x.blob.vercel-storage.com/f.pdf",
            pathname: "f.pdf",
            contentType: "application/pdf",
          },
          tokenPayload: undefined,
        });
        return { type: "blob.upload-completed", response: "ok" };
      });

      const adapter = new VercelBlobAdapter();
      await adapter.handleClientUploadRequest({
        body: { type: "blob.upload-completed" },
        request: {} as never,
        onBeforeGenerateToken: async () => ({ allowedContentTypes: [], maximumSizeInBytes: 1 }),
        onUploadCompleted: async (event) => {
          receivedEvent = event;
        },
      });

      expect(receivedEvent).toEqual({
        blob: {
          url: "https://x.blob.vercel-storage.com/f.pdf",
          pathname: "f.pdf",
          contentType: "application/pdf",
        },
        tokenPayload: null,
      });
    });
  });

  describe("getObject", () => {
    it("returns null when the object doesn't exist (statusCode !== 200)", async () => {
      getMock.mockResolvedValue({ statusCode: 404, stream: null, blob: null });
      const adapter = new VercelBlobAdapter();
      expect(await adapter.getObject("missing.pdf")).toBeNull();
      expect(getMock).toHaveBeenCalledWith("missing.pdf", { access: "private" });
    });

    it("returns null when get() itself resolves to null/undefined", async () => {
      getMock.mockResolvedValue(null);
      const adapter = new VercelBlobAdapter();
      expect(await adapter.getObject("missing.pdf")).toBeNull();
    });

    it("collects the full stream into a buffer and returns the real content type", async () => {
      const body = Buffer.from("hello world");
      getMock.mockResolvedValue({
        statusCode: 200,
        stream: Readable.toWeb(Readable.from([body])),
        blob: { contentType: "text/plain" },
      });
      const adapter = new VercelBlobAdapter();
      const result = await adapter.getObject("hello.txt");
      expect(result?.body.toString()).toBe("hello world");
      expect(result?.contentType).toBe("text/plain");
    });
  });

  describe("deleteObject", () => {
    it("calls del() with the given pathname", async () => {
      delMock.mockResolvedValue(undefined);
      const adapter = new VercelBlobAdapter();
      await adapter.deleteObject("some/file.pdf");
      expect(delMock).toHaveBeenCalledWith("some/file.pdf");
    });
  });
});
