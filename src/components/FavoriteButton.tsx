/* زر مفضلة المسار — قلب يمتلئ عند الحفظ.
   المسجّل: تُقلب الحالة فورا. الزائر: بوابة تسجيل منبثقة، وعند إتمامها
   يُحفظ المسار في مفضلته تلقائيا — لا يفقد نيته. */

import { useState, useSyncExternalStore } from "react";
import { Heart } from "lucide-react";
import AuthGate from "@/components/AuthGate";
import Modal from "@/components/Modal";
import { favoriteUserKey, isFavorite, toggleFavorite, onFavoritesChanged } from "@/services/favorites";

export default function FavoriteButton({
  pathwayId,
  pathwayName,
  className = "",
}: {
  pathwayId: string;
  pathwayName: string;
  className?: string;
}) {
  /* الحالة تُقرأ من المخزن مباشرة — أي زر آخر لنفس المسار يزامن هذا تلقائيا */
  const fav = useSyncExternalStore(onFavoritesChanged, () => isFavorite(pathwayId));
  const [showAuth, setShowAuth] = useState(false);

  const toggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!favoriteUserKey()) {
      setShowAuth(true);
      return;
    }
    toggleFavorite(pathwayId);
  };

  return (
    <>
      <button
        onClick={toggle}
        aria-pressed={fav}
        aria-label={fav ? `أزل «${pathwayName}» من المفضلة` : `أضف «${pathwayName}» إلى المفضلة`}
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
        <Modal onClose={() => setShowAuth(false)} label="سجّل لحفظ المسار في مفضلتك" panelClassName="w-full max-w-md">
          <AuthGate
            message={`سجّل دخولك أو أنشئ حسابك ليُحفظ مسار «${pathwayName}» في مفضلتك ويعود إليك متى شئت.`}
            source="favorite_gate"
            onDone={() => {
              setShowAuth(false);
              toggleFavorite(pathwayId);
            }}
          />
        </Modal>
      )}
    </>
  );
}
