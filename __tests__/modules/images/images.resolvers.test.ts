jest.mock('class-validator', () => {
  const actual = jest.requireActual('class-validator');
  return {
    ...actual,
    validateOrReject: jest.fn(() => Promise.resolve()),
  };
});

import { validateOrReject } from 'class-validator';

import { ImagesResolvers } from '../../../src/modules/images/images.resolvers';

const mockedValidate = jest.mocked(validateOrReject);

describe('ImagesResolvers', () => {
  const baseContext = () => ({
    userId: 42,
    prisma: {
      user: { findUnique: jest.fn() },
    } as any,
    mediaService: {
      presignGetForKey: jest.fn().mockResolvedValue('https://signed'),
    },
    imageIntakeService: {
      finalizeGymImage: jest.fn(),
      finalizeGymImages: jest.fn(),
      applyTaxonomiesToGymImages: jest.fn(),
    },
    imagePromotionService: {
      promoteGymImageToGlobal: jest.fn(),
      approveTrainingCandidate: jest.fn(),
      rejectTrainingCandidate: jest.fn(),
      listTrainingCandidates: jest.fn(),
      listGlobalSuggestions: jest.fn(),
      approveGlobalSuggestion: jest.fn(),
      rejectGlobalSuggestion: jest.fn(),
    },
    imageModerationService: {
      approveGymImage: jest.fn(),
      rejectGymImage: jest.fn(),
      candidateGlobalImages: jest.fn(),
    },
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resolves signed URLs for training candidates', async () => {
    const ctx = baseContext();
    const url = await ImagesResolvers.TrainingCandidateRow.url(
      { storageKey: 'key' },
      {},
      ctx as any,
    );
    expect(ctx.mediaService.presignGetForKey).toHaveBeenCalledWith('key', 300);
    expect(url).toBe('https://signed');
  });

  it('resolves signed URLs for global suggestion rows', async () => {
    const ctx = baseContext();
    const url = await ImagesResolvers.GlobalSuggestionRow.url(
      { storageKey: 'key' },
      {},
      ctx as any,
    );
    expect(ctx.mediaService.presignGetForKey).toHaveBeenCalledWith('key', 300);
    expect(url).toBe('https://signed');
  });

  it('returns approvedBy user when present or fetches via prisma', async () => {
    const ctx = baseContext();
    const direct = await ImagesResolvers.CandidateGymImage.approvedBy(
      { approvedByUser: { id: 1 } },
      {},
      ctx as any,
    );
    expect(direct).toEqual({ id: 1 });

    ctx.prisma.user.findUnique.mockResolvedValue({ id: 2 });
    const fetched = await ImagesResolvers.CandidateGymImage.approvedBy(
      { approvedByUserId: 2 },
      {},
      ctx as any,
    );
    expect(ctx.prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 2 } });
    expect(fetched).toEqual({ id: 2 });
  });

  it('returns null when approved user is absent', async () => {
    const ctx = baseContext();
    const res = await ImagesResolvers.CandidateGymImage.approvedBy({}, {}, ctx as any);
    expect(res).toBeNull();
    expect(ctx.prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('validates and forwards finalizeGymImage mutation', async () => {
    const ctx = baseContext();
    await ImagesResolvers.Mutation.finalizeGymImage(
      {},
      { input: { gymId: 1, equipmentId: 2, storageKey: 'private/uploads/key.jpg' } },
      ctx as any,
    );
    expect(mockedValidate).toHaveBeenCalled();
    expect(ctx.imageIntakeService.finalizeGymImage).toHaveBeenCalled();
  });

  it('validates and forwards finalizeGymImages mutation with user context', async () => {
    const ctx = baseContext();
    await ImagesResolvers.Mutation.finalizeGymImages(
      {},
      {
        input: {
          defaults: { gymId: 1, equipmentId: 2 },
          items: [{ storageKey: 'private/uploads/key.jpg' }],
        },
      },
      ctx as any,
    );
    expect(mockedValidate).toHaveBeenCalled();
    expect(ctx.imageIntakeService.finalizeGymImages).toHaveBeenCalledWith(
      expect.any(Object),
      ctx.userId,
    );
  });

  it('validates and forwards applyTaxonomiesToGymImages mutation', async () => {
    const ctx = baseContext();
    await ImagesResolvers.Mutation.applyTaxonomiesToGymImages(
      {},
      {
        input: {
          imageIds: ['img-1'],
          angleId: 1,
        },
      },
      ctx as any,
    );
    expect(mockedValidate).toHaveBeenCalled();
    expect(ctx.imageIntakeService.applyTaxonomiesToGymImages).toHaveBeenCalledWith(
      expect.any(Object),
    );
  });

  it('validates and forwards promoteGymImageToGlobal mutation', async () => {
    const ctx = baseContext();
    await ImagesResolvers.Mutation.promoteGymImageToGlobal(
      {},
      { input: { id: 'gym-image-id' } },
      ctx as any,
    );
    expect(mockedValidate).toHaveBeenCalled();
    expect(ctx.imagePromotionService.promoteGymImageToGlobal).toHaveBeenCalledWith(
      expect.any(Object),
      ctx,
    );
  });

  it('routes moderation mutations through services', async () => {
    const ctx = baseContext();
    await ImagesResolvers.Mutation.approveGymImage({}, { input: { id: '1' } }, ctx as any);
    await ImagesResolvers.Mutation.rejectGymImage(
      {},
      { input: { id: '2', reason: 'bad' } },
      ctx as any,
    );
    expect(mockedValidate).toHaveBeenCalledTimes(2);
    expect(ctx.imageModerationService.approveGymImage).toHaveBeenCalledWith(
      expect.any(Object),
      ctx,
    );
    expect(ctx.imageModerationService.rejectGymImage).toHaveBeenCalledWith(expect.any(Object), ctx);
  });

  it('routes training candidate moderation through promotion service', async () => {
    const ctx = baseContext();
    await ImagesResolvers.Mutation.approveTrainingCandidate(
      {},
      { input: { id: 'cand-1' } },
      ctx as any,
    );
    await ImagesResolvers.Mutation.rejectTrainingCandidate(
      {},
      { input: { id: 'cand-1', reason: 'duplicate' } },
      ctx as any,
    );
    expect(mockedValidate).toHaveBeenCalledTimes(2);
    expect(ctx.imagePromotionService.approveTrainingCandidate).toHaveBeenCalledWith(
      expect.any(Object),
      ctx,
    );
    expect(ctx.imagePromotionService.rejectTrainingCandidate).toHaveBeenCalledWith(
      expect.any(Object),
      ctx,
    );
  });

  it('routes global suggestion moderation through promotion service', async () => {
    const ctx = baseContext();
    await ImagesResolvers.Mutation.approveGlobalSuggestion(
      {},
      { input: { id: 'global-1' } },
      ctx as any,
    );
    await ImagesResolvers.Mutation.rejectGlobalSuggestion(
      {},
      { input: { id: 'global-2', reason: 'blurry' } },
      ctx as any,
    );
    expect(mockedValidate).toHaveBeenCalledTimes(2);
    expect(ctx.imagePromotionService.approveGlobalSuggestion).toHaveBeenCalledWith(
      expect.any(Object),
      ctx,
    );
    expect(ctx.imagePromotionService.rejectGlobalSuggestion).toHaveBeenCalledWith(
      expect.any(Object),
      ctx,
    );
  });

  it('validates and resolves listTrainingCandidates query', async () => {
    const ctx = baseContext();
    await ImagesResolvers.Query.listTrainingCandidates(
      {},
      { input: { gymId: 99, limit: 5 } },
      ctx as any,
    );
    expect(mockedValidate).toHaveBeenCalled();
    expect(ctx.imagePromotionService.listTrainingCandidates).toHaveBeenCalledWith(
      expect.any(Object),
      ctx,
    );
  });

  it('resolves candidateGlobalImages query', async () => {
    const ctx = baseContext();
    await ImagesResolvers.Query.candidateGlobalImages(
      {},
      { input: { equipmentId: 4, offset: 0 } },
      ctx as any,
    );
    expect(mockedValidate).toHaveBeenCalled();
    expect(ctx.imageModerationService.candidateGlobalImages).toHaveBeenCalledWith(
      expect.any(Object),
    );
  });

  it('resolves listGlobalSuggestions query', async () => {
    const ctx = baseContext();
    await ImagesResolvers.Query.listGlobalSuggestions({}, { input: { limit: 10 } }, ctx as any);
    expect(mockedValidate).toHaveBeenCalled();
    expect(ctx.imagePromotionService.listGlobalSuggestions).toHaveBeenCalledWith(
      expect.any(Object),
      ctx,
    );
  });
});
