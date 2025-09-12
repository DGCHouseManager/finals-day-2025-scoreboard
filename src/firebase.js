import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyCsypyTKOrwCd2VzBWNg_uOEQeJH3wLFIg",
  authDomain: "finalsday2025-4abd4.firebaseapp.com",
  databaseURL: "https://finalsday2025-4abd4-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "finalsday2025-4abd4",
  storageBucket: "finalsday2025-4abd4.firebasestorage.app",
  messagingSenderId: "285661721572",
  appId: "1:285661721572:web:9e180ea7734a9c23d7cdf1"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
