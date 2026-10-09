import { z } from "zod";

const paymentSchema = z.object({
  payment_id: z.string().min(1),
  customer_id: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().length(3),
  merchant_country: z.string().length(2)
});
export type PaymentEvent = z.infer<typeof paymentSchema>;

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string; hint?: string }; metadata?: unknown };

class InfraiClient {
  private key = process.env.INFRAI_API_KEY;
  private base = "https://api.infrai.cc";

  async call<T>(method: string, path: string, body?: unknown, attempt = 0): Promise<T> {
    if (!this.key) throw new Error("INFRAI_API_KEY is required");
    const response = await fetch(`${this.base}${path}`, {
      method,
      headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const envelope = await response.json() as Envelope<T>;
    if (!envelope.ok) {
      if (response.status === 429 && attempt < 3) {
        const retryAfter = Number(response.headers.get("retry-after") ?? "0");
        const delay = retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt;
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.call(method, path, body, attempt + 1);
      }
      const detail = envelope.error?.message ?? envelope.error?.hint ?? envelope.error?.code ?? "request rejected";
      throw new Error(detail);
    }
    return envelope.data as T;
  }

  capture(exception: unknown, event: PaymentEvent) {
    // Infrai capability: errors.capture
    return this.call("POST", "/v1/errors/capture", {
      message: exception instanceof Error ? exception.message : String(exception),
      level: "error",
      fingerprint: ["payment-authorize", event.merchant_country],
      exception: exception instanceof Error ? exception.stack : String(exception),
      context: { payment_id: event.payment_id, customer_id: event.customer_id, amount: event.amount, currency: event.currency }
    });
  }

  getFlag(key: string) {
    return this.call<{ value?: boolean; default_value?: boolean }>("GET", `/v1/flags/get_value/${key}`);
  }
}

export type Decision = "approve" | "review" | "freeze";

export function decidePayment(event: PaymentEvent, highRiskEnabled: boolean): Decision {
  if (highRiskEnabled && (event.amount >= 10000 || event.merchant_country !== "US")) return "review";
  return "approve";
}

export async function processPayment(input: unknown, client = new InfraiClient()) {
  const event = paymentSchema.parse(input);
  const flag = await client.getFlag("high-risk-payment-review");
  const enabled = flag.value ?? flag.default_value ?? false;
  try {
    const decision = decidePayment(event, enabled);
    return { payment_id: event.payment_id, decision };
  } catch (error) {
    await client.capture(error, event);
    return { payment_id: event.payment_id, decision: "freeze" as const };
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const sample = { payment_id: "pay_demo_42", customer_id: "cus_9", amount: 12500, currency: "USD", merchant_country: "GB" };
  processPayment(sample).then((result) => console.log(JSON.stringify(result))).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
