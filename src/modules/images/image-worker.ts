import { PrismaClient } from "../../generated/prisma";
import { QueueRunnerService } from "./queue-runner.service";

const prisma = new PrismaClient();
const queue = new QueueRunnerService(prisma);

function parseArgs() {
  const argv = process.argv.slice(2);
  const once = argv.includes("--once");
  const maxArg = argv.find(a => a.startsWith("--max="));
  const max = maxArg ? Number(maxArg.split("=")[1]) || 50 : 50;
  return { once, max };
}

async function processOnce() {
  const concurrency = Math.max(1, Number(process.env.WORKER_CONCURRENCY ?? 2));
  const jobs = await queue.claimBatch(concurrency);

  await Promise.all(
    jobs.map(async (job) => {
      try {
        // no-op for now — handlers come in Step 3
        // we fail gracefully so claimed jobs go back to pending
        throw new Error("Handlers not implemented yet");
      } catch (err) {
        await queue.markFailed(job.id, err, 30);
      }
    })
  );
}

async function runForever() {
  const intervalMs = 2000;
  for (;;) {
    await processOnce();
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

async function runOnce(maxLoops: number) {
  let loops = 0;
  while (loops < maxLoops) {
    const before = loops;
    await processOnce();
    loops += 1;
    // crude “no more work” breaker: if we didn’t claim anything, break
    // (processOnce() will be fast if queue is empty)
    if (loops === before) break;
  }
}

(async function main() {
  const { once, max } = parseArgs();
  if (once) {
    await runOnce(max);
    process.exit(0);
  } else {
    await runForever();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
