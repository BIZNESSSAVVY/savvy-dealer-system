import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs } from 'firebase/firestore';

// Replace with your Firebase config from Firebase Console
const firebaseConfig = {
  apiKey: "AIzaSyCl0j6-CxUBhgZrFCJRuRbqaeRDcypyvBg",
  authDomain: "ceceauto-86008.firebaseapp.com",
  projectId: "ceceauto-86008",
  storageBucket: "ceceauto-86008.firebasestorage.app",
  messagingSenderId: "562046029503",
  appId: "1:562046029503:web:b8e0825613f1decb9ac00a",
  measurementId: "G-8XH18KC1Y4"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const mockVehicles = [
  {
    make: "Toyota",
    model: "Camry",
    year: 2020,
    price: 18500,
    mileage: 45000,
    fuelType: "Gas",
    transmission: "Automatic",
    condition: "Excellent",
    vin: "1HGBH41JXMN109186",
    exterior: "Midnight Black Metallic",
    interior: "Beige Cloth",
    drivetrain: "FWD",
    engine: "2.5L 4-Cylinder",
    mpg: "28 city / 39 highway",
    images: [
      "https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1606016434616-8329dd9b5b9c?w=800&h=600&fit=crop"
    ],
    features: ["Backup Camera", "Bluetooth", "Cruise Control"],
    isNew: true
  },
  {
    make: "Ford",
    model: "F-150",
    year: 2021,
    price: 32900,
    mileage: 28000,
    fuelType: "Gas",
    transmission: "Automatic",
    condition: "Excellent",
    vin: "1FTFW1E54MK123456",
    exterior: "Oxford White",
    interior: "Gray Cloth",
    drivetrain: "4WD",
    engine: "3.5L V6",
    mpg: "18 city / 24 highway",
    images: ["https://via.placeholder.com/800x600"],
    features: ["4WD", "Tow Package"],
    isNew: true
  },
  {
    make: "Chevrolet",
    model: "Malibu",
    year: 2018,
    price: 14800,
    mileage: 68000,
    fuelType: "Gas",
    transmission: "Automatic",
    condition: "Good",
    vin: "1G1ZD5STXJF123456",
    exterior: "Summit White",
    interior: "Jet Black",
    drivetrain: "FWD",
    engine: "1.5L 4-Cylinder",
    mpg: "27 city / 36 highway",
    images: ["https://via.placeholder.com/800x600"],
    features: ["Remote Start", "Leather Seats"],
    isNew: false
  }
];

async function seedData() {
  const vehiclesRef = collection(db, 'vehicles');
  const snapshot = await getDocs(vehiclesRef);
  if (snapshot.empty) {
    console.log('Seeding vehicles...');
    for (const vehicle of mockVehicles) {
      await addDoc(vehiclesRef, vehicle);
      console.log(`Added: ${vehicle.make} ${vehicle.model}`);
    }
    console.log('Seeding complete!');
  } else {
    console.log('Vehicles already exist, skipping seed.');
  }
}

seedData().catch(err => console.error('Error seeding data:', err));