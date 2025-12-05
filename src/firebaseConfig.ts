// src/firebaseConfig.ts
import { initializeApp, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth"; // 🎯 NEW: Auth import

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCl0j6-CxUBhgZrFCJRuRbqaeRDcypyvBg",
    authDomain: "ceceauto-86008.firebaseapp.com",
    projectId: "ceceauto-86008",
    storageBucket: "ceceauto-86008.firebasestorage.app",
    messagingSenderId: "562046029503",
    appId: "1:562046029503:web:b8e0825613f1decb9ac00a",
    measurementId: "G-8XH18KC1Y4"
};

// Initialize Firebase only if it hasn't been initialized
let app;
try {
    app = initializeApp(firebaseConfig);
    console.log("Firebase initialized:", app.name);
} catch (error: any) {
    if (error.code === 'app/duplicate-app') {
        console.warn("Firebase app '[DEFAULT]' already initialized, using existing instance.");
        app = getApp();
    } else {
        console.error("Firebase initialization error:", error);
        throw error;
    }
}

// Initialize services
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app); // 🎯 NEW: Initialize Auth

export { app, db, storage, auth };