/**
 * MediRepo Visual Masterpiece v5.0 (Logic Bridge)
 * Mapping the High-End UI to the Gemini/Firebase Engine.
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup, sendPasswordResetEmail, updateProfile } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
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
        case 'auth/invalid-credential': return "Incorrect email or password. Please try again.";
        case 'auth/user-not-found': return "We couldn't find an account with that email.";
        case 'auth/wrong-password': return "The password you entered is incorrect.";
        case 'auth/email-already-in-use': return "An account with this email already exists.";
        case 'auth/weak-password': return "Password should be at least 6 characters.";
        case 'account-locked': return "Account locked due to 5 failed attempts. Please try again later.";
        default: return "System Error: Please check your connection.";
    }
};

/**
 * UI Mode: Auth Toggle (Login / Sign Up)
 */
let authMode = 'login';
let loginAttempts = 0;
const authHeader = document.getElementById('auth-header');
const toggleAuthLink = document.getElementById('toggle-auth-link');
const toggleAuthContainer = document.getElementById('toggle-auth-container');
const authSubmitBtn = document.getElementById('auth-submit-btn');
const signupFields = document.getElementById('signup-fields');
const forgotFields = document.getElementById('forgot-pass-fields');
const forgotLink = document.getElementById('forgot-pass-link');
const passwordArea = document.getElementById('password-area');
const emailLabel = document.getElementById('email-label');

const updateAuthUI = () => {
    signupFields.classList.toggle('hidden', authMode !== 'signup');
    forgotFields.classList.toggle('hidden', authMode !== 'forgot');
    passwordArea.classList.toggle('hidden', authMode === 'forgot');
    forgotLink.classList.toggle('hidden', authMode !== 'login');
    
    if (authMode === 'login') {
        authHeader.innerText = 'LOG IN';
        authSubmitBtn.innerText = 'ACCESS REPOSITORY';
        emailLabel.innerText = 'EMAIL ADDRESS *';
        toggleAuthContainer.innerHTML = `Don't have an account? <a id="toggle-auth-link" style="color: var(--accent); cursor: pointer; text-decoration: underline;">Create an account.</a>`;
    } else if (authMode === 'signup') {
        authHeader.innerText = 'SIGN UP';
        authSubmitBtn.innerText = 'INITIALIZE ACCOUNT';
        emailLabel.innerText = 'EMAIL ADDRESS *';
        toggleAuthContainer.innerHTML = `Already have an account? <a id="toggle-auth-link" style="color: var(--accent); cursor: pointer; text-decoration: underline;">Log in.</a>`;
    } else if (authMode === 'forgot') {
        authHeader.innerText = 'RESET';
        authSubmitBtn.innerText = 'SEND RESET LINK';
        emailLabel.innerText = 'REGISTERED EMAIL *';
        toggleAuthContainer.innerHTML = `Remembered your password? <a id="toggle-auth-link" style="color: var(--accent); cursor: pointer; text-decoration: underline;">Log in.</a>`;
    }
    
    document.getElementById('toggle-auth-link').addEventListener('click', (e) => {
        if (authMode === 'login') authMode = 'signup';
        else authMode = 'login';
        updateAuthUI();
    });
};

const toggleToSignup = (e) => {
    authMode = 'signup';
    updateAuthUI();
};

const toggleToLogin = (e) => {
    authMode = 'login';
    updateAuthUI();
};

const toggleToForgot = (e) => {
    authMode = 'forgot';
    updateAuthUI();
};

if (toggleAuthLink) {
    toggleAuthLink.addEventListener('click', toggleToSignup);
}

if (forgotLink) {
    forgotLink.addEventListener('click', (e) => {
        e.preventDefault();
        toggleToForgot();
    });
}

// Re-usable toggle function
const setupToggles = () => {
    const link = document.getElementById('toggle-auth-link');
    if (link) {
        link.onclick = (e) => {
            if (authMode === 'login') authMode = 'signup';
            else authMode = 'login';
            updateAuthUI();
        };
    }
};
setupToggles();

/**
 * Toggle Password Visibility
 */
