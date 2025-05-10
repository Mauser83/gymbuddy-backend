import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { prisma } from '../src/lib/prisma';
import resolvers from '../src/graphql/rootResolvers';
import typeDefs from '../src/graphql/rootSchema';
import { PermissionService } from '../src/modules/core/permission.service';
import { AuthContext, UserRole } from '../src/modules/auth/auth.types';
import { getPort } from 'get-port-please';

async function cleanDatabase() {
  // Delete in proper order to respect foreign key constraints
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.gymManagementRole.deleteMany(),
    prisma.exerciseLog.deleteMany(),
    prisma.workoutPlan.deleteMany(),
    prisma.exercise.deleteMany(),
    prisma.equipment.deleteMany(),
    prisma.gym.deleteMany(),
    prisma.user.deleteMany()
  ]);
}

export default async function () {
  try {
    // Initialize ApolloServer
    const testServer = new ApolloServer<AuthContext>({
      typeDefs,
      resolvers,
    });

    // Get available port
    const port = await getPort({ 
      port: 5000,
      portRange: [5000, 6000],
      random: true
    });

    // Start server
    const { url } = await startStandaloneServer(testServer, {
      listen: { port },
      context: async () => ({
        prisma,
        permissionService: new PermissionService(prisma),
        userId: '1',
        userRole: UserRole.USER,
        isPremium: true,
        gymRoles: [],
        isSubscribed: false
      } as AuthContext)
    });

    console.log(`Test server running on port ${port}`);

    // Clean database before any tests run
    await cleanDatabase();

    // Store test utilities globally
    const testUtils = {
      testServer,
      testUrl: url,
      prisma
    };
    (global as any).__TEST_UTILS__ = testUtils;

    return testUtils;
  } catch (error) {
    console.error('Error during test setup:', error);
    process.exit(1);
  }
}