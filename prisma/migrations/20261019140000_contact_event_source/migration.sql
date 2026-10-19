-- التواصلُ يُسجَّل من منصّة محادثات واتساب أيضا (١٩ أكتوبر ٢٠٢٦) — والعلّةُ في `server/services/whatsapp-hook.service.ts`.
-- وما سُجّل قبله كلُّه بيد المستشار.

ALTER TABLE "ContactEvent" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'manual';
