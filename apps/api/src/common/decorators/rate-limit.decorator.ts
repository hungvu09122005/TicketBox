import { SetMetadata } from '@nestjs/common';

export type RateLimitPolicyName = 'public' | 'order' | 'payment' | 'checkin' | 'sync' | 'admin';

export const RATE_LIMIT_POLICY_KEY = 'rate_limit_policy';

export const RateLimitPolicy = (policy: RateLimitPolicyName) => 
  SetMetadata(RATE_LIMIT_POLICY_KEY, policy);
