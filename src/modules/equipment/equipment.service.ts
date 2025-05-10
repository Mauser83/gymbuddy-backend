import { PrismaClient } from '../../lib/prisma';
import { CreateEquipmentInput, UpdateEquipmentInput } from './equipment.types';
import { CreateEquipmentDto, UpdateEquipmentDto } from './equipment.dto';
import { validateInput } from '../../middlewares/validation';
import { AuthContext } from '../auth/auth.types';
import { PermissionService } from '../core/permission.service';
import { verifyRoles } from '../auth/auth.roles';
import { verifyGymScope } from '../auth/auth.roles';
import { GymRole } from '../auth/auth.types';

export class EquipmentService {
  private prisma: PrismaClient;
  private permissionService: PermissionService;

  constructor(prisma: PrismaClient, permissionService: PermissionService) {
    this.prisma = prisma;
    this.permissionService = permissionService;
  }

  async createEquipment(input: CreateEquipmentInput, context: AuthContext) {
    await validateInput(input, CreateEquipmentDto);

    if (input.gymId) {
      if (context.appRole !== 'ADMIN') {
        await verifyGymScope(context, this.permissionService, input.gymId.toString(), [GymRole.GYM_ADMIN]);
      }
    } else {
      verifyRoles(context, { requireAppRole: 'ADMIN' });
    }

    return this.prisma.equipment.create({
      data: {
        ...input,
        gymId: input.gymId ?? null,
      },
    });
  }

  async getEquipment(id: number) {
    return this.prisma.equipment.findUnique({
      where: { id },
    });
  }

  async getAllEquipments() {
    return this.prisma.equipment.findMany();
  }

  async updateEquipment(id: number, input: UpdateEquipmentInput, context: AuthContext) {
    await validateInput(input, UpdateEquipmentDto);

    const equipment = await this.prisma.equipment.findUnique({
      where: { id },
      select: { gymId: true },
    });

    if (equipment?.gymId) {
      if (context.appRole !== 'ADMIN') {
        await verifyGymScope(context, this.permissionService, equipment.gymId.toString(), [GymRole.GYM_ADMIN]);
      }
    } else {
      verifyRoles(context, { requireAppRole: 'ADMIN' });
    }

    return this.prisma.equipment.update({
      where: { id },
      data: {
        ...input,
      },
    });
  }

  async deleteEquipment(id: number, context: AuthContext) {
    const equipment = await this.prisma.equipment.findUnique({
      where: { id },
      select: { gymId: true },
    });

    if (equipment?.gymId) {
      if (context.appRole !== 'ADMIN') {
        await verifyGymScope(context, this.permissionService, equipment.gymId.toString(), [GymRole.GYM_ADMIN]);
      }
    } else {
      verifyRoles(context, { requireAppRole: 'ADMIN' });
    }

    return this.prisma.equipment.delete({
      where: { id },
    });
  }
}
