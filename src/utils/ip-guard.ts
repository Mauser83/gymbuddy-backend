import * as ipaddr from 'ipaddr.js';
import { promises as dns } from 'node:dns';

export function isPublicIp(ip: string): boolean {
  if (!ipaddr.isValid(ip)) return false;
  const addr = ipaddr.parse(ip);
  const range = addr.range();
  return !['private', 'loopback', 'linkLocal', 'multicast', 'reserved', 'uniqueLocal'].includes(
    range,
  );
}

export async function allResolvedIpsArePublic(host: string): Promise<boolean> {
  const records = await dns.lookup(host, { all: true });
  return records.every((r) => isPublicIp(r.address));
}
