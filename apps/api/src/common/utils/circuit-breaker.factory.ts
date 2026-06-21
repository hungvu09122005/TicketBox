import CircuitBreaker from 'opossum';
import { Logger } from '@nestjs/common';

export interface CircuitBreakerOptions extends CircuitBreaker.Options {
  name: string;
}

export function createCircuitBreaker<TI extends any[], TR>(
  action: (...args: TI) => Promise<TR>,
  options: CircuitBreakerOptions,
): CircuitBreaker<TI, TR> {
  const logger = new Logger(`CircuitBreaker[${options.name}]`);
  
  const defaultOptions: CircuitBreaker.Options = {
    timeout: 5000,               // Default timeout 5s
    errorThresholdPercentage: 50, // Default 50% errors to open circuit
    resetTimeout: 30000,         // Wait 30s before trying half-open
    ...options,
  };

  const breaker = new CircuitBreaker(action as any, defaultOptions);

  breaker.on('open', () => logger.warn(`Circuit is OPEN. Fast failing requests.`));
  breaker.on('halfOpen', () => logger.log(`Circuit is HALF-OPEN. Testing next request.`));
  breaker.on('close', () => logger.log(`Circuit is CLOSED. Resuming normal operations.`));
  breaker.on('fallback', (result, err) => logger.warn(`Fallback triggered: ${err?.message || 'Unknown reason'}`));

  return breaker as unknown as CircuitBreaker<TI, TR>;
}
