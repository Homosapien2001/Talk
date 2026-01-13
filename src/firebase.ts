import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
    apiKey: "AIzaSyCQjxxX460yuJa5uFOXaaQfvrFW2VtqHFQ",
    authDomain: "talk-31bf4.firebaseapp.com",
    projectId: "talk-31bf4",
    storageBucket: "talk-31bf4.firebasestorage.app",
    messagingSenderId: "334429739904",
    appId: "1:334429739904:web:dc036dde7cf1efd69aff65",
    measurementId: "G-JV88ZRTWL9"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);
export default app;
