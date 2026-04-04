import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, onSnapshot } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAD0EkiilcvLEggUOUclKPEruA77MpyvGc",
  authDomain: "duo-negocios.firebaseapp.com",
  projectId: "duo-negocios",
  storageBucket: "duo-negocios.firebasestorage.app",
  messagingSenderId: "654493922788",
  appId: "1:654493922788:web:1427eb6b2654462c6e43f1"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

export async function guardarFirebase(data) {
  try {
    await setDoc(doc(db, "app", "datos"), data);
  } catch(e) {
    console.error("Error guardando:", e);
  }
}

export function escucharFirebase(callback) {
  return onSnapshot(
    doc(db, "app", "datos"),
    (snap) => { if (snap.exists()) callback(snap.data()); },
    (error) => { console.error("Error:", error); }
  );
}
