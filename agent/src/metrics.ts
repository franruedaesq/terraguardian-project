import { Pushgateway, Registry, Counter } from 'prom-client';

const PUSHGATEWAY_URL = 'http://35.159.124.198:9091';

const registry = new Registry();
const gateway = new Pushgateway(PUSHGATEWAY_URL, {}, registry);

export const violationsFound = new Counter({
  name: 'terraguardian_violations_found_total',
  help: 'Total number of governance violations found',
  labelNames: ['mode', 'severity'], // mode = pr-review | live-scan
  registers: [registry],
});

export async function pushMetrics(jobName: string) {
  try {
    await gateway.push({ jobName });
  } catch (error) {
    console.error('Failed to push metrics to Pushgateway:', error);
  }
}