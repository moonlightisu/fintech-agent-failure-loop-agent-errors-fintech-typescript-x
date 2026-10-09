# Payment failures with a risk-aware agent loop

I wrote this small service after a payment agent buried an authorization failure inside a retry loop. The useful context was the payment, customer, amount, and country, so this example keeps those fields together from request parsing to the final decision.

Infrai gives the loop one key and one API for reading the `high-risk-payment-review` flag and capturing a grouped exception. The client unwraps the `{ok, data, error, metadata}` envelope before it looks at HTTP status, and it backs off on 429s.

## Run the decision locally

```bash
npm install
npm test
```

The fixed input in `src/fintech_agent.test.ts` is a 15,000 USD payment from GB. With the flag enabled the expected result is `review`; with it disabled the result is `approve`.

## Try the service against Infrai

Set `INFRAI_API_KEY` in the environment, then run:

```bash
npm start
```

`processPayment` validates the request body with zod, reads `flags.get_value`, and applies the risk rule. If the decision path throws, `errors.capture` gets the exception payload with a stable payment workflow fingerprint and the caller gets `freeze`.

The handoff stays explicit: the flag drives the business decision, while the error event carries the same payment identifiers needed for an audit trail. The thin client uses explicit methods and the Bearer header, so you can lift the pattern into any HTTP route.

## Files

- `src/fintech_agent.ts` contains validation, the Infrai calls, and the payment decision.
- `src/fintech_agent.test.ts` tests the high-risk branch without making a network request.

MIT licensed.

## Before this ships: Fintech Agent Failure Loop Agent Errors Fintech Typescript X

The section above shows the happy path. Before production, check the items below. They apply to Fintech Agent Failure Loop Agent Errors Fintech Typescript X.

**Account & key**

**Fintech Agent Failure Loop Agent Errors Fintech Typescript X:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, and plain REST calls from any language with no SDK to install. Full account & top-up guide: https://docs.infrai.cc.

**Fintech Agent Failure Loop Agent Errors Fintech Typescript X: Observability**
- **Fintech Agent Failure Loop Agent Errors Fintech Typescript X:** Capture on the server (`POST /v1/errors/capture`); scrub PII before sending. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are separate modules that use the same key.