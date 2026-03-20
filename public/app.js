/**
 * MediRepo Universal Platform 4.1 (Premium UX)
 * Implementing human-centric design, data portability, and glassmorphism logic.
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAnalytics, logEvent } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-analytics.js";
import { getStorage, ref, uploadString, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";
import { getRemoteConfig, fetchAndActivate, getNumber } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-remote-config.js";

// Configuration
const firebaseConfig = {
  apiKey: "AIzaSyBemfA6-DM0YyhIkW8NY411khM-qviuhbU",
  authDomain: "hack2skill-main.firebaseapp.com",
  projectId: "hack2skill-main",
  storageBucket: "hack2skill-main.firebasestorage.app",
  messagingSenderId: "1094623345192",
  appId: "1:1094623345192:web:d3b5c91ffa77d2c91d131d",
  measurementId: "G-NKVLMCJ6H4"
};

// Services Initialization
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const analytics = getAnalytics(app);
const storage = getStorage(app);
const remoteConfig = getRemoteConfig(app);

// Global Variables
let currentUser = null;
let currentImageFile = null;
let expiryThreshold = 90;
let inventorySnapshot = [];

/**
 * Friendly Error Mapping (UX Improvement)
 * Converts technical Firebase codes into helpful human guidance.
 */
const getFriendlyError = (code) => {
    switch (code) {
        case 'auth/invalid-credential': return "Oops! Those credentials don't match our records.";
        case 'auth/user-not-found': return "We couldn't find an account with that email.";
        case 'auth/wrong-password': return "That's not the right password. Try again?";
        case 'auth/email-already-in-use': return "This email is already registered. Want to sign in instead?";
        case 'auth/weak-password': return "That password is a bit too easy to guess. Make it stronger!";
        default: return "Something went wrong. Please check your connection and try again.";
    }
};

/**
 * Remote Config Hook
 */
async function initRemoteConfig() {
    try {
        remoteConfig.settings.minimumFetchIntervalMillis = 3600000;
        await fetchAndActivate(remoteConfig);
        expiryThreshold = getNumber(remoteConfig, 'expiry_alert_threshold') || 90;
        document.getElementById('config-threshold').innerText = `Config: ${expiryThreshold}d Alert Active`;
        document.getElementById('config-threshold').classList.add('badge-ready');
    } catch (err) {
        document.getElementById('config-threshold').innerText = `Config: Standard (90d)`;
    }
}
initRemoteConfig();

/**
 * UX Feature: Password Visibility Toggle
 */
const passInput = document.getElementById('pass-input');
const toggleBtn = document.getElementById('toggle-password');
const eyeIcon = document.getElementById('eye-icon');

toggleBtn.addEventListener('click', () => {
    const isPass = passInput.type === 'password';
    passInput.type = isPass ? 'text' : 'password';
    eyeIcon.className = isPass ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
});

/**
 * Data Feature: CSV Export Logic
 */
document.getElementById('download-csv-btn').addEventListener('click', () => {
    if (inventorySnapshot.length === 0) return alert("Nothing to export yet!");
    
    let csv = "Medicine Name,Dosage,Quantity,Expiry Date,Added On\n";
    inventorySnapshot.forEach(item => {
        csv += `"${item.name}","${item.dosage}","${item.quantity}","${item.expiryDate}","${item.timestamp}"\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `medirepo_data_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    logEvent(analytics, 'data_export_csv');
});

/**
 * Google Native Service Shortcuts
 */
document.getElementById('find-pharmacy-btn').addEventListener('click', () => {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(p => {
            window.open(`https://www.google.com/maps/search/pharmacy/@${p.coords.latitude},${p.coords.longitude},15z`);
        }, () => window.open('https://www.google.com/maps/search/pharmacy+near+me'));
    } else {
        window.open('https://www.google.com/maps/search/pharmacy+near+me');
    }
});

document.getElementById('calendar-reminder-btn').addEventListener('click', () => {
    const dates = new Date().toISOString().replace(/-|:|\.\d\d\d/g, "");
    window.open(`https://www.google.com/calendar/render?action=TEMPLATE&text=Medication+Alert+from+MediRepo&dates=${dates}/${dates}`);
});

/**
 * Authentication & State Management
 */
const authSect = document.getElementById('auth-section');
const welcomeIntro = document.getElementById('welcome-intro');
const dashSect = document.getElementById('dashboard-section');
const errBox = document.getElementById('auth-error');
const emailIn = document.getElementById('email-input');

onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user) {
        authSect.classList.add('hidden');
        welcomeIntro.innerHTML = `<h1>Welcome back, <span class="gradient-text">${user.email.split('@')[0]}!</span></h1><p>Your verified medical bridge is active and synced across all devices.</p>`;
        dashSect.classList.remove('hidden');
        document.getElementById('logout-btn').classList.remove('hidden');
        loadMedicines();
    } else {
        authSect.classList.remove('hidden');
        welcomeIntro.innerHTML = `<h1>Turn Messy Data into <span class="gradient-text">Verified Actions</span></h1><p>The MediRepo 'Universal Bridge' uses Gemini AI to instantly convert unstructured medical voice, text, and images into a secure database.</p>`;
        dashSect.classList.add('hidden');
        document.getElementById('logout-btn').classList.add('hidden');
    }
});

