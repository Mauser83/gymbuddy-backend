import { RecognitionResolvers } from '../../../src/modules/recognition/recognition.resolvers';

describe('RecognitionResolvers', () => {
  const baseContext = () => ({
    userId: 99,
    recognitionService: {
      createUploadTicket: jest.fn().mockResolvedValue({ token: 'ticket' }),
      recognizeImage: jest.fn().mockResolvedValue({
        attemptId: '1',
        gymCandidates: null,
        globalCandidates: null,
        equipmentCandidates: null,
      }),
      confirmRecognition: jest.fn().mockResolvedValue({ ok: true }),
      discardRecognition: jest.fn().mockResolvedValue({ ok: true }),
    },
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('forwards upload ticket creation to the service', async () => {
    const ctx = baseContext();
    const res = await RecognitionResolvers.Mutation.createRecognitionUploadTicket(
      {},
      { gymId: 1, input: { contentType: 'image/jpeg' } as any },
      ctx as any,
    );
    expect(ctx.recognitionService.createUploadTicket).toHaveBeenCalledWith(1, {
      contentType: 'image/jpeg',
    });
    expect(res).toEqual({ token: 'ticket' });
  });

  it('clamps recognition limit and normalizes empty candidate lists', async () => {
    const ctx = baseContext();
    ctx.recognitionService.recognizeImage.mockResolvedValue({
      attemptId: '2',
      gymCandidates: undefined,
      globalCandidates: undefined,
      equipmentCandidates: undefined,
    });

    const res = await RecognitionResolvers.Mutation.recognizeImage(
      {},
      { ticketToken: 'tok', limit: 42 },
      ctx as any,
    );

    expect(ctx.recognitionService.recognizeImage).toHaveBeenCalledWith('tok', 10);
    expect(res).toEqual({
      attemptId: '2',
      gymCandidates: [],
      globalCandidates: [],
      equipmentCandidates: [],
    });
  });

  it('enforces a minimum recognition limit of 1', async () => {
    const ctx = baseContext();
    await RecognitionResolvers.Mutation.recognizeImage({}, { ticketToken: 'tok', limit: 0 }, ctx as any);
    expect(ctx.recognitionService.recognizeImage).toHaveBeenCalledWith('tok', 1);
  });

  it('confirms recognition with bigint conversion and context user id', async () => {
    const ctx = baseContext();
    await RecognitionResolvers.Mutation.confirmRecognition(
      {},
      { input: { attemptId: '7', selectedEquipmentId: 5, offerForTraining: true } },
      ctx as any,
    );
    expect(ctx.recognitionService.confirmRecognition).toHaveBeenCalledWith({
      attemptId: BigInt(7),
      selectedEquipmentId: 5,
      offerForTraining: true,
      uploaderUserId: 99,
    });
  });

  it('discards recognition using bigint attempt id', async () => {
    const ctx = baseContext();
    await RecognitionResolvers.Mutation.discardRecognition({}, { attemptId: '11' }, ctx as any);
    expect(ctx.recognitionService.discardRecognition).toHaveBeenCalledWith(BigInt(11));
  });
});