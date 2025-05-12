import type { AuthContext } from "../auth/auth.types";
import { pubsub } from "../../graphql/rootResolvers";
import { UserService } from "./user.service";

export const UserResolvers = {
  User: {
    gymManagementRoles: (parent: any, _: any, context: AuthContext) => {
      return context.prisma.gymManagementRole.findMany({
        where: { userId: parent.id },
        include: { gym: true },
      });
    },
  },

  Query: {
    users: async (_: unknown, args: { search?: string }, context: AuthContext) => {
      const userService = new UserService(context.prisma);
      return userService.searchUsers(context, args.search);
    },

    userById: async (_: unknown, args: { id: number }, context: AuthContext) => {
      const userService = new UserService(context.prisma);
      return userService.getUserById(context, args.id);
    },
  },

  Mutation: {
    deleteUser: async (_: unknown, args: { id: number }, context: AuthContext) => {
      const userService = new UserService(context.prisma);
      await userService.deleteUser(context, args.id);
      return "User deleted successfully";
    },

    updateUserRoles: async (
      _: unknown,
      args: { userId: number; input: { appRole?: string; userRole: string } },
      context: AuthContext
    ) => {
      const userService = new UserService(context.prisma);

      const updatedUser = await userService.updateUserRoles(context, {
        userId: args.userId,
        ...args.input,
      });

      await pubsub.publish("USER_ROLE_UPDATED", { userRoleUpdated: updatedUser });
      await pubsub.publish("USER_UPDATED", { userUpdated: updatedUser });

      return updatedUser;
    },
  },
};
