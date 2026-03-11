// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCc_y27aeSbmGINfUwNfHHCRar54xK8XfM",
  authDomain: "mindease-2d2ac.firebaseapp.com",
  projectId: "mindease-2d2ac",
  storageBucket: "mindease-2d2ac.firebasestorage.app",
  messagingSenderId: "464909176395",
  appId: "1:464909176395:web:47fdd09072cae56590c7ce",
  measurementId: "G-E1ZSBQLLXL"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
