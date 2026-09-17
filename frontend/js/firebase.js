import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getAnalytics, isSupported } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-analytics.js";
import {
  getAuth,
  GoogleAuthProvider,
  OAuthProvider
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

if (location.protocol !== "file:" && (location.hostname === "127.0.0.1" || location.hostname === "[::1]")) {
  const port = location.port ? `:${location.port}` : "";
  location.replace(`${location.protocol}//localhost${port}${location.pathname}${location.search}${location.hash}`);
}

const firebaseConfig = {
  apiKey: "AIzaSyD37BJftcx3nsgA9pHWx0IzaR5sPeO8azg",
  authDomain: "vita-9d234.firebaseapp.com",
  projectId: "vita-9d234",
  storageBucket: "vita-9d234.firebasestorage.app",
  messagingSenderId: "1047589346293",
  appId: "1:1047589346293:web:2987cb1a1024e500535ebc",
  measurementId: "G-WQ4WK40KYK"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope("email");
googleProvider.addScope("profile");
googleProvider.setCustomParameters({ prompt: "select_account" });

export const appleProvider = new OAuthProvider("apple.com");
appleProvider.addScope("email");
appleProvider.addScope("name");

isSupported()
  .then((ok) => { if (ok) getAnalytics(app); })
  .catch(() => {});
