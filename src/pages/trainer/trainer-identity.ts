/* هوية المدرب — منفصلة عن مكون الإطار */

import type { TrainerIdentity } from "@/data/trainer";

export const TRAINER_IDENTITY_KEY = "wajeez_trainer_identity";

export function trainerIdentity(): TrainerIdentity | null {
  try {
    const raw = localStorage.getItem(TRAINER_IDENTITY_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
