import * as opossum from 'opossum';
import { Logger } from '@nestjs/common';

// Dùng opossum.Options từ namespace
export interface CircuitBreakerOptions extends opossum.Options {
  name: string;
}

export function createCircuitBreaker<TI extends any[], TR>(
  action: (...args: TI) => Promise<TR>,
  options: CircuitBreakerOptions,
): opossum<TI, TR> {
  const logger = new Logger(`CircuitBreaker[${options.name}]`);
  
  const defaultOptions: opossum.Options = {
    timeout: 5000,
    errorThresholdPercentage: 50,
    resetTimeout: 30000,
    ...options,
  };

  // Sử dụng (opossum.default || opossum) để tránh lỗi 'is not a constructor'
  const CircuitBreakerClass = (opossum as any).default || opossum;
  const breaker = new CircuitBreakerClass(action, defaultOptions);

  breaker.on('open', () => logger.warn(`Circuit is OPEN. Fast failing requests.`));
  breaker.on('halfOpen', () => logger.log(`Circuit is HALF-OPEN. Testing next request.`));
  breaker.on('close', () => logger.log(`Circuit is CLOSED. Resuming normal operations.`));
  breaker.on('fallback', (result: any, err?: Error) => {
    logger.warn(`Fallback triggered: ${err?.message || 'Unknown reason'}`);
  });

  return breaker as unknown as opossum<TI, TR>;
}