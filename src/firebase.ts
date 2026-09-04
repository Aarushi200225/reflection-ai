import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOut, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, initializeFirestore } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "gen-lang-client-0057557227",
  appId: "1:428689761489:web:6afd57db249afa151711f0",
  apiKey: "AIzaSyBUd36gUgoC_HCxtOG98OuNAWrumZF2JoM",
  authDomain: "gen-lang-client-0057557227.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-b90bb679-8d64-4823-92a7-aae7933e1021",
  storageBucket: "gen-lang-client-0057557227.firebasestorage.app",
  messagingSenderId: "428689761489",
  measurementId: "",
  oAuthClientId: "428689761489-uvpnvsnfecq7dti4drf5nadmneb3p9pg.apps.googleusercontent.com",
  recaptchaSiteKey: ""
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore with specific database ID if configured
export const db = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    console.error('Authentication Error:', error);
    throw error;
  }
};

export const signOut = async () => {
  try {
    await firebaseSignOut(auth);
  } catch (error: any) {
    console.error('Sign Out Error:', error);
    throw error;
  }
};

export { onAuthStateChanged, type User };

// Fetch with the current user's Firebase ID token attached (for agent-tier auth).
export async function authedFetch(url: string, body: any) {
  const user = auth.currentUser;
  if (!user) throw new Error('You must be signed in.');
  const token = await user.getIdToken();
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  return res;
}
