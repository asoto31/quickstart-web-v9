'use strict';

import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js';

const firebaseApp = initializeApp({
  apiKey: "AIzaSyBKQSNOdz83RUz9HYbVV3gjdfcvmrpmliI",
  authDomain: "replicator-37607.firebaseapp.com",
  databaseURL: "https://replicator-37607.firebaseio.com",
  projectId: "replicator-37607",
  storageBucket: "replicator-37607.appspot.com",
  messagingSenderId: "1082371143398",
  appId: "1:1082371143398:web:e3b0f970797e9303bd6d27",
  measurementId: "G-RDVGL3ZN2L"
});

export const auth = getAuth();
/* connectAuthEmulator(auth, "http://localhost:9099"); */