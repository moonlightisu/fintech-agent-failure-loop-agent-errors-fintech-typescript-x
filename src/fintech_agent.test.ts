import assert from "node:assert/strict";
import { decidePayment } from "./fintech_agent.js";

const payment = { payment_id: "pay_test", customer_id: "cus_test", amount: 15000, currency: "USD", merchant_country: "GB" };
assert.equal(decidePayment(payment, true), "review");
assert.equal(decidePayment(payment, false), "approve");
console.log("payment risk decision test passed");
