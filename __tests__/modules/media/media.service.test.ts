import { createHash } from 'crypto';

type MediaServiceModule = typeof import('../../../src/modules/media/media.service');

describe('MediaService', () => {
  const modulePath = '../../../src/modules/media/media.service';
  const envKeys = [
    'R2_BUCKET',
    'R2_ACCOUNT_ID',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
  ] as const;

  it('throws when required R2 environment variables are missing', async () => {
    const originals: Partial<Record<(typeof envKeys)[number], string | undefined>> = {};
    for (const key of envKeys) {
      originals[key] = process.env[key];
      delete process.env[key];
    }

    jest.resetModules();

    try {
      jest.isolateModules(() => {
        expect(() => require(modulePath)).toThrow('R2_BUCKET and R2_ACCOUNT_ID must be set');
      });
    } finally {
      for (const key of envKeys) {
        if (originals[key] === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = originals[key] as string;
        }
      }
      jest.resetModules();
    }
  });

  const setup = async () => {
    jest.resetModules();
    jest.clearAllMocks();

    const originalEnv: Partial<Record<(typeof envKeys)[number], string | undefined>> = {};
    const envValues: Record<(typeof envKeys)[number], string> = {
      R2_BUCKET: 'bucket-test',
      R2_ACCOUNT_ID: 'account-test',
      R2_ACCESS_KEY_ID: 'access',
      R2_SECRET_ACCESS_KEY: 'secret',
    };
    for (const key of envKeys) {
      originalEnv[key] = process.env[key];
      process.env[key] = envValues[key];
    }

    const sendMocks: jest.Mock[] = [];
    const actualMakeKey = jest.requireActual('../../../src/utils/makeKey');
    const makeKeyMock = jest.fn(() => 'private/uploads/3/2024/12/mock-key.jpg');

    jest.doMock('@aws-sdk/client-s3', () => ({
      S3Client: jest.fn().mockImplementation(() => {
        const send = jest.fn();
        sendMocks.push(send);
        return { send };
      }),
      GetObjectCommand: jest.fn((input) => ({ command: 'GetObjectCommand', input })),
      PutObjectCommand: jest.fn((input) => ({ command: 'PutObjectCommand', input })),
      HeadObjectCommand: jest.fn((input) => ({ command: 'HeadObjectCommand', input })),
      CopyObjectCommand: jest.fn((input) => ({ command: 'CopyObjectCommand', input })),
      DeleteObjectCommand: jest.fn((input) => ({ command: 'DeleteObjectCommand', input })),
    }));

    const getSignedUrlMock = jest.fn().mockResolvedValue('https://signed-url.example');
    jest.doMock('@aws-sdk/s3-request-presigner', () => ({
      getSignedUrl: getSignedUrlMock,
    }));

    const auditLogMock = jest.fn();
    const resolveMock = jest.fn().mockReturnValue({ logEvent: auditLogMock });
    jest.doMock('../../../src/modules/core/di.container', () => ({
      DIContainer: { resolve: resolveMock },
    }));

    jest.doMock('../../../src/utils/makeKey', () => ({
      ...actualMakeKey,
      makeKey: makeKeyMock,
    }));

    const module = require(modulePath) as MediaServiceModule;
    const service = new module.MediaService();

    const restoreEnv = () => {
      for (const key of envKeys) {
        if (originalEnv[key] === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = originalEnv[key] as string;
        }
      }
    };

    return {
      service,
      module,
      sendMocks,
      getSignedUrlMock,
      auditLogMock,
      resolveMock,
      makeKeyMock,
      restoreEnv,
    };
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rejects invalid storage key prefixes', async () => {
    const context = await setup();
    const { service, restoreEnv } = context;

    try {
      await expect(service.presignGetForKey('invalid/path.jpg')).rejects.toThrow(
        'Invalid storage key prefix',
      );
    } finally {
      restoreEnv();
    }
  });

  it('signs private downloads and logs audit events', async () => {
    const context = await setup();
    const { service, sendMocks, getSignedUrlMock, auditLogMock, resolveMock, restoreEnv } = context;
    const [, serviceSend] = sendMocks;
    serviceSend.mockResolvedValue(undefined);
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1_700_000);

    try {
      const result = await service.imageUrl('private/uploads/9/file.jpg', 120, 42);

      expect(serviceSend).toHaveBeenCalledTimes(1);
      const headCall = serviceSend.mock.calls[0][0];
      expect(headCall.command).toBe('HeadObjectCommand');
      expect(headCall.input).toEqual({ Bucket: 'bucket-test', Key: 'private/uploads/9/file.jpg' });

      expect(getSignedUrlMock).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ command: 'GetObjectCommand' }),
        { expiresIn: 120 },
      );

      const expectedHash = createHash('sha256').update('private/uploads/9/file.jpg').digest('hex');
      expect(auditLogMock).toHaveBeenCalledWith({
        action: 'SIGNED_URL_ISSUED',
        userId: 42,
        metadata: { keyHash: expectedHash, ttlSec: 120 },
      });
      expect(resolveMock).toHaveBeenCalledWith('AuditService');

      expect(result.url).toBe('https://signed-url.example');
      expect(result.expiresAt).toBe(new Date(1_700_000 + 120 * 1000).toISOString());
    } finally {
      restoreEnv();
      nowSpy.mockRestore();
    }
  });

  it('clamps presigned GET ttl and infers content type from unknown extensions', async () => {
    const context = await setup();
    const { service, getSignedUrlMock, restoreEnv } = context;
    getSignedUrlMock.mockResolvedValue('https://signed');

    try {
      await service.presignGetForKey('public/golden/asset.gif', 999_999);

      expect(getSignedUrlMock).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          command: 'GetObjectCommand',
          input: expect.objectContaining({
            Bucket: 'bucket-test',
            Key: 'public/golden/asset.gif',
            ResponseContentType: 'image/jpeg',
            ResponseContentDisposition: 'inline; filename="asset.gif"',
          }),
        }),
        { expiresIn: 604800 },
      );
    } finally {
      restoreEnv();
    }
  });

  it('enforces per-user rate limiting on repeated signing', async () => {
    const context = await setup();
    const { service, getSignedUrlMock, restoreEnv } = context;
    getSignedUrlMock.mockResolvedValue('https://signed');
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);

    try {
      for (let i = 0; i < 60; i += 1) {
        await service.imageUrl('public/golden/1/file.jpg', 60, 7);
      }

      await expect(service.imageUrl('public/golden/1/file.jpg', 60, 7)).rejects.toMatchObject({
        message: 'Too many requests',
        extensions: { code: 'TOO_MANY_REQUESTS' },
      });
    } finally {
      restoreEnv();
      nowSpy.mockRestore();
    }
  });

  it('clamps short-lived image URLs to minimum ttl and handles missing actor', async () => {
    const context = await setup();
    const { service, getSignedUrlMock, auditLogMock, restoreEnv } = context;
    getSignedUrlMock.mockResolvedValue('https://tiny');
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(5_000);

    try {
      const result = await service.imageUrl('public/golden/photo.jpg', 5);

      expect(getSignedUrlMock).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ command: 'GetObjectCommand' }),
        { expiresIn: 30 },
      );
      expect(auditLogMock).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: undefined,
          metadata: { keyHash: expect.any(String), ttlSec: 30 },
        }),
      );
      expect(result.expiresAt).toBe(new Date(5_000 + 30 * 1000).toISOString());
    } finally {
      restoreEnv();
      nowSpy.mockRestore();
    }
  });

  it('caps short-lived image URLs to maximum ttl', async () => {
    const context = await setup();
    const { service, getSignedUrlMock, restoreEnv } = context;
    getSignedUrlMock.mockResolvedValue('https://long');
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(10_000);

    try {
      const result = await service.imageUrl('public/training/photo.jpg', 10_000, 23);

      expect(getSignedUrlMock).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ command: 'GetObjectCommand' }),
        { expiresIn: 900 },
      );
      expect(result.expiresAt).toBe(new Date(10_000 + 900 * 1000).toISOString());
    } finally {
      restoreEnv();
      nowSpy.mockRestore();
    }
  });

  it('raises not found error when private object is missing', async () => {
    const context = await setup();
    const { service, sendMocks, restoreEnv } = context;
    const [, serviceSend] = sendMocks;
    serviceSend.mockRejectedValueOnce({ $metadata: { httpStatusCode: 404 } });

    try {
      await expect(service.imageUrl('private/uploads/9/missing.jpg', 45, 11)).rejects.toMatchObject(
        {
          message: 'Object not found',
          extensions: { code: 'NOT_FOUND' },
        },
      );
    } finally {
      restoreEnv();
    }
  });

  it('reuses deduplicated upload keys and detects prior uploads', async () => {
    const context = await setup();
    const { service, sendMocks, getSignedUrlMock, makeKeyMock, restoreEnv } = context;
    const [, serviceSend] = sendMocks;
    serviceSend
      .mockRejectedValueOnce({ $metadata: { httpStatusCode: 404 } })
      .mockResolvedValue(undefined);
    getSignedUrlMock.mockResolvedValue('https://upload');
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(2_000_000);

    try {
      const first = await service.getImageUploadUrl({
        gymId: 3,
        contentType: 'image/png',
        sha256: 'sha-value',
        filename: 'pic.png',
        contentLength: 1024,
      });

      expect(makeKeyMock).toHaveBeenCalledTimes(1);
      expect(first.alreadyUploaded).toBe(false);
      expect(first.key).toBe('private/uploads/3/2024/12/mock-key.jpg');
      expect(first.requiredHeaders).toEqual([{ name: 'Content-Type', value: 'image/png' }]);

      const second = await service.getImageUploadUrl({
        gymId: 3,
        contentType: 'image/png',
        sha256: 'sha-value',
        filename: 'pic.png',
        contentLength: 1024,
        ttlSec: 600,
      });

      expect(makeKeyMock).toHaveBeenCalledTimes(1);
      expect(second.alreadyUploaded).toBe(true);
      expect(second.key).toBe(first.key);
      expect(serviceSend).toHaveBeenCalledTimes(2);
      expect(second.expiresAt).toBe(new Date(2_000_000 + 600 * 1000).toISOString());
    } finally {
      restoreEnv();
      nowSpy.mockRestore();
    }
  });

  it('clamps upload ttl and defaults unknown types to jpg keys', async () => {
    const context = await setup();
    const { service, getSignedUrlMock, makeKeyMock, restoreEnv } = context;
    getSignedUrlMock.mockResolvedValue('https://upload');
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(20_000);

    try {
      const result = await service.getImageUploadUrl({
        gymId: 9,
        contentType: 'image/avif',
        contentLength: 4_096,
        ttlSec: 2_000_000,
      });

      expect(makeKeyMock).toHaveBeenLastCalledWith('upload', { gymId: 9 }, { ext: 'jpg' });
      expect(getSignedUrlMock).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ command: 'PutObjectCommand' }),
        { expiresIn: 604800 },
      );
      expect(result.alreadyUploaded).toBe(false);
      expect(result.expiresAt).toBe(new Date(20_000 + 604800 * 1000).toISOString());
    } finally {
      restoreEnv();
      nowSpy.mockRestore();
    }
  });

  it('validates upload session inputs and aggregates presigned uploads', async () => {
    const context = await setup();
    const { service, getSignedUrlMock, restoreEnv } = context;
    getSignedUrlMock
      .mockResolvedValueOnce('https://upload/1')
      .mockResolvedValueOnce('https://upload/2');
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(50_000);

    try {
      await expect(
        service.createUploadSession({
          gymId: 1,
          count: 0,
          contentTypes: [],
        }),
      ).rejects.toThrow('count must be between 1 and 10');

      await expect(
        service.createUploadSession({
          gymId: 1,
          count: 2,
          contentTypes: ['image/png'],
        }),
      ).rejects.toThrow('contentTypes length must equal count');

      const session = await service.createUploadSession({
        gymId: 1,
        count: 2,
        contentTypes: ['image/png', 'image/webp'],
        filenamePrefix: 'prefix',
      });

      expect(session.items).toHaveLength(2);
      expect(session.expiresAt).toBe(new Date(50_000 + 900 * 1000).toISOString());
      expect(session.items.map((item) => item.url)).toEqual([
        'https://upload/1',
        'https://upload/2',
      ]);
      expect(getSignedUrlMock).toHaveBeenCalledTimes(2);
    } finally {
      restoreEnv();
      nowSpy.mockRestore();
    }
  });

  it('signs many image URLs with shared ttl clamp', async () => {
    const context = await setup();
    const { service, getSignedUrlMock, restoreEnv } = context;
    getSignedUrlMock
      .mockResolvedValueOnce('https://signed/1')
      .mockResolvedValueOnce('https://signed/2');
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(75_000);

    try {
      const result = await service.imageUrlMany(
        ['public/golden/a.jpg', 'public/training/b.jpg'],
        10,
      );

      expect(result).toEqual([
        {
          storageKey: 'public/golden/a.jpg',
          url: 'https://signed/1',
          expiresAt: new Date(75_000 + 30 * 1000).toISOString(),
        },
        {
          storageKey: 'public/training/b.jpg',
          url: 'https://signed/2',
          expiresAt: new Date(75_000 + 30 * 1000).toISOString(),
        },
      ]);
      expect(getSignedUrlMock).toHaveBeenCalledTimes(2);
    } finally {
      restoreEnv();
      nowSpy.mockRestore();
    }
  });

  it('copies source objects when destination missing', async () => {
    const context = await setup();
    const { module, sendMocks, restoreEnv } = context;
    const [helperSend] = sendMocks;
    helperSend.mockRejectedValueOnce({ $metadata: { httpStatusCode: 404 } });
    helperSend.mockResolvedValue(undefined);

    try {
      await module.copyObjectIfMissing('src/key.jpg', 'dst/key.jpg');

      expect(helperSend).toHaveBeenCalledTimes(2);
      const [, copyCall] = helperSend.mock.calls;
      expect(copyCall[0]).toMatchObject({
        command: 'CopyObjectCommand',
        input: {
          Bucket: 'bucket-test',
          CopySource: 'bucket-test/src/key.jpg',
          Key: 'dst/key.jpg',
          MetadataDirective: 'COPY',
          ACL: 'private',
        },
      });
    } finally {
      restoreEnv();
    }
  });

  it('does not copy when destination already exists', async () => {
    const context = await setup();
    const { module, sendMocks, restoreEnv } = context;
    const [helperSend] = sendMocks;
    helperSend.mockResolvedValue(undefined);

    try {
      await module.copyObjectIfMissing('src/file.jpg', 'dst/file.jpg');
      expect(helperSend).toHaveBeenCalledTimes(1);
    } finally {
      restoreEnv();
    }
  });

  it('ignores missing deletes but rethrows other errors', async () => {
    const context = await setup();
    const { module, sendMocks, restoreEnv } = context;
    const [helperSend] = sendMocks;

    try {
      helperSend.mockRejectedValueOnce({ $metadata: { httpStatusCode: 404 } });
      await expect(module.deleteObjectIgnoreMissing('dst/file.jpg')).resolves.toBeUndefined();
      helperSend.mockRejectedValueOnce({ $metadata: { httpStatusCode: 500 } });
      await expect(module.deleteObjectIgnoreMissing('dst/file.jpg')).rejects.toMatchObject({
        $metadata: { httpStatusCode: 500 },
      });
    } finally {
      restoreEnv();
    }
  });
});
