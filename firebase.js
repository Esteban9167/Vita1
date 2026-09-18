import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getAnalytics, isSupported } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-analytics.js";
import {
  initializeAuth,
  getAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  browserPopupRedirectResolver,
  GoogleAuthProvider,
  OAuthProvider
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD37BJftcx3nsgA9pHWx0IzaR5sPeO8azg",
  authDomain: "vita-9d234.firebaseapp.com",
  projectId: "vita-9d234",
  storageBucket: "vita-9d234.firebasestorage.app",
  messagingSenderId: "1047589346293",
  appId: "1:1047589346293:web:58a17373f4a247a8535ebc",
  measurementId: "G-YT9KJRGL2M"
};

export const app = initializeApp(firebaseConfig);
export const auth = (() => {
  try {
    return initializeAuth(app, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence],
      popupRedirectResolver: browserPopupRedirectResolver
    });
  } catch {
    return getAuth(app);
  }
})();
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
