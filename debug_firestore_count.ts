
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkCollections() {
    console.log("Checking collections...");

    try {
        const repairsRef = collection(db, 'repairs');
        const repairsSnap = await getDocs(repairsRef);
        console.log(`Documents in 'repairs': ${repairsSnap.size}`);
        repairsSnap.forEach(doc => console.log(` - repairs/${doc.id}: ${JSON.stringify(doc.data().room)}`));

        const ticketsRef = collection(db, 'repair_tickets');
        const ticketsSnap = await getDocs(ticketsRef);
        console.log(`Documents in 'repair_tickets': ${ticketsSnap.size}`);
        ticketsSnap.forEach(doc => console.log(` - repair_tickets/${doc.id}: ${JSON.stringify(doc.data().room)}`));

    } catch (error) {
        console.error("Error checking collections:", error);
    }
}

checkCollections();
