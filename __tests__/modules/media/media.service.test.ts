import * as presigner from "@aws-sdk/s3-request-presigner";

process.env.R2_BUCKET = "bucket";
process.env.R2_ACCOUNT_ID = "account";
process.env.R2_ACCESS_KEY_ID = "id";
process.env.R2_SECRET_ACCESS_KEY = "secret";

jest.spyOn(presigner, "getSignedUrl").mockResolvedValue("https://signed-url.example");

const { MediaService } = require("../../../src/modules/media/media.service");

const UUID = "123e4567-e89b-42d3-a456-426614174000";

describe("MediaService.presignGetForKey", () => {
  const svc = new MediaService();

  it("signs public golden key", async () => {
    const url = await svc.presignGetForKey(
      `public/golden/1/2025/01/${UUID}.jpg`,
      120
    );
    expect(url).toContain("https://signed-url.example");
    expect(presigner.getSignedUrl).toHaveBeenCalled();
  });

  it("sets content type from extension", async () => {
    await svc.presignGetForKey(
      `public/training/1/2025/01/${UUID}.webp`,
      60
    );
    const call = (presigner.getSignedUrl as jest.Mock).mock.calls.pop();
    const cmd = call[1];
    expect(cmd.input.ResponseContentType).toBe("image/webp");
  });

  it("rejects invalid prefix", async () => {
    await expect(
      svc.presignGetForKey("some/other/prefix/file.jpg", 60)
    ).rejects.toThrow(/Invalid storage key prefix/);
  });

  it("clamps TTL", async () => {
    await svc.presignGetForKey(
      `public/golden/1/2025/01/${UUID}.jpg`,
      5
    );
    const call = (presigner.getSignedUrl as jest.Mock).mock.calls.pop();
    expect(call[2].expiresIn).toBeGreaterThanOrEqual(30);
  });
});

describe("MediaService.getImageUploadUrl", () => {
  const svc = new MediaService();

  it("returns url, key, and required headers", async () => {
    const out = await svc.getImageUploadUrl({
      gymId: 7,
      contentType: "image/jpeg",
      filename: "upload.jpg",
      ttlSec: 120,
    });
    expect(out.url).toContain("https://signed-url.example");
    expect(out.key).toMatch(/^private\/uploads\/7\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.jpg$/);
    expect(out.requiredHeaders).toEqual([
      { name: "Content-Type", value: "image/jpeg" },
    ]);
  });

  it("maps contentType to extension", async () => {
    const out = await svc.getImageUploadUrl({
      gymId: 1,
      contentType: "image/webp",
    });
    expect(out.key.endsWith(".webp")).toBe(true);
  });

  it("clamps ttl", async () => {
    await svc.getImageUploadUrl({
      gymId: 1,
      contentType: "image/png",
      ttlSec: 5,
    });
    const call = (presigner.getSignedUrl as jest.Mock).mock.calls.pop();
    expect(call[2].expiresIn).toBeGreaterThanOrEqual(30);
  });
});