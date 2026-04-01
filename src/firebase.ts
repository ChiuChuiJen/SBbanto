import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const secondaryApp = initializeApp(firebaseConfig, "Secondary");
export const auth = getAuth(app);
export const secondaryAuth = getAuth(secondaryApp);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
