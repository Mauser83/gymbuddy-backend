import { WorkoutPlanService } from "../../../src/modules/workoutplan/workoutplan.service";
import { mockDeep, DeepMockProxy } from "jest-mock-extended";
import { PrismaClient } from "../../../src/lib/prisma";
import { PermissionService } from "../../../src/modules/core/permission.service";
import { SharingService } from "../../../src/modules/workoutplan/workoutplanSharing.service";
import { validateInput } from "../../../src/middlewares/validation";
import {
  CreateWorkoutPlanDto,
  UpdateWorkoutPlanDto,
  CreateTrainingMethodDto,
  UpdateTrainingMethodDto,
} from "../../../src/modules/workoutplan/workoutplan.dto";

jest.mock("../../../src/middlewares/validation");

const mockedValidate = jest.mocked(validateInput as any);

describe("WorkoutPlanService", () => {
  let prisma: DeepMockProxy<PrismaClient>;
  let permission: {
    getUserRoles: jest.Mock;
    verifyAppRoles: jest.Mock;
    verifyPremiumAccess: jest.Mock;
  };
  let sharing: { shareWorkoutPlan: jest.Mock; shareWorkoutProgram: jest.Mock };
  let service: WorkoutPlanService;

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>();
    permission = {
      getUserRoles: jest.fn(),
      verifyAppRoles: jest.fn(),
      verifyPremiumAccess: jest.fn(),
    } as any;
    sharing = {
      shareWorkoutPlan: jest.fn(),
      shareWorkoutProgram: jest.fn(),
    } as any;
    service = new WorkoutPlanService(prisma, permission as any, sharing as any);
    mockedValidate.mockResolvedValue(undefined as any);
  });

  afterEach(() => jest.clearAllMocks());

  test("verifyWorkoutPlanAccess throws when not found", async () => {
    prisma.workoutPlan.findUnique.mockResolvedValue(null as any);
    permission.getUserRoles.mockResolvedValue({ appRoles: [] } as any);
    await expect(
      (service as any).verifyWorkoutPlanAccess(1, 2)
    ).rejects.toThrow("Workout not found");
  });

  test("verifyWorkoutPlanAccess throws when unauthorized", async () => {
    prisma.workoutPlan.findUnique.mockResolvedValue({
      userId: 5,
      sharedWith: [],
    } as any);
    permission.getUserRoles.mockResolvedValue({ appRoles: [] } as any);
    permission.verifyAppRoles.mockReturnValue(false);
    await expect(
      (service as any).verifyWorkoutPlanAccess(1, 2)
    ).rejects.toThrow("Unauthorized workout access");
  });

  test("createWorkoutPlan checks premium and creates exercises", async () => {
    permission.getUserRoles.mockResolvedValue({ userRoles: ["USER"] } as any);
    permission.verifyPremiumAccess.mockReturnValue(true);
    prisma.workoutPlan.create.mockResolvedValue({ id: 1 } as any);

    const input = {
      name: "Plan A",
      exercises: [
        {
          exerciseId: 2,
          targetSets: 3,
          targetMetrics: [{ metricId: 1, min: 10, max: 15 }],
          groupId: "group-xyz",
          trainingMethodId: 4,
          isWarmup: false,
        },
      ],
    };

    await service.createWorkoutPlan(1, input as any);

    expect(mockedValidate).toHaveBeenCalledWith(input, CreateWorkoutPlanDto);
    expect(prisma.workoutPlanExercise.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          exerciseId: 2,
          groupId: null,
          trainingMethodId: 4,
          isWarmup: false,
          targetSets: 3,
          targetMetrics: expect.anything(),
        }),
      ]),
    });
  });

  test("createWorkoutPlan denies non premium users", async () => {
    permission.getUserRoles.mockResolvedValue({ userRoles: ["USER"] } as any);
    permission.verifyPremiumAccess.mockReturnValue(false);

    await expect(
      service.createWorkoutPlan(1, { name: "n" } as any)
    ).rejects.toThrow("Premium subscription required to create workouts");
  });

  test("createWorkoutPlanVersion ensures ownership", async () => {
    prisma.workoutPlan.findUnique.mockResolvedValueOnce({
      id: 1,
      userId: 1,
      sharedWith: [],
    } as any); // verifyWorkoutPlanAccess
    permission.getUserRoles.mockResolvedValue({ appRoles: [] } as any);
    permission.verifyAppRoles.mockReturnValue(true);
    prisma.workoutPlan.findUnique.mockResolvedValueOnce({ userId: 1 } as any); // parent
    prisma.workoutPlan.count.mockResolvedValue(0 as any);
    prisma.workoutPlan.create.mockResolvedValue({ id: 2 } as any);

    const res = await service.createWorkoutPlanVersion(1, 1, {
      name: "v1",
    } as any);
    expect(prisma.workoutPlan.create).toHaveBeenCalled();
    expect(res).toEqual({ id: 2 });
  });

  test("getWorkoutPlans returns all for admin", async () => {
    permission.getUserRoles.mockResolvedValue({ appRoles: ["ADMIN"] } as any);
    permission.verifyAppRoles.mockReturnValue(true);
    prisma.workoutPlan.findMany.mockResolvedValue([{ id: 1 }] as any);
    const res = await service.getWorkoutPlans(1);
    expect(prisma.workoutPlan.findMany).toHaveBeenCalledWith();
    expect(res).toEqual([{ id: 1 }]);
  });

  test("updateWorkoutPlan calls getWorkoutPlanById with reversed args", async () => {
    permission.getUserRoles.mockResolvedValue({ appRoles: [] } as any);
    permission.verifyAppRoles.mockReturnValue(true);
    prisma.workoutPlan.findUnique.mockResolvedValue({
      userId: 1,
      sharedWith: [],
    } as any);
    prisma.workoutPlan.update.mockResolvedValue({ id: 1 } as any);
    const spy = jest
      .spyOn(service, "getWorkoutPlanById")
      .mockResolvedValue({ id: 1 } as any);
    await service.updateWorkoutPlan(1, 2, {
      name: "n",
      muscleGroupIds: [],
      trainingGoalId: 1,
      exercises: [],
    } as any);
    expect(spy).toHaveBeenCalledWith(2, 1); // reversed
  });

  test("updateWorkoutPlan replaces exercises with groupId", async () => {
    permission.getUserRoles.mockResolvedValue({ appRoles: ["ADMIN"] } as any);
    permission.verifyAppRoles.mockReturnValue(true);
    prisma.workoutPlan.findUnique.mockResolvedValue({
      userId: 1,
      sharedWith: [],
    } as any);
    prisma.workoutPlan.update.mockResolvedValue({ id: 1 } as any);
    prisma.workoutPlanExercise.deleteMany.mockResolvedValue({} as any);
    const spy = jest
      .spyOn(service, "getWorkoutPlanById")
      .mockResolvedValue({ id: 1 } as any);

    await service.updateWorkoutPlan(1, 1, {
      name: "Updated",
      trainingGoalId: 1,
      muscleGroupIds: [],
      exercises: [
        {
          exerciseId: 2,
          targetSets: 3,
          targetMetrics: [{ metricId: 1, min: 5, max: 10 }],
          groupId: "g123",
        },
      ],
    } as any);

    expect(prisma.workoutPlanExercise.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ groupId: null }),
      ]),
    });
    expect(spy).toHaveBeenCalledWith(1, 1);
  });

  test("shareWorkoutPlan delegates to sharing service", async () => {
    permission.getUserRoles.mockResolvedValue({ appRoles: ["ADMIN"] } as any);
    permission.verifyAppRoles.mockReturnValue(true);
    prisma.workoutPlan.findUnique.mockResolvedValue({
      userId: 1,
      sharedWith: [],
    } as any);
    sharing.shareWorkoutPlan.mockResolvedValue({ id: 1 } as any);
    const res = await service.shareWorkoutPlan(1, 2, 3);
    expect(sharing.shareWorkoutPlan).toHaveBeenCalledWith(1, 2, 3, "VIEW");
    expect(res).toEqual({ id: 1 });
  });

  test("createTrainingMethod validates and creates", async () => {
    prisma.trainingMethod.create.mockResolvedValue({ id: 1 } as any);
    const ctx = { appRole: "ADMIN", userRole: "USER", gymRoles: [] } as any;
    const res = await service.createTrainingMethod(ctx, {
      name: "n",
      slug: "s",
    } as any);
    expect(mockedValidate).toHaveBeenCalledWith(
      { name: "n", slug: "s" },
      CreateTrainingMethodDto
    );
    expect(res).toEqual({ id: 1 });
  });

  test("updateTrainingMethod validates and updates", async () => {
    prisma.trainingMethod.update.mockResolvedValue({ id: 1 } as any);
    const ctx = { appRole: "ADMIN", userRole: "USER", gymRoles: [] } as any;
    const res = await service.updateTrainingMethod(ctx, 1, {
      name: "n",
    } as any);
    expect(mockedValidate).toHaveBeenCalledWith(
      { name: "n" },
      UpdateTrainingMethodDto
    );
    expect(res).toEqual({ id: 1 });
  });

  test("shareWorkoutProgram makes program public when no user", async () => {
    prisma.workoutProgram.findUnique.mockResolvedValue({
      id: 1,
      userId: 1,
    } as any);
    prisma.workoutProgram.update.mockResolvedValue({ id: 1 } as any);
    const res = await service.shareWorkoutProgram(1, 2, null);
    expect(prisma.workoutProgram.update).toHaveBeenCalledWith({
      where: { id: 2 },
      data: {},
    });
    expect(res).toEqual({ id: 1 });
  });
});
