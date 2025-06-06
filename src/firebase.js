import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyBKD47kPbuR54DfF7wKjk7ruv5jOubYb7s",
  authDomain: "danumcup2025.firebaseapp.com",
  databaseURL: "https://danumcup2025-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "danumcup2025",
  storageBucket: "danumcup2025.firebasestorage.app",
  messagingSenderId: "562025327687",
  appId: "1:562025327687:web:d3184c1d306b67faed9562"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
