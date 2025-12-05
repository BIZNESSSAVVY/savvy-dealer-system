// src/scripts/seed.ts

import { db } from '../firebaseConfig'; // Import the db reference from your config file
import { collection, addDoc, getDocs } from 'firebase/firestore';
import { mockVehiclesData } from '../data/mockVehiclesData';

const VEHICLES_COLLECTION = 'vehicles';

async function seedData() {
    console.log(`Starting data seed into the '${VEHICLES_COLLECTION}' collection...`);
    const vehiclesRef = collection(db, VEHICLES_COLLECTION);
    
    // Check if the collection is empty before seeding
    const snapshot = await getDocs(vehiclesRef);

    if (snapshot.empty) {
        let successfulWrites = 0;
        for (const vehicle of mockVehiclesData) {
            try {
                // Use addDoc to let Firestore generate a unique ID
                await addDoc(vehiclesRef, vehicle); 
                successfulWrites++;
                console.log(`✅ Added: ${vehicle.make} ${vehicle.model}`);
            } catch (error) {
                console.error(`❌ Error adding ${vehicle.make} ${vehicle.model}:`, error);
            }
        }
        console.log(`\n✨ Seed Complete. ${successfulWrites} vehicles added.`);
    } else {
        console.log(`\n⚠️ Collection '${VEHICLES_COLLECTION}' is NOT empty. Skipping seed to prevent duplicates.`);
        console.log(`Total documents found: ${snapshot.size}.`);
    }
}

seedData().catch(err => console.error('\n🛑 Fatal Error during seeding process:', err));