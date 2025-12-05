// src/pages/VehicleDetails.tsx

import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, Calendar, Gauge, Fuel, Phone, MessageCircle, Calculator, Car, Palette, Ruler, Check, ChevronRight, Hash } from "lucide-react";

// FIREBASE IMPORTS
import { db } from '@/firebaseConfig';
import { doc, getDoc, DocumentSnapshot, DocumentData } from 'firebase/firestore';

// UI COMPONENT IMPORTS
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

// VEHICLE INTERFACE
interface Vehicle {
    id: string;
    make: string;
    model: string;
    year: number;
    price: number;
    mileage: number;
    engine: string;
    transmission: string;
    fuelType: string;
    exteriorColor: string;
    interiorColor: string;
    vin: string;
    stockNumber?: string;
    condition?: string;
    isNew: boolean;
    isFeatured?: boolean;
    description: string;
    images: string[];
    features: string[];
    options?: string[];
    drivetrain?: string;
    mpg?: string;
    bodyStyle?: string;
}

const VehicleDetails = () => {
    const [vehicle, setVehicle] = useState<Vehicle | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [loanAmount, setLoanAmount] = useState("");
    const [downPayment, setDownPayment] = useState("");
    const [interestRate, setInterestRate] = useState("11.9");
    const [loanTerm, setLoanTerm] = useState("60");

    const phoneNumber = "tel:+13022847114";

    useEffect(() => {
        if (!id) {
            setError("No vehicle ID provided in the URL.");
            setLoading(false);
            return;
        }

        const fetchVehicle = async () => {
            setLoading(true);
            setError(null);

            try {
                const docRef = doc(db, "vehicles", id);
                const docSnap: DocumentSnapshot<DocumentData> = await getDoc(docRef);

                if (docSnap.exists()) {
                    const data = docSnap.data();

                    const fetchedVehicle: Vehicle = {
                        id: docSnap.id,
                        make: data.make || '',
                        model: data.model || '',
                        year: data.year || new Date().getFullYear(),
                        price: data.price || 0,
                        mileage: data.mileage || 0,
                        engine: data.engine || 'N/A',
                        transmission: data.transmission || 'N/A',
                        fuelType: data.fuelType || 'N/A',
                        exteriorColor: data.exteriorColor || 'N/A',
                        interiorColor: data.interiorColor || 'N/A',
                        vin: data.vin || 'N/A',
                        stockNumber: data.stockNumber || undefined,
                        condition: data.condition || 'Used',
                        isNew: data.isNew || false,
                        isFeatured: data.isFeatured || false,
                        description: data.description || '',
                        images: data.images ?? [],
                        features: data.features ?? [],
                        options: data.options ?? [],
                        drivetrain: data.drivetrain || 'N/A',
                        mpg: data.mpg || 'N/A',
                        bodyStyle: data.bodyStyle || 'N/A',
                    };

                    setVehicle(fetchedVehicle);
                    setLoanAmount(fetchedVehicle.price.toString());
                } else {
                    setError(`No vehicle found with ID: ${id}`);
                }
            } catch (err) {
                console.error("Error fetching vehicle:", err);
                setError("Failed to load vehicle details. Please check your Firebase connection.");
            } finally {
                setLoading(false);
            }
        };

        fetchVehicle();
    }, [id]);

    if (loading) {
        return (
            <div className="min-h-screen py-12 text-center">
                <p className="text-lg">Loading vehicle details...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen py-12 text-center text-red-500">
                <h2 className="text-2xl font-bold mb-4">Error loading vehicle</h2>
                <p className="mb-4">{error}</p>
                <Button onClick={() => navigate('/inventory')}>
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    Back to Inventory
                </Button>
            </div>
        );
    }

    if (!vehicle) {
        return <div className="min-h-screen py-12 text-center">Vehicle data not available.</div>;
    }

    const mainImageSrc = (vehicle.images.length > currentImageIndex)
        ? vehicle.images[currentImageIndex]
        : "/placeholder-car.jpg";

    const handlePreviousImage = () => {
        setCurrentImageIndex((prev) => (prev === 0 ? vehicle.images.length - 1 : prev - 1));
    };

    const handleNextImage = () => {
        setCurrentImageIndex((prev) => (prev === vehicle.images.length - 1 ? 0 : prev + 1));
    };

    const calculateMonthlyPayment = () => {
        const principal = parseFloat(loanAmount) || vehicle.price;
        const down = parseFloat(downPayment) || 0;
        const rate = parseFloat(interestRate) / 100 / 12;
        const term = parseFloat(loanTerm);
        const loanPrincipal = principal - down;

        if (rate === 0) return (loanPrincipal / term).toFixed(0);

        const monthlyPayment = loanPrincipal * (rate * Math.pow(1 + rate, term)) / (Math.pow(1 + rate, term) - 1);
        return monthlyPayment.toFixed(0);
    };

    return (
        <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto">
                <Button
                    variant="ghost"
                    className="mb-6 flex items-center"
                    onClick={() => navigate("/inventory")}
                >
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    Back to Inventory
                </Button>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                        <div className="space-y-1">
                            <h1 className="text-3xl md:text-4xl font-bold text-foreground">
                                {vehicle.year} {vehicle.make} {vehicle.model}
                            </h1>
                            <div className="flex items-center gap-3 flex-wrap">
                                <div className="text-3xl font-bold text-primary">
                                    ${vehicle.price.toLocaleString()}
                                </div>
                                {vehicle.stockNumber && (
                                    <Badge variant="outline" className="font-mono text-sm px-3 py-1">
                                        <Hash className="h-3 w-3 mr-1" />
                                        {vehicle.stockNumber}
                                    </Badge>
                                )}
                            </div>
                            <Badge variant="secondary" className="bg-green-100 text-green-700">
                                {vehicle.condition} Condition
                            </Badge>
                        </div>
                        <Separator />

                        {/* Main Image with Navigation Controls */}
                        <div className="relative">
                            <div className="relative aspect-video w-full overflow-hidden rounded-lg shadow-md bg-gray-100">
                                <img
                                    src={mainImageSrc}
                                    alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                                    className="w-full h-full object-cover"
                                    onError={(e) => { e.currentTarget.src = "/placeholder-car.jpg"; }}
                                />
                                {vehicle.images.length > 1 && (
                                    <>
                                        <Button
                                            variant="secondary"
                                            size="icon"
                                            className="absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/90 hover:bg-white shadow-lg"
                                            onClick={handlePreviousImage}
                                        >
                                            <ChevronLeft className="h-5 w-5" />
                                        </Button>
                                        <Button
                                            variant="secondary"
                                            size="icon"
                                            className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/90 hover:bg-white shadow-lg"
                                            onClick={handleNextImage}
                                        >
                                            <ChevronRight className="h-5 w-5" />
                                        </Button>
                                        <div className="absolute bottom-3 right-3 bg-black/70 text-white px-3 py-1 rounded-full text-sm font-medium">
                                            {currentImageIndex + 1} / {vehicle.images.length}
                                        </div>
                                    </>
                                )}
                            </div>
                            
                            {/* Thumbnail Gallery */}
                            {vehicle.images.length > 1 && (
                                <div className="flex gap-2 mt-4 overflow-x-auto pb-2">
                                    {vehicle.images.map((image, index) => (
                                        <div
                                            key={index}
                                            className={`relative flex-shrink-0 cursor-pointer transition-all ${
                                                currentImageIndex === index ? "ring-2 ring-primary" : "opacity-70 hover:opacity-100"
                                            }`}
                                            onClick={() => setCurrentImageIndex(index)}
                                        >
                                            <img
                                                src={image}
                                                alt={`View ${index + 1}`}
                                                className="w-20 h-20 object-cover rounded"
                                                onError={(e) => { e.currentTarget.src = "/placeholder-car-thumb.jpg"; }}
                                            />
                                            <span className="absolute bottom-1 right-1 bg-black/60 text-white text-xs px-1 rounded">
                                                {index + 1}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* VEHICLE DESCRIPTION - MOVED UP & ENHANCED */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Vehicle Description</CardTitle>
                            </CardHeader>
                            <CardContent className="p-6">
                                {vehicle.description ? (
                                    <p className="text-base leading-relaxed text-foreground whitespace-pre-line">
                                        {vehicle.description}
                                    </p>
                                ) : (
                                    <p className="text-muted-foreground italic">
                                        No description available for this vehicle.
                                    </p>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Key Specifications</CardTitle>
                            </CardHeader>
                            <CardContent className="p-6">
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
                                    <DetailItem icon={<Calendar />} label="Year" value={vehicle.year.toString()} />
                                    <DetailItem icon={<Gauge />} label="Mileage" value={`${vehicle.mileage.toLocaleString()} mi`} />
                                    <DetailItem icon={<Fuel />} label="Fuel Type" value={vehicle.fuelType} />
                                    <DetailItem icon={<Car />} label="Body Style" value={vehicle.bodyStyle || 'N/A'} />
                                    <DetailItem icon={<Car />} label="Transmission" value={vehicle.transmission} />
                                    <DetailItem icon={<Palette />} label="Exterior Color" value={vehicle.exteriorColor} />
                                    <DetailItem icon={<Palette />} label="Interior Color" value={vehicle.interiorColor} />
                                    <DetailItem icon={<Ruler />} label="Engine" value={vehicle.engine} />
                                    {vehicle.stockNumber && (
                                        <DetailItem icon={<Hash />} label="Stock Number" value={vehicle.stockNumber} />
                                    )}
                                </div>
                                <Separator className="my-6" />
                                <DetailItem icon={<Ruler />} label="VIN" value={vehicle.vin} isFullWidth={true} />
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Features & Options</CardTitle>
                            </CardHeader>
                            <CardContent className="p-6">
                                {vehicle.features.length > 0 && (
                                    <>
                                        <h4 className="font-semibold mb-3 text-sm text-muted-foreground">FEATURES</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 mb-6">
                                            {vehicle.features.map((feature, index) => (
                                                <div key={index} className="flex items-center">
                                                    <Check className="h-4 w-4 mr-2 text-primary flex-shrink-0" />
                                                    <span className="text-sm">{feature}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                                
                                {vehicle.options && vehicle.options.length > 0 && (
                                    <>
                                        <Separator className="my-4" />
                                        <h4 className="font-semibold mb-3 text-sm text-muted-foreground">OPTIONS</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                                            {vehicle.options.map((option, index) => (
                                                <div key={index} className="flex items-center">
                                                    <Check className="h-4 w-4 mr-2 text-green-600 flex-shrink-0" />
                                                    <span className="text-sm">{option}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                                
                                {vehicle.features.length === 0 && (!vehicle.options || vehicle.options.length === 0) && (
                                    <p className="text-muted-foreground">No features or options listed.</p>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    <div className="space-y-6">
                        <Card>
                            <CardContent className="p-6 space-y-3">
                                <Button
                                    variant="hero"
                                    size="lg"
                                    className="w-full"
                                    onClick={() => navigate(`/contact?vehicle=${vehicle.id}`)}
                                >
                                    Schedule Test Drive
                                </Button>
                                <Button
                                    variant="outline"
                                    size="lg"
                                    className="w-full"
                                    onClick={() => window.location.href = phoneNumber}
                                >
                                    <Phone className="h-4 w-4 mr-2" />
                                    Call About This Car
                                </Button>
                                <Button
                                    variant="secondary"
                                    size="lg"
                                    className="w-full"
                                    onClick={() => navigate(`/contact?vehicle=${vehicle.id}`)}
                                >
                                    <MessageCircle className="h-4 w-4 mr-2" />
                                    Ask a Question
                                </Button>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center">
                                    <Calculator className="h-5 w-5 mr-2" />
                                    Finance Calculator
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-6 space-y-4">
                                <div>
                                    <Label htmlFor="loan-amount">Loan Amount</Label>
                                    <Input
                                        id="loan-amount"
                                        type="number"
                                        placeholder={vehicle.price.toString()}
                                        value={loanAmount}
                                        onChange={(e) => setLoanAmount(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="down-payment">Down Payment</Label>
                                    <Input
                                        id="down-payment"
                                        type="number"
                                        placeholder="3000"
                                        value={downPayment}
                                        onChange={(e) => setDownPayment(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="interest-rate">Interest Rate (%)</Label>
                                    <Input
                                        id="interest-rate"
                                        type="number"
                                        step="0.1"
                                        value={interestRate}
                                        onChange={(e) => setInterestRate(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="loan-term">Loan Term (months)</Label>
                                    <Input
                                        id="loan-term"
                                        type="number"
                                        value={loanTerm}
                                        onChange={(e) => setLoanTerm(e.target.value)}
                                    />
                                </div>
                                <div className="pt-4 border-t text-center">
                                    <p className="text-sm text-muted-foreground">Estimated Monthly Payment</p>
                                    <p className="text-2xl font-bold text-primary">
                                        ${calculateMonthlyPayment()}/mo
                                    </p>
                                </div>
                                <Button
                                    variant="premium"
                                    className="w-full"
                                    onClick={() => navigate("/financing")}
                                >
                                    Apply for Financing
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Simple utility component for detail items
const DetailItem: React.FC<{ icon: React.ReactNode, label: string, value: string, isFullWidth?: boolean }> = ({ icon, label, value, isFullWidth = false }) => (
    <div className={isFullWidth ? "col-span-full" : ""}>
        <div className="flex items-center text-sm font-medium mb-1 text-muted-foreground">
            {icon}
            <span className="ml-2">{label}</span>
        </div>
        <p className="text-base font-semibold text-foreground">{value || 'N/A'}</p>
    </div>
);

export default VehicleDetails;