import net from 'net';

async function killPortProcess(port: number) {
  return new Promise<void>((resolve) => {
    const tester = net.createServer()
      .once('error', () => {
        console.log(`Port ${port} is already free`);
        resolve();
      })
      .once('listening', () => {
        tester.close(() => {
          console.log(`Port ${port} is now free`);
          resolve();
        });
      })
      .listen(port);
  });
}

export default async function () {
  try {
    // Stop test server if exists
    const testServer = (global as any).__TEST_SERVER__;
    if (testServer) {
      await testServer.stop();
      console.log('Test server stopped successfully');
    }

    // Ensure test port is free
    await killPortProcess(5000); 

    // Ensure production port is free
    await killPortProcess(4001);
  } catch (error) {
    console.error('Error during test teardown:', error);
    process.exit(1);
  }
}