import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCc_y27aeSbmGINfUwNfHHCRar54xK8XfM",
  authDomain: "mindease-2d2ac.firebaseapp.com",
  projectId: "mindease-2d2ac",
  storageBucket: "mindease-2d2ac.firebasestorage.app",
  messagingSenderId: "464909176395",
  appId: "1:464909176395:web:47fdd09072cae56590c7ce",
  measurementId: "G-E1ZSBQLLXL"
};

export const app = initializeApp(firebaseConfig);
export const analytics = getAnalytics(app);
export const auth = getAuth(app);
export const db = getFirestore(app);
