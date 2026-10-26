/* روابطُ ملفّ المدرّب، ومن يفتح منه «الاتفاقية» وحدَها (قرارُ صاحب المنصّة «a»، ٢٦ أكتوبر ٢٠٢٦).

   سُئل: الأجرُ يُضبط في «الاتفاقية» من ملفّ المدرّب وحدَها، ويضبطه المديرُ الأكاديميُّ أو الماليّة (قرارُ «C») — والماليّةُ
   لا تفتح الملفّ: فيه طلبُه ومقابلتُه ووثائقُه، وبابُه `trainer.applications.view`. أين تغيّر الماليّةُ أجرا؟ فقال «a»:
   تفتح «الاتفاقية» وحدَها. فمن يضبط الأجرَ أو يركّب العقدَ ولا يقرأ الطلبات يُفتح له الملفُّ على «الاتفاقية» وحدَها
   (`TrainerAgreementOnly.tsx`) — ومن يقرأ الطلبات يُفتح له الملفُّ كلُّه كما كان. */

/** يفتح «الاتفاقية» وحدَها: يضبط الأجرَ أو يركّب العقدَ، ولا يقرأ الطلبات */
export function opensAgreementOnly(permissions: readonly string[]): boolean {
  if (permissions.includes('trainer.applications.view')) return false
  return permissions.includes('trainer.compensation.manage') || permissions.includes('trainer.contract.manage')
}

/** «الاتفاقية» في ملفّه — حيث يُضبط أجرُه وحدَها */
export function agreementHref(applicationId: string): string {
  return `/admin/trainers/${encodeURIComponent(applicationId)}?tab=agreement`
}

/** عقودُه في «العقود» — بحثا باسمه، أو مُركِّبا له (`prepare`) */
export function contractsHref(a: { id: string; fullName: string }, act: 'contract_new' | 'contract'): string {
  return `/admin/trainer-contracts?q=${encodeURIComponent(a.fullName)}${act === 'contract_new' ? `&prepare=${a.id}` : ''}`
}
