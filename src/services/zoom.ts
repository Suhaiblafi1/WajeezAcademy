/**
 * تكامل زووم للجلسات المباشرة — Zoom Adapter
 * -------------------------------------------------------
 * الآن: روابط انضمام تجريبية بصيغة zoom.us حقيقية الشكل.
 * عند الربط الفعلي (يُنفذ server-side على Replit — لا مفاتيح في المتصفح):
 *   1) أنشئ تطبيق Zoom من نوع Server-to-Server OAuth.
 *   2) الخادم ينشئ الاجتماع عبر POST /users/{id}/meetings عند إنشاء الجلسة،
 *      ويخزن join_url مع الجلسة في قاعدة البيانات.
 *   3) هذه الدالة تستبدل بنداء GET /api/sessions/{id}/join الذي يعيد الرابط
 *      بعد التحقق من تسجيل الطالب في الشعبة.
 *   4) الحضور يُوثق لاحقا عبر webhook حدث meeting.participant_joined.
 */

export interface ZoomJoinInfo {
  joinUrl: string;
  meetingId: string;
  passcode: string;
}

export interface ZoomAdapter {
  getJoinInfo(sessionId: string): Promise<ZoomJoinInfo>;
}

const MockZoom: ZoomAdapter = {
  async getJoinInfo(sessionId) {
    await new Promise((r) => setTimeout(r, 80));
    // معرّف اجتماع مشتق من الجلسة ليكون ثابتا وواقعي الشكل
    let hash = 0;
    for (const ch of sessionId) hash = (hash * 31 + ch.charCodeAt(0)) % 1e9;
    const meetingId = String(8e10 + hash).slice(0, 11);
    return {
      joinUrl: `https://zoom.us/j/${meetingId}?pwd=demo`,
      meetingId,
      passcode: "123456",
    };
  },
};

export const zoom: ZoomAdapter = MockZoom;
