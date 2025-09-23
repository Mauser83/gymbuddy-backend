import { createHash } from 'crypto';

import { ensureModelFile } from '../../../src/modules/images/models.ensure';

jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    stat: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn(),
    rm: jest.fn(),
  },
}));

jest.mock('@aws-sdk/client-s3', () => {
  const sendMock = jest.fn();
  return {
    S3Client: jest.fn().mockImplementation(() => ({
      send: sendMock,
    })),
    GetObjectCommand: jest.fn(),
    __sendMock: sendMock,
  };
});

const fs = require('fs').promises as jest.Mocked<typeof import('fs').promises>;
const { __sendMock: s3SendMock } = jest.requireMock('@aws-sdk/client-s3') as {
  __sendMock: jest.Mock;
};

const originalFetch = global.fetch;

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn();
  process.env.R2_ACCOUNT_ID = 'acct';
  process.env.R2_ACCESS_KEY_ID = 'key';
  process.env.R2_SECRET_ACCESS_KEY = 'secret';
});

afterAll(() => {
  global.fetch = originalFetch;
});

describe('ensureModelFile', () => {
  it('skips download when file exists with matching checksum', async () => {
    const contents = Buffer.from('hello');
    const sha = createHash('sha256').update(contents).digest('hex');

    fs.stat.mockResolvedValue({} as any);
    fs.readFile.mockResolvedValue(contents);

    await ensureModelFile('/tmp/model.onnx', { kind: 'url', url: 'https://example.com/model' }, sha);

    expect(fs.rm).not.toHaveBeenCalled();
    expect(fs.writeFile).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('re-downloads from URL when checksum mismatches existing file', async () => {
    const newBytes = Buffer.from('new-bytes');
    const sha = createHash('sha256').update(newBytes).digest('hex');

    fs.stat.mockResolvedValue({} as any);
    fs.readFile.mockResolvedValueOnce(Buffer.from('old-bytes')).mockResolvedValueOnce(newBytes);
    fs.rm.mockResolvedValue(undefined as any);
    fs.mkdir.mockResolvedValue(undefined as any);
    fs.writeFile.mockResolvedValue(undefined as any);

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      arrayBuffer: jest.fn().mockResolvedValue(newBytes),
    });

    await ensureModelFile('/tmp/model.onnx', { kind: 'url', url: 'https://example.com/model' }, sha);

    expect(fs.rm).toHaveBeenCalled();
    expect(fs.mkdir).toHaveBeenCalledWith('/tmp', { recursive: true });
    expect(fs.writeFile).toHaveBeenCalledWith('/tmp/model.onnx', newBytes);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('throws when downloaded data fails checksum in R2 mode', async () => {
    fs.stat.mockRejectedValue(new Error('missing'));
    fs.mkdir.mockResolvedValue(undefined as any);
    fs.writeFile.mockResolvedValue(undefined as any);

    const badBytes = Buffer.from('bad');
    const sha = createHash('sha256').update('expected').digest('hex');

    s3SendMock.mockResolvedValue({
      Body: {
        transformToByteArray: jest.fn().mockResolvedValue(new Uint8Array(badBytes)),
      },
    });

    await expect(
      ensureModelFile(
        '/tmp/model.onnx',
        { kind: 'r2', bucket: 'bucket', key: 'model.onnx' },
        sha,
      ),
    ).rejects.toThrow('Checksum mismatch');

    expect(fs.writeFile).toHaveBeenCalledWith('/tmp/model.onnx', expect.any(Uint8Array));
    expect(s3SendMock).toHaveBeenCalled();
  });
});