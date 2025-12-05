// src/scripts/seed.js

// Using require() is the most stable way to import modules in a Node.js script.
// If your 'firebaseConfig.ts' uses 'export const db = ...', you might need to adjust 
// its export method or compile it first. Assuming standard export:
// NOTE: You may need to replace './../firebaseConfig' with the path to your compiled JS file 
// (e.g., in a 'dist' folder) or adjust your project to compile this script first.
// For simplicity, we'll try dynamic import, which is better for modern Node:

const { db } = await import('../firebaseConfig.js'); // Use .js extension for compiled output
const { collection, addDoc, getDocs } = await import('firebase/firestore');

// Mock data array copied from your original prompt (without the 'id' field, as addDoc creates it)
const mockVehiclesData = [
  {
    make: "Toyota",
    model: "Camry",
    year: 2020,
    price: 18500,
    mileage: 45000,
    fuelType: "Gas",
    transmission: "Automatic",
    condition: "Excellent",
    images: ["https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=800&h=600&fit=crop"],
    features: ["Backup Camera", "Bluetooth", "Lane Assist"],
    isNew: true,
  },
  {
    make: "Honda",
    model: "Civic",
    year: 2019,
    price: 16200,
    mileage: 52000,
    fuelType: "Gas",
    transmission: "Manual",
    condition: "Good",
    images: ["https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800&h=600&fit=crop"],
    features: ["Sunroof", "Heated Seats", "Apple CarPlay"],
  },
  // ... (Add the rest of your mock data objects here)
];

const VEHICLES_COLLECTION = 'vehicles';

async function seedData() {
    console.log(`Starting data seed into '${VEHICLES_COLLECTION}'...`);
    const vehiclesRef = collection(db, VEHICLES_COLLECTION);
    
    const snapshot = await getDocs(vehiclesRef);

    if (snapshot.empty) {
        let successfulWrites = 0;
        for (const vehicle of mockVehiclesData) {
            try {
                await addDoc(vehiclesRef, vehicle); 
                successfulWrites++;
                console.log(`✅ Added: ${vehicle.make} ${vehicle.model}`);
            } catch (error) {
                console.error(`❌ Error adding ${vehicle.make} ${vehicle.model}:`, error);
            }
        }
        console.log(`\n✨ Seed Complete. ${successfulWrites} vehicles added.`);
    } else {
        console.log(`\n⚠️ Collection '${VEHICLES_COLLECTION}' is NOT empty. Skipping seed.`);
    }
}

seedData().catch(err => console.error('\n🛑 Fatal Error during seeding process:', err));