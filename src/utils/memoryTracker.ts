export function startMemoryLogger(intervalMs = 5 * 60 * 1000): void {
  setInterval(() => {
    const { maxRSS } = process.resourceUsage();
    const mb = (maxRSS / 1024).toFixed(2);
    console.log(`[Memory] Peak RSS: ${mb} MB`);
  }, intervalMs).unref();
}