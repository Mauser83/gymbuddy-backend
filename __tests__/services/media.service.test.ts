import * as presigner from "@aws-sdk/s3-request-presigner";

process.env.R2_BUCKET = "bucket";
process.env.R2_ACCOUNT_ID = "account";
process.env.R2_ACCESS_KEY_ID = "id";
process.env.R2_SECRET_ACCESS_KEY = "secret";

jest.spyOn(presigner, "getSignedUrl").mockResolvedValue("https://signed-url.example");

const { MediaService } = require("../../src/services/media.service");

describe("MediaService.presignGetForKey", () => {
  const svc = new MediaService();

  it("signs public golden key", async () => {
    const url = await svc.presignGetForKey("public/golden/1/2025/01/uuid.jpg", 120);
    expect(url).toContain("https://signed-url.example");
    expect(presigner.getSignedUrl).toHaveBeenCalled();
  });

  it("sets content type from extension", async () => {
    await svc.presignGetForKey("public/training/1/2025/01/uuid.webp", 60);
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
    await svc.presignGetForKey("public/golden/1/2025/01/uuid.jpg", 5);
    const call = (presigner.getSignedUrl as jest.Mock).mock.calls.pop();
    expect(call[2].expiresIn).toBeGreaterThanOrEqual(30);
  });
});