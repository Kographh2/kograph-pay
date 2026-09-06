import type { IPaymentProvider } from "./types";
import { SaweriaProvider } from "./saweria";
import { MockProvider } from "./mock";
import { getEnv } from "@/lib/env";

let cached: IPaymentProvider | null = null;

export function getPaymentProvider(): IPaymentProvider {
  if (cached) return cached;
  const env = getEnv();
  cached = env.PAYMENT_PROVIDER === "mock" ? new MockProvider() : new SaweriaProvider();
  return cached;
}

export type { IPaymentProvider } from "./types";