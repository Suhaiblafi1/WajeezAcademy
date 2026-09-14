/* زرُّ المفضّلة — قلبٌ يمتلئ عند الحفظ (ع-٨).

   المسجَّل: تُقلب الحالةُ فورا. الزائر: بوّابةُ تسجيلٍ منبثقة، وعند إتمامها
   يُحفظ ما أراده تلقائيا — لا يفقد نيّته. وهو ما يقصده ع-٨ بقوله إنّ الحساب
   لا يُولد فارغا: من أنشأه من هنا أنشأه **على شيءٍ أعجبه**، لا على نموذجٍ خالٍ.

   ويُركَّب على المسار وعلى الدورة معا — كان على المسار وحدَه، فمن رأى دورةً
   تناسبه لم يجد بابا يحفظها به. */

import { useEffect, useState, useSyncExternalStore } from "react";
import { Heart } from "lucide-react";
import AuthGate from "@/components/AuthGate";
import Modal from "@/components/Modal";
import {
  favoriteUserKey, isFavorite, toggleFavorite, onFavoritesChanged, loadFavorites, resetFavorites,
} from "@/services/favorites";
import type { FavoriteKind } from "@/application/catalog/favorites";

const KIND_WORD: Record<FavoriteKind, string> = {
  pathway: "مسار",
  course: "دورة",
};

export default function FavoriteButton({
  kind = "pathway",
  refId,
  title,
  className = "",
}: {
  kind?: FavoriteKind;
  refId: string;
  title: string;
  className?: string;
}) {
  /* الحالةُ تُقرأ من المخزن مباشرة — أيُّ زرٍّ آخرَ للشيء نفسِه يزامن هذا */
  const fav = useSyncExternalStore(onFavoritesChanged, () => isFavorite(kind, refId));
  const [showAuth, setShowAuth] = useState(false);

  useEffect(() => { void loadFavorites(); }, []);

  const word = KIND_WORD[kind];

  const toggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!favoriteUserKey()) {
      setShowAuth(true);
      return;
    }
    toggleFavorite(kind, refId);
  };

  return (
    <>
      <button
        onClick={toggle}
        aria-pressed={fav}
        aria-label={fav ? `أزل «${title}» من المفضلة` : `أضف «${title}» إلى المفضلة`}
        title={fav ? "في مفضلتك" : "أضف إلى المفضلة"}
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border transition ${
          fav
            ? "border-gold/60 bg-gold/15 text-gold-ink"
            : "border-white/10 bg-white/[0.04] text-muted-foreground hover:border-gold/50 hover:text-gold-ink"
        } ${className}`}
      >
        <Heart className={`h-4 w-4 ${fav ? "fill-current" : ""}`} />
      </button>

      {showAuth && (
        <Modal onClose={() => setShowAuth(false)} label={`سجّل لحفظ ال${word} في مفضلتك`} panelClassName="w-full max-w-md">
          <AuthGate
            message={`سجّل دخولك أو أنشئ حسابك ليُحفظ «${title}» في مفضلتك ويعود إليك متى شئت.`}
            source="favorite_gate"
            onDone={() => {
              setShowAuth(false);
              /* الجلسةُ تغيّرت — تُحمَّل مفضّلتُه أوّلا ثمّ يُحفظ ما جاء لأجله،
                 وإلّا قلب التحميلُ بعدَه ما حُفظ توّا. */
              resetFavorites();
              void loadFavorites().then(() => toggleFavorite(kind, refId));
            }}
          />
        </Modal>
      )}
    </>
  );
}
