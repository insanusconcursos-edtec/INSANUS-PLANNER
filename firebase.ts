
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDVkB1MEdQCmvsklNioYud7Tmvm7yKqYng",
  authDomain: "sistema-de-planner-insanus.firebaseapp.com",
  projectId: "sistema-de-planner-insanus",
  storageBucket: "sistema-de-planner-insanus.firebasestorage.app",
  messagingSenderId: "435070796",
  appId: "1:435070796:web:a52fbb8d55ce5769c191e9",
  measurementId: "G-QRX8EY58RV"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
