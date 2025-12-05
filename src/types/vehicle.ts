// src/types/vehicle.ts

export interface Vehicle {
    id: string;
    make: string;
    model: string;
    year: number;
    price: number;
    mileage: number;
    
    // Core mechanical/spec fields
    engine: string;
    transmission: string;
    fuelType: string;
    bodyStyle: string;  // 🎯 ADD THIS - Body style field
    
    // Color/VIN fields
    exteriorColor: string;
    interiorColor: string;
    vin: string;
    
    // 🎯 NEW: Stock Number field
    stockNumber?: string;
    
    // Descriptive/Status fields
    description: string;
    isNew: boolean;
    isFeatured?: boolean;
    condition?: string;
    
    // Arrays - Updated to support up to 10 images
    images: string[];
    features: string[];
    options?: string[];
    
    // Optional metadata fields
    drivetrain?: string;
    mpg?: string;
    createdAt?: Date;
    updatedAt?: Date;
}