const handleAuth = async (promise) => {
    try {
        errBox.classList.add('hidden');
        await promise;
    } catch (err) {
        errBox.innerText = getFriendlyError(err.code);
        errBox.classList.remove('hidden');
    }
};

document.getElementById('login-btn').addEventListener('click', () => handleAuth(signInWithEmailAndPassword(auth, emailIn.value, passInput.value)));
document.getElementById('signup-btn').addEventListener('click', () => handleAuth(createUserWithEmailAndPassword(auth, emailIn.value, passInput.value)));
document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));
document.getElementById('google-login-btn').addEventListener('click', () => handleAuth(signInWithPopup(auth, new GoogleAuthProvider())));

document.getElementById('forgot-pass-btn').addEventListener('click', async () => {
    if (!emailIn.value) return alert("Please type your email address first!");
    try { await sendPasswordResetEmail(auth, emailIn.value); alert("Success! Check your inbox for the reset link."); }
    catch (e) { alert(getFriendlyError(e.code)); }
});

/**
 * AI Processing Pipeline
 */
const smartInput = document.getElementById('smart-input');
const processBtn = document.getElementById('process-btn');
const aiStatus = document.getElementById('ai-processing-status');

document.getElementById('image-upload').addEventListener('change', (e) => {
    currentImageFile = e.target.files[0];
    if (currentImageFile) smartInput.placeholder = `Attachment Ready: ${currentImageFile.name}`;
});

document.getElementById('voice-btn').addEventListener('click', () => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) return alert("Speech recognition not supported in this browser.");
    const rec = new Recognition();
    rec.onstart = () => smartInput.placeholder = "Listening to your intent...";
    rec.onresult = (e) => smartInput.value = e.results[0][0].transcript;
    rec.start();
});

processBtn.addEventListener('click', async () => {
    if (!smartInput.value && !currentImageFile) return;
    aiStatus.classList.remove('hidden');
    processBtn.disabled = true;

    try {
        const base64 = currentImageFile ? await fileToBase64(currentImageFile) : null;
        const res = await fetch('/api/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: smartInput.value, base64Image: base64 })
        });
        
        const data = await res.json();
        const aiResponse = data.candidates[0].content.parts[0].text;
        const parsed = JSON.parse(aiResponse.match(/\{[\s\S]*\}/)[0]);

        await addDoc(collection(db, "medicines"), {
            uid: currentUser.uid,
            ...parsed,
            quantity: parseFloat(parsed.quantity) || 0,
            timestamp: new Date().toLocaleDateString()
        });

        smartInput.value = '';
        currentImageFile = null;
    } catch (e) {
        alert("AI Processing Error: Please try a clearer text/photo.");
    } finally {
        aiStatus.classList.add('hidden');
        processBtn.disabled = false;
    }
});

/**
 * Real-time Data Visualization
 */
function loadMedicines() {
    const q = query(collection(db, "medicines"), where("uid", "==", currentUser.uid));
    onSnapshot(q, (snapshot) => {
        const grid = document.getElementById('medicine-grid');
        grid.innerHTML = '';
        inventorySnapshot = [];
        let alerting = false;

        snapshot.forEach(docSnap => {
            const med = docSnap.data();
            inventorySnapshot.push(med);
            const dateObj = new Date(med.expiryDate);
            const daysLeft = Math.ceil((dateObj - new Date()) / (86400000));
            
            if (daysLeft < expiryThreshold) alerting = true;

            const card = document.createElement('div');
            card.className = 'medicine-card fade-in';
            card.innerHTML = `
                <div class="med-info">
                   <h4 style="font-weight:700;">${med.name}</h4>
                   <p style="font-size:0.85rem; color:var(--text-muted);">${med.dosage} • Qty: ${med.quantity}</p>
                   <p style="font-size:0.85rem; font-weight:600; color:${daysLeft < 0 ? 'var(--danger)' : (daysLeft < expiryThreshold ? 'var(--warning)' : 'var(--success)')}">
                     ${daysLeft < 0 ? 'Expired' : 'Expires in ' + daysLeft + ' days'}
                   </p>
                </div>
                <button class="icon-btn del-btn" data-id="${docSnap.id}" style="color:var(--danger); border:none; background:rgba(239, 68, 68, 0.05);"><i class="fa-solid fa-trash-can"></i></button>
            `;
            grid.appendChild(card);
        });

        document.getElementById('notification-banner').classList.toggle('hidden', !alerting);
        document.getElementById('notification-text').innerText = alerting ? `Alert: Medications detected below the ${expiryThreshold}-day safety threshold.` : '';
        
        document.querySelectorAll('.del-btn').forEach(b => b.addEventListener('click', (e) => deleteDoc(doc(db, "medicines", e.currentTarget.dataset.id))));
    });
}

const fileToBase64 = (f) => new Promise((rs, rj) => {
    const r = new FileReader(); r.readAsDataURL(f);
    r.onload = () => rs(r.result.split(',')[1]);
});
