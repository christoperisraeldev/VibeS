import { initializeApp, type FirebaseApp } from "firebase/app";
import { getDatabase, ref, onValue, update, type Database } from "firebase/database";
import { 
  getAuth, 
  onAuthStateChanged, 
  type User as FirebaseUser,
  type Auth
} from "firebase/auth";

interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  databaseURL: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

const firebaseConfig: FirebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

const app: FirebaseApp = initializeApp(firebaseConfig);
const database: Database = getDatabase(app);
const auth: Auth = getAuth(app);

export interface Profile {
  email: string;
  full_name?: string;
  university?: string;
  avatar_url?: string;
  created_at?: string;
}

export const initAuthState = (callback: (user: FirebaseUser | null) => void) => {
  return onAuthStateChanged(auth, (user) => {
    if (user) {
      initializeUserProfile(user);
    }
    callback(user);
  });
};

const initializeUserProfile = (user: FirebaseUser) => {
  const profileRef = ref(database, `profiles/${user.uid}`);
  
  onValue(profileRef, (snapshot) => {
    if (!snapshot.exists()) {
      const newProfile: Profile = {
        email: user.email || '',
        created_at: new Date().toISOString()
      };
      
      if (user.displayName) {
        newProfile.full_name = user.displayName;
      }
      
      update(profileRef, newProfile).catch(console.error);
    }
  }, { onlyOnce: true });
};

export { database, auth, app };
export type { FirebaseUser };