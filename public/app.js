/**
 * MediRepo Universal Platform 4.2 (Bug Fixes & Search)
 * Fixing Google Auth, History Sync, and adding real-time filtering.
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
let fullInventory = []; // Cache for filtering

/**
 * Friendly Error Mapping
 */
const getFriendlyError = (code) => {
    switch (code) {
        case 'auth/invalid-credential': return "Oops! Those credentials don't match our records.";
        case 'auth/user-not-found': return "We couldn't find an account with that email.";
        case 'auth/wrong-password': return "That's not the right password. Try again?";
        case 'auth/email-already-in-use': return "This email is already registered. Want to sign in instead?";
        case 'auth/weak-password': return "That password is a bit too easy to guess. Make it stronger!";
        case 'auth/popup-blocked': return "The sign-in popup was blocked. Please allow popups for this site.";
        default: return "Something went wrong. Please check your connection and try again.";
    }
};

/**
 * Remote Config
 */
async function initRemoteConfig() {
    try {
        remoteConfig.settings.minimumFetchIntervalMillis = 3600000;
        await fetchAndActivate(remoteConfig);
        expiryThreshold = getNumber(remoteConfig, 'expiry_alert_threshold') || 90;
        const configBadge = document.getElementById('config-threshold');
        if (configBadge) {
            configBadge.innerText = `Config: ${expiryThreshold}d Alert Active`;
            configBadge.classList.add('badge-ready');
        }
    } catch (err) {
        console.warn("Remote Config failed:", err);
    }
}
initRemoteConfig();

/**
 * UX Feature: Password Visibility
 */
const passInput = document.getElementById('pass-input');
const toggleBtn = document.getElementById('toggle-password');
const eyeIcon = document.getElementById('eye-icon');

if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
        const isPass = passInput.type === 'password';
        passInput.type = isPass ? 'text' : 'password';
        eyeIcon.className = isPass ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
    });
}

/**
 * Search/Filter logic (New Feature)
 */
const searchInput = document.getElementById('inventory-search');
if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        renderFilteredInventory(term);
    });
}

/**
 * Data Feature: CSV Export
 */
document.getElementById('download-csv-btn').addEventListener('click', () => {
    if (fullInventory.length === 0) return alert("Nothing to export yet!");
    let csv = "Medicine Name,Dosage,Quantity,Expiry Date,Added On\n";
    fullInventory.forEach(item => {
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
const welcomeMessage = document.getElementById('welcome-message');
const dashSect = document.getElementById('dashboard-section');
const errBox = document.getElementById('auth-error');
const emailIn = document.getElementById('email-input');

onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user) {
        authSect.classList.add('hidden');
        welcomeMessage.innerHTML = `<span class="badge-ready">Session Active</span><br>Welcome back, <strong>${user.email.split('@')[0]}</strong>! Your verified medical bridge is active.`;
        dashSect.classList.remove('hidden');
        document.getElementById('logout-btn').classList.remove('hidden');
        loadMedicines();
    } else {
        authSect.classList.remove('hidden');
        welcomeMessage.innerText = "The MediRepo 'Universal Bridge' uses Gemini AI to instantly convert unstructured medical voice, text, and images into a secure, real-time clinical database.";
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

// Google Login
const googleBtn = document.getElementById('google-login-btn');
if (googleBtn) {
    googleBtn.addEventListener('click', () => handleAuth(signInWithPopup(auth, new GoogleAuthProvider())));
}

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
        if (!data.candidates) throw new Error("AI parsing error. Check API connection.");
        
        const aiResponse = data.candidates[0].content.parts[0].text;
        const match = aiResponse.match(/\{[\s\S]*\}/);
        if (!match) throw new Error("AI returned unreadable format.");
        
        const parsed = JSON.parse(match[0]);

        // Bug Fix: Scope Restriction
        if (parsed.error === 'out_of_scope') {
            alert("⚠️ Out of Scope: MediRepo AI only processes medical and medicine-related data. Please provide prescription/medication details.");
            return;
        }

        await addDoc(collection(db, "medicines"), {
            uid: currentUser.uid,
            ...parsed,
            quantity: parseFloat(parsed.quantity) || 0,
            timestamp: new Date().toLocaleDateString()
        });

        smartInput.value = '';
        currentImageFile = null;
    } catch (e) {
        console.error(e);
        alert("System Notice: " + e.message);
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
        fullInventory = [];
        snapshot.forEach(docSnap => {
            const med = docSnap.data();
            fullInventory.push({ id: docSnap.id, ...med });
        });
        renderFilteredInventory('');
    });
}

function renderFilteredInventory(term) {
    const grid = document.getElementById('medicine-grid');
    grid.innerHTML = '';
    let alerting = false;

    const filtered = fullInventory.filter(item => 
        item.name.toLowerCase().includes(term) || 
        item.dosage.toLowerCase().includes(term)
    );

    filtered.forEach(med => {
        const dateObj = new Date(med.expiryDate);
        const daysLeft = Math.ceil((dateObj - new Date()) / (86400000));
        
        if (daysLeft < expiryThreshold) alerting = true;

        const card = document.createElement('div');
        card.className = 'medicine-card fade-in';
        card.innerHTML = `
            <div class="med-info">
               <h4 style="font-weight:700;">${med.name}</h4>
               <p style="font-size:0.85rem; color:var(--text-muted);">${med.dosage} • Qty: ${med.quantity}</p>
               <p style="font-size:0.8rem; font-weight:600; color:${daysLeft < 0 ? 'var(--danger)' : (daysLeft < expiryThreshold ? 'var(--warning)' : 'var(--success)')}">
                 ${daysLeft < 0 ? 'Expired' : 'Expires in ' + daysLeft + ' days'}
               </p>
            </div>
            <button class="icon-btn del-btn" data-id="${med.id}" style="color:var(--danger); border:none; background:rgba(239, 68, 68, 0.05);"><i class="fa-solid fa-trash-can"></i></button>
        `;
        grid.appendChild(card);
    });

    const banner = document.getElementById('notification-banner');
    if (banner) {
        banner.classList.toggle('hidden', !alerting);
        const bannerText = document.getElementById('notification-text');
        if (bannerText) bannerText.innerText = alerting ? `Alert: Medications detected below the ${expiryThreshold}-day safety threshold.` : '';
    }
    
    document.querySelectorAll('.del-btn').forEach(b => b.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        deleteDoc(doc(db, "medicines", id));
    }));
}

const fileToBase64 = (f) => new Promise((rs, rj) => {
    const r = new FileReader(); r.readAsDataURL(f);
    r.onload = () => rs(r.result.split(',')[1]);
});