const togglePassword = document.getElementById('toggle-password');
const eyeIcon = document.getElementById('eye-icon');
if (togglePassword) {
    togglePassword.addEventListener('click', () => {
        const type = passIn.getAttribute('type') === 'password' ? 'text' : 'password';
        passIn.setAttribute('type', type);
        eyeIcon.classList.toggle('fa-eye');
        eyeIcon.classList.toggle('fa-eye-slash');
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
        
        // Personalized Greeting
        const firstName = user.displayName ? user.displayName.split(' ')[0] : 'Researcher';
        document.getElementById('welcome-greeting').innerText = `Welcome, ${firstName}`;
        document.getElementById('current-date').innerText = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        
        loadMedicines();
        
        // Remove restricted visual state
        document.querySelectorAll('#action-grid .glass-card').forEach(card => card.classList.remove('restricted'));
    } else {
        authSect.classList.remove('hidden');
        dashSect.classList.add('hidden');
        document.getElementById('logout-btn').classList.add('hidden');
        
        // Apply restricted visual state
        document.querySelectorAll('#action-grid .glass-card').forEach(card => card.classList.add('restricted'));
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

authSubmitBtn.addEventListener('click', async () => {
    const email = emailIn.value;
    const pass = passIn.value;
    
    if (authMode === 'login') {
        if (localStorage.getItem('lockout_expiry') && new Date().getTime() < localStorage.getItem('lockout_expiry')) {
            errBox.innerText = getFriendlyError('account-locked');
            errBox.classList.remove('hidden');
            return;
        }
        
        try {
            errBox.classList.add('hidden');
            await signInWithEmailAndPassword(auth, email, pass);
            loginAttempts = 0;
            localStorage.removeItem('lockout_expiry');
        } catch (err) {
            loginAttempts++;
            if (loginAttempts >= 5) {
                const expiry = new Date().getTime() + 15 * 60 * 1000; // 15 mins
                localStorage.setItem('lockout_expiry', expiry);
                errBox.innerText = getFriendlyError('account-locked');
            } else {
                errBox.innerText = getFriendlyError(err.code);
            }
            errBox.classList.remove('hidden');
        }
    } else if (authMode === 'signup') {
        const fname = document.getElementById('first-name-input').value;
        const lname = document.getElementById('last-name-input').value;
        
        try {
            errBox.classList.add('hidden');
            const userCred = await createUserWithEmailAndPassword(auth, email, pass);
            await updateProfile(userCred.user, { displayName: `${fname} ${lname}` });
            // Profile update triggers state change naturally
        } catch (err) {
            errBox.innerText = getFriendlyError(err.code);
            errBox.classList.remove('hidden');
        }
    } else if (authMode === 'forgot') {
        try {
            errBox.classList.add('hidden');
            await sendPasswordResetEmail(auth, email);
            alert("Reset link sent! Please check your email inbox and spam folder.");
            authMode = 'login';
            updateAuthUI();
        } catch (err) {
            errBox.innerText = getFriendlyError(err.code);
            errBox.classList.remove('hidden');
        }
    }
});
document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));

/**
 * Action Grid Interactions: Restricted to Authenticated Users
 */
const checkAuthForAction = (callback) => {
    if (!currentUser) {
        errBox.innerText = "Access Restricted: Please log in to your clinical repository first.";
        errBox.classList.remove('hidden');
        authSect.scrollIntoView({ behavior: 'smooth' });
        // Highlight auth box
        const authBox = document.querySelector('.auth-box');
        authBox.style.boxShadow = '0 0 30px var(--accent-glow)';
        setTimeout(() => authBox.style.boxShadow = '', 2000);
        return;
    }
    callback();
};

document.getElementById('start-repo-card').addEventListener('click', () => {
    checkAuthForAction(() => {
        window.scrollTo({ top: document.getElementById('dashboard-section').offsetTop - 20, behavior: 'smooth' });
        smartInput.focus();
    });
});

document.getElementById('search-inventory-card').addEventListener('click', () => {
    checkAuthForAction(() => {
        document.getElementById('search-box-container').classList.remove('hidden');
        document.getElementById('inventory-search').focus();
    });
});

document.getElementById('export-data-card').addEventListener('click', () => {
    checkAuthForAction(() => {
        exportToCSV();
    });
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
const uploadIcons = dropZone.querySelector('.upload-icons');
const uploadText = dropZone.querySelector('p');

// Only icons or text trigger file upload, not the whole zone/textarea
uploadIcons.addEventListener('click', () => imgUpload.click());
uploadText.addEventListener('click', () => imgUpload.click());

imgUpload.addEventListener('change', (e) => {
    currentImageFile = e.target.files[0];
    if (currentImageFile) smartInput.placeholder = `Ready: ${currentImageFile.name}`;
});

processBtn.addEventListener('click', async () => {
    if (!smartInput.value && !currentImageFile) return;
    
    // UI Feedback: Start
    aiStatus.classList.remove('hidden');
    processBtn.disabled = true;
    errBox.classList.add('hidden'); // Use global errBox for visibility

    try {
        const base64 = currentImageFile ? await fileToBase64(currentImageFile) : null;
        const res = await fetch('/api/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: smartInput.value, base64Image: base64 })
        });
        
        if (!res.ok) {
            if (res.status === 404) throw new Error("Backend service not found. Please ensure the local server is running (npm start).");
            throw new Error(`Extraction Service Error (HTTP ${res.status})`);
        }

        const data = await res.json();
        if (!data.candidates || !data.candidates[0].content.parts[0].text) {
            throw new Error("Gemini AI failed to generate a valid clinical response. Please try again.");
        }

        const aiResponse = data.candidates[0].content.parts[0].text;
        const match = aiResponse.match(/\{[\s\S]*\}/);
        if (!match) throw new Error("AI returned data in an invalid format. Refine your input.");
        
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

        // Cleanup
        smartInput.value = '';
        currentImageFile = null;
        smartInput.placeholder = "Type clinical findings or scan patient records...";
    } catch (e) {
        console.error("MediRepo AI Error:", e);
        errBox.innerText = `AI Extraction Error: ${e.message}`;
        errBox.classList.remove('hidden');
        errBox.scrollIntoView({ behavior: 'smooth' });
    } finally {
        // UI Feedback: End (Crucial: Always hide status and re-enable button)
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
    }, (err) => {
        console.error("Firestore Error:", err);
        if (err.code === 'permission-denied') {
            alert("Security Alert: Remote Clinical Repository access denied. Please re-login.");
        }
    });
}

function renderFilteredInventory(term) {
    const grid = document.getElementById('inventory-view');
    grid.innerHTML = '';
    let alerting = false;

    fullInventory.filter(i => i.name.toLowerCase().includes(term)).forEach(med => {
        const daysLeft = Math.ceil((new Date(med.expiryDate) - new Date()) / 86400000);
        if (daysLeft < expiryThreshold) alerting = true;

        const isExpired = daysLeft < 0;
        const isWarning = daysLeft < expiryThreshold && !isExpired;
        const statusColor = isExpired ? '#ef4444' : (isWarning ? '#f59e0b' : 'var(--accent)');
        const statusBg = isExpired ? 'rgba(239, 68, 68, 0.1)' : (isWarning ? 'rgba(245, 158, 11, 0.1)' : 'rgba(34, 211, 238, 0.1)');

        const card = document.createElement('div');
        card.className = 'med-card fade-in';
        card.innerHTML = `
            <div style="display: flex; align-items: center; gap: 1.5rem;">
                <div style="width: 45px; height: 45px; background: ${statusBg}; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: ${statusColor}; border: 1px solid ${statusColor}44;">
                    <i class="fa-solid ${isExpired ? 'fa-hourglass-end' : 'fa-pills'}"></i>
                </div>
                <div style="text-align:left;">
                   <h4 style="font-weight:600; font-size: 1.1rem; color: #fff;">${med.name}</h4>
                   <p style="font-size: 0.85rem; color: var(--text-faded);">${med.dosage} • Quantity: <span style="color: #fff; font-weight: 500;">${med.quantity}</span></p>
                </div>
            </div>
            <div style="text-align:right; display: flex; align-items: center; gap: 2rem;">
               <div style="text-align: right;">
                   <p style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px; color: var(--text-dim); margin-bottom: 2px;">Status</p>
                   <p style="font-weight:600; font-size: 0.9rem; color:${statusColor}">
                     ${isExpired ? 'EXPIRED' : daysLeft + ' DAYS LEFT'}
                   </p>
               </div>
               <button class="del-btn" data-id="${med.id}" style="background:rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); color:#ef4444; width: 35px; height: 35px; border-radius: 8px; cursor:pointer; transition: var(--transition-smooth);"><i class="fa-solid fa-trash-can"></i></button>
            </div>
        `;
        grid.appendChild(card);
    });

    document.getElementById('notification-banner').classList.toggle('hidden', !alerting);
    document.getElementById('notification-text').innerHTML = alerting ? `<strong>Safety Alert:</strong> Clinical safety threshold reached for certain repository items.` : '';
    
    document.querySelectorAll('.del-btn').forEach(b => {
        b.addEventListener('mouseenter', (e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)');
        b.addEventListener('mouseleave', (e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)');
        b.addEventListener('click', (e) => deleteDoc(doc(db, "medicines", e.currentTarget.dataset.id)));
    });
}

const fileToBase64 = (f) => new Promise((rs, rj) => {
    const r = new FileReader(); r.readAsDataURL(f);
    r.onload = () => rs(r.result.split(',')[1]);
});
