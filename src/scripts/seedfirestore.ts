import { collection, addDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebaseConfig';

const mockVehicles = [
  {
    id: "1",
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
      "https://images.unsplash.com/photo-1606016434616-8329dd9b5b9c?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=800&h=600&fit=crop",
    ],
    features: [
      "Backup Camera",
      "Bluetooth Connectivity",
      "Lane Departure Warning",
      "Automatic Emergency Braking",
      "Apple CarPlay",
      "Android Auto",
      "Power Windows",
      "Power Locks",
      "Cruise Control",
      "Air Conditioning",
    ],
    isNew: true,
  },
  {
    id: "2",
    make: "Honda",
    model: "Civic",
    year: 2019,
    price: 16200,
    mileage: 52000,
    fuelType: "Gas",
    transmission: "Manual",
    condition: "Good",
    vin: "2HGFC2F69KH123456",
    exterior: "Lunar Silver",
    interior: "Black Cloth",
    drivetrain: "FWD",
    engine: "2.0L 4-Cylinder",
    mpg: "25 city / 36 highway",
    images: [
      "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1606016434616-8329dd9b5b9c?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=800&h=600&fit=crop",
    ],
    features: ["Sunroof", "Heated Seats", "Apple CarPlay"],
  },
  {
    id: "3",
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
    images: ["/F150.jfif"],
    features: ["4WD", "Tow Package", "Crew Cab"],
    isNew: true,
  },
  {
    id: "4",
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
    images: ["/malibu.jfif"],
    features: ["Remote Start", "Leather Seats", "Navigation"],
  },
  {
    id: "5",
    make: "Nissan",
    model: "Altima",
    year: 2020,
    price: 17200,
    mileage: 41000,
    fuelType: "Gas",
    transmission: "CVT",
    condition: "Excellent",
    vin: "1N4BL4BV8LC123456",
    exterior: "Gun Metallic",
    interior: "Charcoal Cloth",
    drivetrain: "FWD",
    engine: "2.5L 4-Cylinder",
    mpg: "28 city / 39 highway",
    images: ["https://images.unsplash.com/photo-1609521263047-f8f205293f24?w=800&h=600&fit=crop"],
    features: ["ProPILOT Assist", "Wireless Charging", "Bose Audio"],
  },
  {
    id: "6",
    make: "BMW",
    model: "3 Series",
    year: 2019,
    price: 28900,
    mileage: 35000,
    fuelType: "Gas",
    transmission: "Automatic",
    condition: "Excellent",
    vin: "WBA5R1C56KA123456",
    exterior: "Alpine White",
    interior: "Black Leather",
    drivetrain: "AWD",
    engine: "2.0L 4-Cylinder Turbo",
    mpg: "24 city / 34 highway",
    images: ["https://images.unsplash.com/photo-1555215695-3004980ad54e?w=800&h=600&fit=crop"],
    features: ["xDrive AWD", "Harman Kardon", "Navigation"],
  },
];

async function seedData() {
  const vehiclesRef = collection(db, 'vehicles');
  const snapshot = await getDocs(vehiclesRef);
  if (snapshot.empty) {
    console.log('Seeding vehicles...');
    for (const vehicle of mockVehicles) {
      await addDoc(vehiclesRef, vehicle);
      console.log(`Added vehicle: ${vehicle.make} ${vehicle.model}`);
    }
    console.log('Seeding complete!');
  } else {
    console.log('Vehicles collection already has data. Skipping seed.');
  }
}

seedData().catch(console.error);