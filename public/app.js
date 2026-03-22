/**
 * MediRepo Visual Masterpiece v5.0 (Logic Bridge)
 * Mapping the High-End UI to the Gemini/Firebase Engine.
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
const remoteConfig = getRemoteConfig(app);

// Global Variables
let currentUser = null;
let currentImageFile = null;
let expiryThreshold = 90;
let fullInventory = [];

/**
 * Friendly Error Mapping
 */
const getFriendlyError = (code) => {
    switch (code) {
        case 'auth/invalid-credential': return "Oops! Those credentials don't match our records.";
        case 'auth/user-not-found': return "We couldn't find an account with that email.";
        case 'auth/popup-blocked': return "The sign-in popup was blocked. Please allow popups.";
        default: return "System Error: Please check your connection.";
    }
};

/**
 * UI Mode: Email Toggle
 */
const emailModeBtn = document.getElementById('email-mode-btn');
const emailForm = document.getElementById('email-form');
if (emailModeBtn) {
    emailModeBtn.addEventListener('click', () => {
        emailForm.classList.toggle('hidden');
        emailModeBtn.classList.toggle('hidden');
    });
}

/**
 * Authentication & State Management
 */
const authSect = document.getElementById('auth-section');
const dashSect = document.getElementById('dashboard-section');
const actionGrid = document.getElementById('action-grid');
const errBox = document.getElementById('auth-error');
const emailIn = document.getElementById('email-input');
const passIn = document.getElementById('pass-input');

onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user) {
        authSect.classList.add('hidden');
        dashSect.classList.remove('hidden');
        document.getElementById('logout-btn').classList.remove('hidden');
        loadMedicines();
    } else {
        authSect.classList.remove('hidden');
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

document.getElementById('login-btn').addEventListener('click', () => handleAuth(signInWithEmailAndPassword(auth, emailIn.value, passIn.value)));
document.getElementById('signup-btn').addEventListener('click', () => handleAuth(createUserWithEmailAndPassword(auth, emailIn.value, passIn.value)));
document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));
document.getElementById('google-login-btn').addEventListener('click', () => handleAuth(signInWithPopup(auth, new GoogleAuthProvider())));

/**
 * Action Grid Interactions
 */
document.getElementById('start-repo-card').addEventListener('click', () => {
    window.scrollTo({ top: document.getElementById('dashboard-section').offsetTop - 20, behavior: 'smooth' });
});

document.getElementById('search-inventory-card').addEventListener('click', () => {
    document.getElementById('search-box-container').classList.toggle('hidden');
    document.getElementById('inventory-search').focus();
});

document.getElementById('export-data-card').addEventListener('click', () => {
    exportToCSV();
});

/**
 * Data Feature: CSV Export
 */
function exportToCSV() {
    if (fullInventory.length === 0) return alert("Nothing to export yet!");
    let csv = "Medicine Name,Dosage,Quantity,Expiry Date\n";
    fullInventory.forEach(item => {
        csv += `"${item.name}","${item.dosage}","${item.quantity}","${item.expiryDate}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `medirepo_export.csv`;
    a.click();
}

/**
 * Search Logic
 */
const searchInput = document.getElementById('inventory-search');
if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        renderFilteredInventory(e.target.value.toLowerCase());
    });
}

/**
 * AI Processing Pipeline (Quick Upload)
 */
const smartInput = document.getElementById('smart-input');
const processBtn = document.getElementById('process-btn');
const aiStatus = document.getElementById('ai-processing-status');
const dropZone = document.getElementById('drop-zone');
const imgUpload = document.getElementById('image-upload');

dropZone.addEventListener('click', () => imgUpload.click());

imgUpload.addEventListener('change', (e) => {
    currentImageFile = e.target.files[0];
    if (currentImageFile) smartInput.placeholder = `Ready: ${currentImageFile.name}`;
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
        const match = aiResponse.match(/\{[\s\S]*\}/);
        const parsed = JSON.parse(match[0]);

        if (parsed.error === 'out_of_scope') {
            alert("⚠️ Out of Scope: MediRepo AI only processes medical data.");
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
        alert("Extraction Error: Please try again.");
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
            fullInventory.push({ id: docSnap.id, ...docSnap.data() });
        });
        renderFilteredInventory('');
    });
}

function renderFilteredInventory(term) {
    const grid = document.getElementById('inventory-view');
    grid.innerHTML = '';
    let alerting = false;

    fullInventory.filter(i => i.name.toLowerCase().includes(term)).forEach(med => {
        const daysLeft = Math.ceil((new Date(med.expiryDate) - new Date()) / 86400000);
        if (daysLeft < expiryThreshold) alerting = true;

        const card = document.createElement('div');
        card.className = 'glass-card fade-in';
        card.style.flexDirection = 'row';
        card.style.justifyContent = 'space-between';
        card.style.padding = '1rem 1.5rem';
        card.innerHTML = `
            <div style="text-align:left;">
               <h4 style="font-weight:700;">${med.name}</h4>
               <p style="opacity:0.7;">${med.dosage} • Qty: ${med.quantity}</p>
            </div>
            <div style="text-align:right;">
               <p style="font-weight:600; color:${daysLeft < 0 ? '#ef4444' : (daysLeft < expiryThreshold ? '#f59e0b' : '#22d3ee')}">
                 ${daysLeft < 0 ? 'Expired' : daysLeft + ' days left'}
               </p>
               <button class="del-btn" data-id="${med.id}" style="background:none; border:none; color:#ef4444; margin-top:0.25rem; cursor:pointer;"><i class="fa-solid fa-trash-can"></i></button>
            </div>
        `;
        grid.appendChild(card);
    });

    document.getElementById('notification-banner').classList.toggle('hidden', !alerting);
    document.getElementById('notification-text').innerText = alerting ? `Alert: Safety threshold reached.` : '';
    
    document.querySelectorAll('.del-btn').forEach(b => b.addEventListener('click', (e) => deleteDoc(doc(db, "medicines", e.currentTarget.dataset.id))));
}

const fileToBase64 = (f) => new Promise((rs, rj) => {
    const r = new FileReader(); r.readAsDataURL(f);
    r.onload = () => rs(r.result.split(',')[1]);
});
