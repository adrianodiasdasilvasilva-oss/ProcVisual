import { db } from '../firebase';
import { doc, getDoc, setDoc, getDocs, collection, query, where, serverTimestamp } from 'firebase/firestore';

export interface UserAccessStatus {
  granted: boolean;
  reason: 'active' | 'trial_active' | 'trial_expired' | 'phone_blocked' | 'inactive';
  daysLeft?: number;
}

/**
 * Standardizes a phone number to digits only, normalizing DDD + number (10 or 11 digits).
 */
export function normalizePhone(phone: string): string {
  if (!phone) return '';
  let clean = phone.replace(/\D/g, '');
  if (clean.startsWith('55') && clean.length >= 12) {
    clean = clean.substring(2);
  }
  return clean;
}

/**
 * Gets the exact trial end Date for a user profile.
 */
export function getTrialEndDate(profile: any): Date | null {
  if (!profile) return null;
  if (profile.trialEndsAt) {
    const d = new Date(profile.trialEndsAt);
    if (!isNaN(d.getTime())) return d;
  }
  if (profile.dataCriacao) {
    const created = profile.dataCriacao.toDate ? profile.dataCriacao.toDate() : new Date(profile.dataCriacao);
    if (!isNaN(created.getTime())) {
      return new Date(created.getTime() + 7 * 24 * 60 * 60 * 1000);
    }
  }
  if (profile.createdAt) {
    const created = profile.createdAt.toDate ? profile.createdAt.toDate() : new Date(profile.createdAt);
    if (!isNaN(created.getTime())) {
      return new Date(created.getTime() + 7 * 24 * 60 * 60 * 1000);
    }
  }
  return null;
}

/**
 * Checks if a user profile currently has valid trial access or paid access.
 */
export function checkUserAccess(profile: any): UserAccessStatus {
  if (!profile) return { granted: false, reason: 'inactive' };

  // 1. Paid or explicitly activated by admin
  if (profile.isActive === true) {
    return { granted: true, reason: 'active' };
  }

  // 2. Phone anti-fraud block
  if (profile.trialBlockedReason === 'telefone_ja_cadastrado') {
    return { granted: false, reason: 'phone_blocked' };
  }

  // 3. Evaluate 7 days free trial
  const now = new Date();
  let endsAt: Date | null = null;

  if (profile.trialEndsAt) {
    endsAt = new Date(profile.trialEndsAt);
  } else if (profile.dataCriacao) {
    const created = profile.dataCriacao.toDate ? profile.dataCriacao.toDate() : new Date(profile.dataCriacao);
    endsAt = new Date(created.getTime() + 7 * 24 * 60 * 60 * 1000);
  } else if (profile.createdAt) {
    const created = profile.createdAt.toDate ? profile.createdAt.toDate() : new Date(profile.createdAt);
    endsAt = new Date(created.getTime() + 7 * 24 * 60 * 60 * 1000);
  }

  if (endsAt && !isNaN(endsAt.getTime())) {
    const diffMs = endsAt.getTime() - now.getTime();
    if (diffMs > 0) {
      const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      return { granted: true, reason: 'trial_active', daysLeft };
    } else {
      return { granted: false, reason: 'trial_expired', daysLeft: 0 };
    }
  }

  return { granted: false, reason: 'inactive' };
}

/**
 * Anti-fraud mechanism: Checks if the phone number was already used in another account for a trial.
 * If new, registers the phone in `telefones_testados`.
 * If existing in another user's account, denies trial.
 */
export async function checkAndRegisterPhoneTrial(
  phone: string, 
  userId: string, 
  userEmail: string
): Promise<{ allowed: boolean; reason?: 'phone_already_used' }> {
  const norm = normalizePhone(phone);
  if (!norm || norm.length < 8) return { allowed: true }; // No valid phone provided

  try {
    // Check telefones_testados collection
    const phoneRef = doc(db, 'telefones_testados', norm);
    const phoneSnap = await getDoc(phoneRef);

    if (phoneSnap.exists()) {
      const data = phoneSnap.data();
      if (data.firstUserId && data.firstUserId !== userId && data.firstEmail !== userEmail) {
        return { allowed: false, reason: 'phone_already_used' };
      }
    }

    // Secondary check: query usuarios collection for matching phone
    const usuariosRef = collection(db, 'usuarios');
    const q1 = query(usuariosRef, where('telefone', '==', norm));
    const snap1 = await getDocs(q1);

    const otherUserDoc = snap1.docs.find(d => d.id !== userId && d.data().email !== userEmail);
    if (otherUserDoc) {
      await setDoc(phoneRef, {
        phone: norm,
        firstUserId: otherUserDoc.id,
        firstEmail: otherUserDoc.data().email || '',
        createdAt: serverTimestamp()
      }, { merge: true });
      return { allowed: false, reason: 'phone_already_used' };
    }

    // Phone is clean & new! Register it for this user
    await setDoc(phoneRef, {
      phone: norm,
      firstUserId: userId,
      firstEmail: userEmail,
      createdAt: serverTimestamp()
    }, { merge: true });

    return { allowed: true };
  } catch (error) {
    console.error('Error checking phone anti-fraud:', error);
    return { allowed: true };
  }
}
