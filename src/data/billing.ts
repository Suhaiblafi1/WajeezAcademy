/**
 * طلباتي وفواتيري ودفعاتي — محاكاة مسارات التجارة للمتعلم
 * ------------------------------------------------------------
 * تطابق سلوك الخادم في operations.routes.ts:
 *  - GET /api/learner/orders: طلباتي وفواتيري ودفعاتي في مكان واحد.
 *  - POST /api/learner/orders/:id/pay-test: دفع اختباري عبر المزود التجريبي —
 *    idempotent بمفتاح idempotencyKey: تكرار نفس المفتاح يعيد النتيجة نفسها
 *    ولا ينشئ دفعة مكررة ولا مالا حقيقيا أبدا.
 * عند الربط الحقيقي تُستبدل هذه المخازن بنداءات API.
 */

import { getEnrollment } from "@/services/access";

export interface DemoPayment {
  id: string;
  idempotencyKey: string;
  amount: number;
  method: string;
  status: "success" | "failed";
  at: string;
}

export interface DemoInvoice {
  id: string;
  number: string;
  amount: number;
  currency: string;
  status: "paid" | "open" | "void";
  issuedAt: string;
  payments: DemoPayment[];
}

export interface DemoOrder {
  id: string;
  ref: string;
  itemName: string;
  kind: "pathway" | "course";
  amount: number;
  currency: string;
  status: "paid" | "pending" | "refunded";
  createdAt: string;
  invoice: DemoInvoice;
}

const KEY = "wajeez_learner_orders";
const SAR = "ر.س";

function iso(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function seedOrders(): DemoOrder[] {
  const enr = getEnrollment();
  const firstItem = enr?.pathwayName ?? "مسار الجاهزية المهنية";
  const firstAmount = enr?.amount ?? 2400;
  return [
    {
      id: "ord-1",
      ref: enr?.ref ?? "WJ-2026-0001",
      itemName: firstItem,
      kind: enr?.kind === "course" ? "course" : "pathway",
      amount: firstAmount,
      currency: SAR,
      status: "paid",
      createdAt: iso(-21),
      invoice: {
        id: "inv-1",
        number: "INV-2026-0141",
        amount: firstAmount,
        currency: SAR,
        status: "paid",
        issuedAt: iso(-21),
        payments: [
          { id: "pay-1", idempotencyKey: "seed-payment-0001", amount: firstAmount, method: "بطاقة مدى", status: "success", at: iso(-21) },
        ],
      },
    },
    {
      id: "ord-2",
      ref: "WJ-2026-0002",
      itemName: "القسط الثاني — جلسات الإرشاد الفردي",
      kind: "course",
      amount: 600,
      currency: SAR,
      status: "pending",
      createdAt: iso(-7),
      invoice: {
        id: "inv-2",
        number: "INV-2026-0158",
        amount: 600,
        currency: SAR,
        status: "open",
        issuedAt: iso(-7),
        payments: [],
      },
    },
  ];
}

export function loadOrders(): DemoOrder[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as DemoOrder[];
  } catch { /* ignore */ }
  const seeded = seedOrders();
  localStorage.setItem(KEY, JSON.stringify(seeded));
  return seeded;
}

function saveOrders(orders: DemoOrder[]) {
  localStorage.setItem(KEY, JSON.stringify(orders));
}

export interface PayResult {
  payment: DemoPayment;
  alreadyProcessed: boolean; // true عند تكرار المفتاح — لا خصم مكرر
}

/** دفع اختباري idempotent — نفس مفتاح العملية يعيد نفس النتيجة دون دفعة ثانية */
export function payOrderTest(orderId: string, idempotencyKey: string): PayResult | null {
  const orders = loadOrders();
  const order = orders.find((o) => o.id === orderId);
  if (!order) return null;

  const existing = order.invoice.payments.find((p) => p.idempotencyKey === idempotencyKey && p.status === "success");
  if (existing) return { payment: existing, alreadyProcessed: true };

  const payment: DemoPayment = {
    id: `pay-${Date.now().toString(36)}`,
    idempotencyKey,
    amount: order.invoice.amount,
    method: "مزود اختباري — لا مال حقيقي",
    status: "success",
    at: iso(0),
  };
  order.invoice.payments.push(payment);
  order.invoice.status = "paid";
  order.status = "paid";
  saveOrders(orders);
  return { payment, alreadyProcessed: false };
}

export function newIdempotencyKey(): string {
  return `wajeez-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
