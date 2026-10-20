import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyA492ERvgGRaD-d7b9QE6BHg5RFBALOB9Y',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'up2-nz.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'up2-nz',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'up2-nz.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '701452296012',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:701452296012:web:c76cb5fcd047e1e15eb9e9',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-5QZXG3ZP4F',
};

const missing = Object.entries(firebaseConfig).filter(([key, value]) => key !== 'measurementId' && !value).map(([key]) => key);
if (missing.length) console.warn(`UP2 Firebase config is missing: ${missing.join(', ')}. Copy .env.example to .env.local and fill it in.`);

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();
