// src/pages/admin/InventoryDashboard.tsx
// CLEAN IMPLEMENTATION - Native BarcodeDetector with ZXing fallback

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { v4 as uuidv4 } from 'uuid';


// FIREBASE IMPORTS
import { db, storage } from '@/firebaseConfig';
import { collection, doc, getDocs, deleteDoc, updateDoc, setDoc, query, where, orderBy, limit, addDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// Shadcn/UI Imports
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';

// Icon Imports
import { Trash2, Car, PlusCircle, Pencil, Upload, Loader2, X, Scan, AlertCircle, CheckCircle2, Camera, XCircle, DollarSign, Users } from 'lucide-react';

// Import Vehicle type
import { Vehicle } from '@/types/vehicle';
import { CustomerInteractionDashboard } from '@/pages/admin/CustomerInteractionDashboard';

// ADD THIS NEW FUNCTION - Place it right before the InventoryDashboard component
const sendReviewLinkToCustomer = async (soldVehicleData: {
    soldVehicleId: string;
    customerName: string;
    customerPhone: string;
    vehicleYear: number;
    vehicleMake: string;
    vehicleModel: string;
}) => {
    try {
        // REPLACE THIS URL WITH YOUR ACTUAL CLOUD FUNCTION URL AFTER DEPLOYMENT
        const response = await fetch(
            'https://us-central1-savvy-ds-49b12.cloudfunctions.net/sendReviewLink',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(soldVehicleData)
            }
        );

        const result = await response.json();
        
        if (result.success) {
            console.log('✓ Review link sent successfully');
            return true;
        } else {
            console.error('✗ Failed to send review link:', result.message);
            return false;
        }
    } catch (error) {
        console.error('Error sending review link:', error);
        return false;
    }
};


// ====================================================================
// CONSTANTS & CONFIGURATION
// ====================================================================

const VEHICLES_COLLECTION = 'vehicles';
const SOLD_VEHICLES_COLLECTION = 'sold_vehicles';
const MAX_IMAGES = 10;
const NHTSA_API_BASE = 'https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues';

// ====================================================================
// SCHEMA DEFINITION
// ====================================================================

const InventorySchema = z.object({
    make: z.string().min(2, { message: "Make is required." }),
    model: z.string().min(2, { message: "Model is required." }),
    year: z.coerce.number().int().min(1900, { message: "Invalid year." }).max(new Date().getFullYear() + 1, { message: "Future year not allowed." }),
    price: z.coerce.number().int().min(100, { message: "Price must be greater than 100." }),
    mileage: z.coerce.number().int().min(0, { message: "Mileage cannot be negative." }),
    engine: z.string().min(1, { message: "Engine is required." }),
    transmission: z.string().min(1, { message: "Transmission is required." }),
    fuelType: z.string().min(1, { message: "Fuel type is required." }),
    exteriorColor: z.string().min(1, { message: "Exterior color is required." }),
    interiorColor: z.string().min(1, { message: "Interior color is required." }),
    vin: z.string().min(17, { message: "VIN must be at least 17 characters." }).max(17, { message: "VIN must be exactly 17 characters." }),
    description: z.string().min(1, { message: "Description is required." }),
    bodyStyle: z.string().min(1, { message: "Body style is required." }),
    isNew: z.boolean().default(false),
    isFeatured: z.boolean().optional(),
    condition: z.string().optional(),
    featuresInput: z.string().optional(),
    optionsInput: z.string().optional(),
    images: z.array(z.string()).optional(),
});

type InventoryFormValues = z.infer<typeof InventorySchema>;

// NHTSA API Response Type
interface NHTSAVehicleData {
    Make?: string;
    Model?: string;
    ModelYear?: string;
    FuelTypePrimary?: string;
    EngineConfiguration?: string;
    EngineCylinders?: string;
    DisplacementL?: string;
    TransmissionStyle?: string;
    DriveType?: string;
    VehicleType?: string;
    BodyClass?: string;
    ErrorCode?: string;
    ErrorText?: string;
}

// ====================================================================
// UTILITY FUNCTIONS
// ====================================================================

const generateStockNumber = async (): Promise<string> => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `${year}-${month}-`;

    try {
        const vehiclesRef = collection(db, VEHICLES_COLLECTION);
        const q = query(
            vehiclesRef,
            where('stockNumber', '>=', prefix),
            where('stockNumber', '<', prefix + '\uf8ff'),
            orderBy('stockNumber', 'desc'),
            limit(1)
        );
        
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            return `${prefix}001`;
        }
        
        const lastStockNumber = snapshot.docs[0].data().stockNumber as string;
        const lastSequential = parseInt(lastStockNumber.split('-')[2]) || 0;
        const newSequential = String(lastSequential + 1).padStart(3, '0');
        
        return `${prefix}${newSequential}`;
    } catch (error) {
        console.error("Error generating stock number:", error);
        const randomSeq = String(Math.floor(Math.random() * 999) + 1).padStart(3, '0');
        return `${prefix}${randomSeq}`;
    }
};

const decodeVIN = async (vin: string): Promise<NHTSAVehicleData | null> => {
    if (vin.length !== 17) {
        throw new Error('VIN must be exactly 17 characters');
    }

    try {
        const response = await fetch(`${NHTSA_API_BASE}/${vin}?format=json`);
        
        if (!response.ok) {
            throw new Error('Failed to decode VIN');
        }

        const data = await response.json();
        
        if (data.Results && data.Results.length > 0) {
            const result = data.Results[0] as NHTSAVehicleData;
            
            console.log('NHTSA Response:', result);
            
            if (result.ErrorCode && result.ErrorCode !== "0") {
                console.error('NHTSA Error:', result.ErrorText);
                throw new Error(result.ErrorText || 'Invalid VIN');
            }
            
            return result;
        }
        
        return null;
    } catch (error) {
        console.error('VIN decode error:', error);
        throw error;
    }
};

const mapFuelType = (nhtsaFuelType?: string): string => {
    if (!nhtsaFuelType) return 'Gas';
    const fuelTypeLower = nhtsaFuelType.toLowerCase();
    if (fuelTypeLower.includes('electric')) return 'Electric';
    if (fuelTypeLower.includes('diesel')) return 'Diesel';
    if (fuelTypeLower.includes('hybrid')) return 'Hybrid';
    return 'Gas';
};

const mapTransmission = (nhtsaTransmission?: string, nhtsDriveType?: string): string => {
    if (nhtsDriveType) {
        const driveTypeLower = nhtsDriveType.toLowerCase();
        if (driveTypeLower.includes('awd') || driveTypeLower.includes('all')) return 'AWD';
        if (driveTypeLower.includes('4wd') || driveTypeLower.includes('4x4')) return '4WD';
        if (driveTypeLower.includes('fwd') || driveTypeLower.includes('front')) return 'FWD';
        if (driveTypeLower.includes('rwd') || driveTypeLower.includes('rear')) return 'RWD';
    }
    if (nhtsaTransmission) {
        const transLower = nhtsaTransmission.toLowerCase();
        if (transLower.includes('manual')) return 'Manual';
    }
    return 'Automatic';
};

const buildEngineDescription = (data: NHTSAVehicleData): string => {
    const parts: string[] = [];
    if (data.DisplacementL) parts.push(`${data.DisplacementL}L`);
    if (data.EngineCylinders) {
        parts.push(`${data.EngineCylinders}-Cylinder`);
    } else if (data.EngineConfiguration) {
        parts.push(data.EngineConfiguration);
    }
    return parts.length > 0 ? parts.join(' ') : 'Standard Engine';
};

const mapBodyStyle = (nhtsaData: NHTSAVehicleData): string => {
    // Priority: BodyClass > VehicleType
    const bodyClass = nhtsaData.BodyClass || '';
    const vehicleType = nhtsaData.VehicleType || '';
    
    // Use BodyClass first as it's more specific
    if (bodyClass) {
        return bodyClass;
    }
    
    // Fallback to VehicleType
    if (vehicleType) {
        return vehicleType;
    }
    
    // Default fallback
    return 'Sedan';
};

// ====================================================================
// MAIN COMPONENT
// ====================================================================

export const InventoryDashboard: React.FC = () => {
    const [inventory, setInventory] = useState<Vehicle[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [currentEditingVehicle, setCurrentEditingVehicle] = useState<Vehicle | null>(null);
    const [filesToUpload, setFilesToUpload] = useState<File[]>([]);
    const [existingImageUrls, setExistingImageUrls] = useState<string[]>([]);
    
    // VIN Scanner State
    const [vinInput, setVinInput] = useState('');
    const [isDecodingVin, setIsDecodingVin] = useState(false);
    const [vinDecodeStatus, setVinDecodeStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [vinDecodeMessage, setVinDecodeMessage] = useState('');
    
    // Camera Scanner State
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [isCameraScanning, setIsCameraScanning] = useState(false);
    const [scanStatus, setScanStatus] = useState('Initializing...');
    const [cameraError, setCameraError] = useState('');
    const videoRef = React.useRef<HTMLVideoElement>(null);
    const streamRef = React.useRef<MediaStream | null>(null);
    const rafRef = React.useRef<number | null>(null);
    const isScanningRef = React.useRef<boolean>(false);
    const zxingReaderRef = React.useRef<any>(null);

    // Mark Sold State
    const [showSoldModal, setShowSoldModal] = useState(false);
    const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');

    const [requestFeedback, setRequestFeedback] = useState(true);

    const { toast } = useToast();

    // Forms
    const addForm = useForm<InventoryFormValues>({
        resolver: zodResolver(InventorySchema),
        defaultValues: { 
            make: "", model: "", year: new Date().getFullYear(), price: 0, mileage: 0, 
            engine: "", transmission: "Automatic", fuelType: "", exteriorColor: "", interiorColor: "",
            vin: "", description: "", bodyStyle: "", isNew: false, isFeatured: false, condition: "",
            featuresInput: "", optionsInput: "", images: [],
        },
    });

    const editForm = useForm<InventoryFormValues>({
        resolver: zodResolver(InventorySchema),
        defaultValues: { 
            make: "", model: "", year: new Date().getFullYear(), price: 0, mileage: 0,
            engine: "", transmission: "Automatic", fuelType: "", exteriorColor: "", interiorColor: "",
            vin: "", description: "", bodyStyle: "", isNew: false, isFeatured: false, condition: "",
            featuresInput: "", optionsInput: "", images: [],
        },
    });


    // ====================================================================
    // MARK SOLD HANDLERS
    // ====================================================================

    const handleOpenSoldModal = (vehicle: Vehicle) => {
        setSelectedVehicle(vehicle);
        setCustomerName('');
        setCustomerPhone('');
        setShowSoldModal(true);
    };

    const handleCloseSoldModal = () => {
        setSelectedVehicle(null);
        setCustomerName('');
        setCustomerPhone('');
        setShowSoldModal(false);
    };

    const handleMarkSold = async () => {
        if (!customerName || !customerPhone) {
            alert('Please enter customer name and phone');
            return;
        }

        if (!selectedVehicle) {
            alert('No vehicle selected');
            return;
        }

        try {
            setIsSubmitting(true);
            
            console.log('🟢 Marking vehicle as sold:', {
                vehicleId: selectedVehicle.id,
                vehicle: `${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model}`,
                customerName,
                customerPhone,
                requestFeedback,
            });

            // 1. ADD TO sold_vehicles COLLECTION
            const soldVehiclesRef = collection(db, 'sold_vehicles');
            const soldVehicleData = {
                vehicleId: selectedVehicle.id,
                customerName: customerName,
                customerPhone: customerPhone,
                requestFeedback: requestFeedback,
                feedbackSent: false,
                vin: selectedVehicle.vin,
                year: selectedVehicle.year,
                make: selectedVehicle.make,
                model: selectedVehicle.model,
                price: selectedVehicle.price,
                mileage: selectedVehicle.mileage,
                stockNumber: selectedVehicle.stockNumber || '',
                dateSold: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                images: selectedVehicle.images || [],
                isNew: selectedVehicle.isNew || false,
                isFeatured: selectedVehicle.isFeatured || false
            };
            
            console.log('📝 Saving to sold_vehicles');
            const soldDocRef = await addDoc(soldVehiclesRef, soldVehicleData);
            console.log('✅ Added to sold_vehicles with ID:', soldDocRef.id);

            // 2. SEND REVIEW LINK IMMEDIATELY
            if (requestFeedback) {
                console.log('📱 Sending review link...');
                
                const reviewSent = await sendReviewLinkToCustomer({
                    soldVehicleId: soldDocRef.id,
                    customerName: customerName,
                    customerPhone: customerPhone,
                    vehicleYear: selectedVehicle.year,
                    vehicleMake: selectedVehicle.make,
                    vehicleModel: selectedVehicle.model
                });
                
                if (reviewSent) {
                    console.log('✅ Review link sent');
                    toast({
                        title: "Success! 🎉",
                        description: `Vehicle sold & review link sent to ${customerName}`,
                    });
                } else {
                    console.warn('⚠️ Review link failed');
                    toast({
                        title: "Partial Success",
                        description: "Vehicle sold but review link failed. Check logs.",
                        variant: "destructive"
                    });
                }
            } else {
                toast({
                    title: "Vehicle Sold! ✓",
                    description: `${selectedVehicle.make} ${selectedVehicle.model} marked as sold`,
                });
            }

            // 3. REMOVE FROM INVENTORY
            const vehicleRef = doc(db, 'vehicles', selectedVehicle.id);
            await deleteDoc(vehicleRef);
            
            // 4. UPDATE STATE
            setInventory(prev => prev.filter(v => v.id !== selectedVehicle.id));
            
            // 5. RESET
            setCustomerName('');
            setCustomerPhone('');
            setRequestFeedback(true);
            setShowSoldModal(false);
            setSelectedVehicle(null);

        } catch (error) {
            console.error('❌ Error:', error);
            toast({
                title: "Error",
                description: `Failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                variant: "destructive"
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    // ====================================================================
    // VIN DECODE HANDLER
    // ====================================================================
    
    const handleVinScan = async () => {
        const cleanVin = vinInput.trim().toUpperCase();
        
        if (cleanVin.length !== 17) {
            setVinDecodeStatus('error');
            setVinDecodeMessage('VIN must be exactly 17 characters');
            return;
        }

        setIsDecodingVin(true);
        setVinDecodeStatus('idle');
        setVinDecodeMessage('');

        try {
            const decodedData = await decodeVIN(cleanVin);
            
            if (!decodedData) {
                throw new Error('No data returned from VIN decoder');
            }

            addForm.setValue('vin', cleanVin);
            if (decodedData.Make) addForm.setValue('make', decodedData.Make);
            if (decodedData.Model) addForm.setValue('model', decodedData.Model);
            if (decodedData.ModelYear) {
                const year = parseInt(decodedData.ModelYear);
                if (!isNaN(year)) addForm.setValue('year', year);
            }
            
            addForm.setValue('engine', buildEngineDescription(decodedData));
            addForm.setValue('fuelType', mapFuelType(decodedData.FuelTypePrimary));
            addForm.setValue('transmission', mapTransmission(decodedData.TransmissionStyle, decodedData.DriveType));
            addForm.setValue('bodyStyle', mapBodyStyle(decodedData));
            
            const vehicleType = decodedData.VehicleType || decodedData.BodyClass || 'Vehicle';
            const description = `${decodedData.ModelYear || ''} ${decodedData.Make || ''} ${decodedData.Model || ''} ${vehicleType}. This vehicle features a ${buildEngineDescription(decodedData)} engine with ${mapTransmission(decodedData.TransmissionStyle, decodedData.DriveType)} transmission. Additional details to be added.`; 
            addForm.setValue('description', description.trim());

            setVinDecodeStatus('success');
            setVinDecodeMessage(`Successfully decoded VIN! ${decodedData.Make} ${decodedData.Model} data populated.`);
            
            toast({
                title: "VIN Decoded Successfully! ✓",
                description: `${decodedData.Make} ${decodedData.Model} information has been populated.`,
            });

        } catch (error) {
            setVinDecodeStatus('error');
            const errorMessage = error instanceof Error ? error.message : 'Failed to decode VIN';
            setVinDecodeMessage(errorMessage);
            toast({ title: "VIN Decode Failed", description: errorMessage, variant: "destructive" });
        } finally {
            setIsDecodingVin(false);
        }
    };

    // ====================================================================
    // SCANNER UTILITIES (Native BarcodeDetector preferred + ZXing fallback)
    // ====================================================================

    const loadZXing = async () => {
        return new Promise<void>((resolve) => {
            if ((window as any).ZXing) {
                resolve();
                return;
            }
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/@zxing/library@0.20.0/umd/index.min.js';
            script.onload = () => {
                console.log('✅ ZXing library loaded');
                resolve();
            };
            script.onerror = () => {
                console.error('❌ Failed to load ZXing');
                resolve();
            };
            document.head.appendChild(script);
        });
    };

    const stopStream = () => {
        try {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(t => t.stop());
                streamRef.current = null;
            }
        } catch (e) {
            console.warn('Error stopping stream', e);
        }
    };

    const handleOpenCamera = async () => {
        console.log('🎥 Opening camera for barcode scan...');
        setCameraError('');
        setIsCameraOpen(true);
        setIsCameraScanning(true);
        isScanningRef.current = true;
        setScanStatus('Opening camera...');

        try {
            // request camera
            const constraints: MediaStreamConstraints = {
                video: {
                    facingMode: 'environment',
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            streamRef.current = stream;

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
            }

            setScanStatus('Scanner active — point at VIN barcode');
            // Start scanning loop that chooses best method
            startCameraScanning();
        } catch (e: any) {
            console.error('❌ Camera error:', e);
            const msg = e.name === 'NotAllowedError' 
                ? 'Camera access denied. Allow camera in settings.' 
                : `Camera error: ${e.message || e.toString()}`;
            setCameraError(msg);
            setIsCameraScanning(false);
            isScanningRef.current = false;
            toast({ title: "Camera Error", description: msg, variant: "destructive" });
        }
    };

    const handleCloseCamera = () => {
        console.log('🛑 Closing camera...');
        isScanningRef.current = false;
        setIsCameraOpen(false);
        setIsCameraScanning(false);
        setScanStatus('');
        if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }
        stopStream();
        // Reset ZXing reader if present
        if (zxingReaderRef.current && typeof zxingReaderRef.current.reset === 'function') {
            try { zxingReaderRef.current.reset(); } catch(e) {}
            zxingReaderRef.current = null;
        }
    };

    // Clean / validate VIN string
    const cleanPotentialVIN = (text: string | undefined | null): string | null => {
        if (!text) return null;
        const cleaned = String(text).replace(/[^A-Z0-9]/gi, '').toUpperCase();
        if (cleaned.length !== 17) return null;
        // VIN should not contain I, O, Q
        if (/[IOQ]/.test(cleaned)) return null;
        // simple first-char sanity (1-5 or letters excluding I O Q)
        const firstChar = cleaned[0];
        if (!/[1-5A-HJ-NPR-Z]/.test(firstChar)) return null;
        return cleaned;
    };

    // Main camera scanning loop - prefer BarcodeDetector if available
    const startCameraScanning = async () => {
        const video = videoRef.current;
        if (!video) {
            setCameraError('Video element not available.');
            handleCloseCamera();
            return;
        }

        const useNative = ('BarcodeDetector' in window);
        console.log('Scanner method:', useNative ? 'BarcodeDetector (native)' : 'ZXing fallback');

        // Center ROI size (percent of video)
        const ROI = { wPct: 0.8, hPct: 0.35 }; // wide and short for VIN barcodes
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // ZXing setup placeholder
        let zxingReader: any = null;

        if (!useNative) {
            // Load ZXing library and prepare reader
            await loadZXing();
            const ZXing = (window as any).ZXing;
            if (ZXing && ZXing.BrowserMultiFormatReader) {
                zxingReader = new ZXing.BrowserMultiFormatReader();
                zxingReaderRef.current = zxingReader;
                console.log('✅ ZXing reader initialized (fallback)');
            } else {
                console.warn('ZXing not available after load — scanning may fail.');
            }
        }

        // For BarcodeDetector: try a broad set of formats
        let detector: any = null;
        if (useNative) {
            try {
                // preferred formats include PDF417 and common 1D types; if constructor supports options, pass formats
                const formats = [
                    'code_39', 'code_128', 'code_93', 'ean_13', 'ean_8', 'upc_e', 'upc_a',
                    'itf', 'rss14', 'qr_code', 'pdf417'
                ];
                try {
                    // Some browsers expect format strings; others ignore unknown formats gracefully
                    detector = new (window as any).BarcodeDetector({ formats });
                } catch {
                    detector = new (window as any).BarcodeDetector();
                }
                console.log('✅ Native BarcodeDetector created');
            } catch (err) {
                console.warn('Native BarcodeDetector failed to initialize:', err);
                detector = null;
            }
        }

        // scanning loop using requestAnimationFrame for low-latency
        const step = async () => {
            if (!isScanningRef.current || !video || video.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA) {
                rafRef.current = requestAnimationFrame(step);
                return;
            }

            try {
                // compute ROI coordinates
                const vw = video.videoWidth;
                const vh = video.videoHeight;
                if (!vw || !vh) {
                    rafRef.current = requestAnimationFrame(step);
                    return;
                }

                const roiWidth = Math.max(200, Math.floor(vw * ROI.wPct));
                const roiHeight = Math.max(80, Math.floor(vh * ROI.hPct));
                const sx = Math.floor((vw - roiWidth) / 2);
                const sy = Math.floor((vh - roiHeight) / 2);

                canvas.width = roiWidth;
                canvas.height = roiHeight;

                // draw ROI from video to canvas (improves performance and avoids scanning whole frame)
                ctx?.drawImage(video, sx, sy, roiWidth, roiHeight, 0, 0, roiWidth, roiHeight);

                // First try native BarcodeDetector
                if (detector) {
                    try {
                        // create ImageBitmap from canvas for detector (better performance)
                        const bitmap = await createImageBitmap(canvas);
                        const barcodes = await detector.detect(bitmap as any);
                        bitmap.close && bitmap.close();
                        if (barcodes && barcodes.length > 0) {
                            for (const b of barcodes) {
                                const raw = b.rawValue || (b.data) || '';
                                const candidate = cleanPotentialVIN(raw);
                                if (candidate) {
                                    console.log('✅ Native detected VIN:', candidate);
                                    await handleDetectedVIN(candidate);
                                    return; // stop scanning
                                }
                            }
                        }
                    } catch (bdErr) {
                        // The native detector can throw on some frames - ignore and fallback to ZXing if available
                        // console.debug('Native detector frame error', bdErr);
                    }
                }

                // ZXing fallback using decodeFromCanvas approach (more robust preprocessing)
                if (zxingReader) {
                    try {
                        // convert canvas to data URL (small ROI) and attempt decodeFromCanvas
                        // The ZXing UMD exposes decodeFromCanvas via .decodeFromCanvas? We'll use decodeFromCanvas approach:
                        // Some versions provide: zxingReader.decodeFromCanvas(canvas)
                        // If not available, use decodeFromCanvas via BrowserMultiFormatReader.prototype.decodeFromCanvas
                        const ZXingLib = (window as any).ZXing;
                        if (ZXingLib && zxingReader && typeof zxingReader.decodeFromCanvas === 'function') {
                            try {
                                const result = zxingReader.decodeFromCanvas(canvas);
                                if (result) {
                                    const raw = result.getText ? result.getText() : (result.text || result.rawValue || '');
                                    const candidate = cleanPotentialVIN(raw);
                                    if (candidate) {
                                        console.log('✅ ZXing decodeFromCanvas VIN:', candidate);
                                        await handleDetectedVIN(candidate);
                                        return;
                                    }
                                }
                            } catch (inner) {
                                // decodeFromCanvas may throw if not found
                            }
                        }

                        // If decodeFromCanvas is not available or it failed, perform manual decode on an ImageData
                        // We'll use the BrowserMultiFormatReader's decodeFromImageElement or decodeFromCanvas in a try/catch.
                        if (zxingReader && typeof zxingReader.decodeBitmap === 'function') {
                            // some builds have decodeBitmap - try
                            try {
                                // create ImageBitmap and call decode
                                const bitmap = await createImageBitmap(canvas);
                                const result = await zxingReader.decodeBitmap(bitmap);
                                bitmap.close && bitmap.close();
                                if (result) {
                                    const raw = result.getText ? result.getText() : (result.text || result.rawValue || '');
                                    const candidate = cleanPotentialVIN(raw);
                                    if (candidate) {
                                        console.log('✅ ZXing decodeBitmap VIN:', candidate);
                                        await handleDetectedVIN(candidate);
                                        return;
                                    }
                                }
                            } catch { /* ignore */ }
                        }

                        // As a last resort, attempt the commonly-available decodeFromCanvas async usage:
                        if (zxingReader && typeof zxingReader.decodeFromCanvas === 'function') {
                            try {
                                const result = await new Promise<any>((resolve) => {
                                    try {
                                        const r = zxingReader.decodeFromCanvas(canvas);
                                        resolve(r);
                                    } catch (e) {
                                        resolve(null);
                                    }
                                });
                                if (result) {
                                    const raw = result.getText ? result.getText() : (result.text || result.rawValue || '');
                                    const candidate = cleanPotentialVIN(raw);
                                    if (candidate) {
                                        console.log('✅ ZXing final decode VIN:', candidate);
                                        await handleDetectedVIN(candidate);
                                        return;
                                    }
                                }
                            } catch { /* ignore */ }
                        }
                    } catch (zxErr) {
                        // ZXing decode errors per frame are expected sometimes
                        // console.debug('ZXing frame decode error', zxErr);
                    }
                }

                // Update status occasionally
                if (Math.random() < 0.05) {
                    setScanStatus('Scanning...');
                }
            } catch (outerErr) {
                // swallow scanning errors to avoid crashing loop
                // console.warn('Scan loop error', outerErr);
            } finally {
                // keep loop alive
                rafRef.current = requestAnimationFrame(step);
            }
        };

        // kick off loop
        if (!isScanningRef.current) isScanningRef.current = true;
        rafRef.current = requestAnimationFrame(step);
    };

    // Called when a valid VIN has been detected via camera scan
    const handleDetectedVIN = async (vin: string) => {
        console.log('🎯 Processing detected VIN', vin);
        // Stop scanning immediately
        try {
            isScanningRef.current = false;
            if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
            stopStream();
        } catch (e) {}

        setIsCameraOpen(false);
        setIsCameraScanning(false);
        setScanStatus('');
        setVinInput(vin);

        toast({ 
            title: "VIN Scanned! 📸", 
            description: `${vin} - Decoding...`,
            duration: 3000 
        });

        setIsDecodingVin(true);
        setVinDecodeStatus('idle');

        try {
            const data = await decodeVIN(vin);
            if (!data) throw new Error('VIN not in NHTSA database');

            addForm.setValue('vin', vin);
            if (data.Make) addForm.setValue('make', data.Make);
            if (data.Model) addForm.setValue('model', data.Model);
            if (data.ModelYear) {
                const year = parseInt(data.ModelYear);
                if (!isNaN(year)) addForm.setValue('year', year);
            }
            addForm.setValue('engine', buildEngineDescription(data));
            addForm.setValue('fuelType', mapFuelType(data.FuelTypePrimary));
            addForm.setValue('transmission', mapTransmission(data.TransmissionStyle, data.DriveType));
            addForm.setValue('bodyStyle', mapBodyStyle(data));
            
            const vehicleType = data.VehicleType || data.BodyClass || 'Vehicle';
            const description = `${data.ModelYear || ''} ${data.Make || ''} ${data.Model || ''} ${vehicleType}. This vehicle features a ${buildEngineDescription(data)} engine with ${mapTransmission(data.TransmissionStyle, data.DriveType)} transmission.`;
            addForm.setValue('description', description.trim());

            setVinDecodeStatus('success');
            setVinDecodeMessage(`Scanned ${data.Make} ${data.Model}!`);
            
            toast({
                title: "✅ Auto-Filled!",
                description: `${data.Make} ${data.Model} - Add price/mileage/photos`,
                duration: 5000,
            });

        } catch (e: any) {
            setVinDecodeStatus('error');
            const errorMessage = e.message || 'Failed to decode VIN';
            setVinDecodeMessage(`Scanned: ${vin} - ${errorMessage}`);
            addForm.setValue('vin', vin);
            
            toast({ 
                title: "⚠️ Verify VIN", 
                description: `Scanned: ${vin}. Verify and click Decode VIN.`, 
                variant: "destructive",
                duration: 7000,
            });
        } finally {
            setIsDecodingVin(false);
        }
    };

    useEffect(() => {
        return () => {
            // cleanup on unmount
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            stopStream();
            if (zxingReaderRef.current && typeof zxingReaderRef.current.reset === 'function') {
                try { zxingReaderRef.current.reset(); } catch(e) {}
            }
        };
    }, []);

    // ====================================================================
    // IMAGE UPLOAD
    // ====================================================================
    
    const uploadImages = async (files: File[], vehicleId: string): Promise<string[]> => {
        const uploadPromises = files.map(async (file) => {
            const fileExtension = file.name.split('.').pop() || 'jpg';
            const fileName = `${vehicleId}/${uuidv4()}.${fileExtension}`;
            const storageRef = ref(storage, `vehicles/${fileName}`);
            await uploadBytes(storageRef, file);
            return getDownloadURL(storageRef);
        });
        return Promise.all(uploadPromises);
    };

    // ====================================================================
    // CRUD OPERATIONS
    // ====================================================================
    
    const fetchInventory = async () => {
        setIsLoading(true);
        try {
            const vehiclesRef = collection(db, VEHICLES_COLLECTION);
            const snapshot = await getDocs(vehiclesRef);
            
            const list: Vehicle[] = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    make: data.make || '',
                    model: data.model || '',
                    year: data.year || new Date().getFullYear(),
                    price: data.price || 0,
                    mileage: data.mileage || 0,
                    engine: data.engine || '',
                    transmission: data.transmission || '',
                    fuelType: data.fuelType || '',
                    exteriorColor: data.exteriorColor || '',
                    interiorColor: data.interiorColor || '',
                    vin: data.vin || '',
                    stockNumber: data.stockNumber || undefined,
                    description: data.description || '',
                    bodyStyle: data.bodyStyle || '',
                    isNew: data.isNew || false,
                    isFeatured: data.isFeatured || false,
                    condition: data.condition || '',
                    images: data.images || [],
                    features: data.features || [],
                    options: data.options || [],
                    createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
                    updatedAt: data.updatedAt ? new Date(data.updatedAt) : new Date(),
                } as Vehicle;
            });
            
            setInventory(list);
        } catch (error) {
            console.error("Error fetching inventory:", error);
            toast({ title: "Error", description: "Failed to load inventory.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchInventory();
    }, []);

    const onAddSubmit = async (values: InventoryFormValues) => {
        if (filesToUpload.length === 0) {
            toast({ title: "Images Required", description: "Please upload at least one vehicle image.", variant: "destructive" });
            return;
        }
        setIsSubmitting(true);
        
        try {
            const vehiclesRef = collection(db, VEHICLES_COLLECTION);
            const newDocRef = doc(vehiclesRef);
            const docId = newDocRef.id;
            const stockNumber = await generateStockNumber();
            const imageUrls = await uploadImages(filesToUpload, docId);

            const features = values.featuresInput 
                ? values.featuresInput.split(',').map(f => f.trim()).filter(f => f.length > 0)
                : [];
            const options = values.optionsInput 
                ? values.optionsInput.split(',').map(o => o.trim()).filter(o => o.length > 0)
                : [];

            const vehicleData = {
                ...values,
                stockNumber,
                drivetrain: values.transmission,
                features,
                options,
                images: imageUrls,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            await setDoc(newDocRef, vehicleData);

            addForm.reset();
            setFilesToUpload([]);
            setVinInput('');
            setVinDecodeStatus('idle');
            setVinDecodeMessage('');
            fetchInventory();
            toast({ title: "Vehicle Added! 🚗", description: `${values.make} ${values.model} (Stock #${stockNumber}) added successfully.` });
        } catch (error) {
            console.error("Error adding vehicle:", error);
            toast({ title: "Error", description: "Failed to add vehicle. Please try again.", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const onUpdateSubmit = async (values: InventoryFormValues) => {
        if (!currentEditingVehicle) return;
        setIsSubmitting(true);
        
        try {
            const docRef = doc(db, VEHICLES_COLLECTION, currentEditingVehicle.id);
            let finalImageUrls = existingImageUrls;

            if (filesToUpload.length > 0) {
                const newUrls = await uploadImages(filesToUpload, currentEditingVehicle.id);
                finalImageUrls = [...existingImageUrls, ...newUrls];
            }

            const features = values.featuresInput 
                ? values.featuresInput.split(',').map(f => f.trim()).filter(f => f.length > 0)
                : currentEditingVehicle.features || [];
            const options = values.optionsInput 
                ? values.optionsInput.split(',').map(o => o.trim()).filter(o => o.length > 0)
                : currentEditingVehicle.options || [];

            const vehicleData = {
                ...values,
                stockNumber: currentEditingVehicle.stockNumber,
                drivetrain: values.transmission,
                features,
                options,
                images: finalImageUrls,
                updatedAt: new Date(),
            };

            await updateDoc(docRef, vehicleData);
            
            fetchInventory();
            setIsEditDialogOpen(false);
            setFilesToUpload([]);
            toast({ title: "Updated! ✨", description: `${values.make} ${values.model} updated successfully.` });
        } catch (error) {
            console.error("Error updating vehicle:", error);
            toast({ title: "Error", description: "Failed to update vehicle.", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (vehicle: Vehicle) => {
        if (!window.confirm(`Delete ${vehicle.make} ${vehicle.model}? This cannot be undone.`)) return;
        
        try {
            await deleteDoc(doc(db, VEHICLES_COLLECTION, vehicle.id));
            fetchInventory();
            toast({ title: "Deleted", description: `${vehicle.make} ${vehicle.model} removed.` });
        } catch (error) {
            console.error("Error deleting:", error);
            toast({ title: "Error", description: "Failed to delete vehicle.", variant: "destructive" });
        }
    };
    
    const handleEditClick = (vehicle: Vehicle) => {
        setCurrentEditingVehicle(vehicle);
        editForm.reset({
            ...vehicle,
            featuresInput: vehicle.features.join(', ') || '',
            optionsInput: vehicle.options?.join(', ') || '',
        });
        setExistingImageUrls(vehicle.images || []);
        setFilesToUpload([]);
        setIsEditDialogOpen(true);
    };

    const handleRemoveExistingImage = (url: string) => {
        setExistingImageUrls(prev => prev.filter(u => u !== url));
        toast({ title: "Image Removed", description: "Click 'Save changes' to confirm." });
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        const totalImages = (currentEditingVehicle ? existingImageUrls.length : 0) + files.length;
        
        if (totalImages > MAX_IMAGES) {
            toast({ title: "Limit Reached", description: `Maximum ${MAX_IMAGES} images per vehicle.`, variant: "destructive" });
            e.target.value = '';
            return;
        }
        setFilesToUpload(files);
    };

    const handleRemoveFileToUpload = (index: number) => {
        setFilesToUpload(prev => prev.filter((_, i) => i !== index));
    };

    // ====================================================================
    // FORM RENDER
    // ====================================================================

   const renderVehicleFormFields = (formInstance: ReturnType<typeof useForm<InventoryFormValues>>, isEdit: boolean = false) => {
    const currentImages = isEdit ? existingImageUrls : [];
    const totalImages = currentImages.length + filesToUpload.length;
    const uploadDisabled = totalImages >= MAX_IMAGES;

    // Helper function to determine field styling based on value state
    const getFieldClassName = (value: any, isRequired: boolean = true) => {
        if (!isRequired) return "";
        if (value && value !== "" && value !== 0) {
            return "border-l-4 border-l-emerald-500 bg-emerald-50/30 transition-all duration-200";
        }
        return "border-l-4 border-l-amber-400/60 transition-all duration-200";
    };

    return (
        <>
            {/* VIN SCANNER - Only for Add form */}
            {!isEdit && (
                <div className="md:col-span-3 mb-8">
                    <div className="relative p-6 border-2 border-primary/50 rounded-xl bg-gradient-to-br from-primary/8 via-primary/5 to-transparent shadow-lg shadow-primary/10 hover:shadow-xl hover:shadow-primary/15 transition-all duration-300">
                        {/* Header */}
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-primary/15 rounded-lg">
                                <Scan className="w-6 h-6 text-primary" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-foreground">VIN Decoder</h3>
                                <p className="text-sm text-muted-foreground">
                                    Fast-track your inventory entry
                                </p>
                            </div>
                        </div>
                        
                        <div className="flex flex-col gap-4 mb-4">
                            <div className="flex flex-col sm:flex-row gap-3">
                                <Input
                                    placeholder="Enter 17-character VIN (e.g., 1HGBH41JXMN109186)"
                                    value={vinInput}
                                    onChange={(e) => setVinInput(e.target.value.toUpperCase())}
                                    maxLength={17}
                                    className="font-mono flex-1 text-lg h-12 shadow-sm focus:shadow-md focus:ring-2 focus:ring-primary/20 transition-all duration-200"
                                    disabled={isDecodingVin || isCameraOpen}
                                    autoComplete="off"
                                />
                                <div className="flex gap-2">
                                    <Button
                                        type="button"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handleVinScan();
                                        }}
                                        disabled={isDecodingVin || vinInput.length !== 17 || isCameraOpen}
                                        size="lg"
                                        className="whitespace-nowrap touch-manipulation h-12 px-6 shadow-md hover:shadow-lg active:scale-95 transition-all duration-200"
                                    >
                                        {isDecodingVin ? (
                                            <>
                                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                                Decoding...
                                            </>
                                        ) : (
                                            <>
                                                <Scan className="mr-2 h-5 w-5" />
                                                Decode VIN
                                            </>
                                        )}
                                    </Button>
                                    <Button
                                        type="button"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handleOpenCamera();
                                        }}
                                        disabled={isDecodingVin || isCameraOpen}
                                        variant="outline"
                                        size="lg"
                                        className="whitespace-nowrap touch-manipulation h-12 px-6 shadow-md hover:shadow-lg hover:bg-primary/5 active:scale-95 transition-all duration-200"
                                        title="Scan VIN barcode with camera"
                                    >
                                        <Camera className="mr-2 h-5 w-5" />
                                        Scan
                                    </Button>
                                </div>
                            </div>
                            
                            {/* Tips */}
                            <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 border-2 border-blue-200/60 rounded-xl p-4 shadow-sm">
                                <p className="font-bold text-blue-900 mb-3 text-base flex items-center gap-2">
                                    <span className="text-xl">🎯</span> Quick Tips
                                </p>
                                <ul className="text-blue-800 space-y-2 ml-1">
                                    <li className="flex items-start gap-2">
                                        <span className="font-bold min-w-fit text-sm mt-0.5">📷 Barcode Scanner:</span>
                                        <span className="text-sm">Point camera at VIN barcode (door jamb sticker)</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="font-bold min-w-fit text-sm mt-0.5">⌨️ Manual Entry:</span>
                                        <span className="text-sm">Type or paste VIN for instant results (most reliable!)</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="font-bold min-w-fit text-sm mt-0.5">✅ After Decode:</span>
                                        <span className="text-sm">Add price, mileage, colors & photos</span>
                                    </li>
                                </ul>
                            </div>
                        </div>

                        {/* Camera View */}
                        {isCameraOpen && (
                            <div className="relative mb-4 bg-black rounded-xl overflow-hidden shadow-2xl">
                                <video
                                    ref={videoRef}
                                    className="w-full h-64 sm:h-96 object-cover"
                                    playsInline
                                    muted
                                />
                                
                                {/* Scanning Overlay */}
                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                    <div className="border-4 border-green-500/70 rounded-xl w-4/5 h-40 relative shadow-2xl shadow-green-500/30">
                                        <div className="absolute -top-2 -left-2 w-12 h-12 border-t-4 border-l-4 border-green-400 rounded-tl-lg"></div>
                                        <div className="absolute -top-2 -right-2 w-12 h-12 border-t-4 border-r-4 border-green-400 rounded-tr-lg"></div>
                                        <div className="absolute -bottom-2 -left-2 w-12 h-12 border-b-4 border-l-4 border-green-400 rounded-bl-lg"></div>
                                        <div className="absolute -bottom-2 -right-2 w-12 h-12 border-b-4 border-r-4 border-green-400 rounded-br-lg"></div>
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <div className="w-full h-1 bg-gradient-to-r from-transparent via-green-400 to-transparent animate-pulse shadow-lg shadow-green-400/50"></div>
                                        </div>
                                    </div>
                                    <div className="mt-6 bg-black/95 px-8 py-4 rounded-xl max-w-md mx-4 text-center backdrop-blur-md shadow-2xl border border-white/10">
                                        <p className="text-white text-lg font-bold mb-1">
                                            📸 {scanStatus}
                                        </p>
                                        <p className="text-green-300 text-base font-semibold">
                                            Position VIN barcode in frame
                                        </p>
                                        <p className="text-yellow-200 text-sm mt-2 font-medium">
                                            Location: Door jamb sticker (driver side)
                                        </p>
                                    </div>
                                </div>

                                {/* Close Button */}
                                <Button
                                    type="button"
                                    onClick={handleCloseCamera}
                                    variant="destructive"
                                    size="icon"
                                    className="absolute top-4 right-4 z-10 shadow-2xl hover:scale-110 active:scale-95 transition-all duration-200 h-12 w-12"
                                >
                                    <XCircle className="h-6 w-6" />
                                </Button>
                                
                                {/* Manual Entry Button */}
                                <Button
                                    type="button"
                                    onClick={() => {
                                        handleCloseCamera();
                                        toast({ 
                                            title: "Camera Closed", 
                                            description: "Enter VIN manually above.",
                                        });
                                    }}
                                    variant="secondary"
                                    size="lg"
                                    className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 shadow-2xl hover:scale-105 active:scale-95 transition-all duration-200 h-12"
                                >
                                    Enter VIN Manually
                                </Button>
                            </div>
                        )}

                        {/* Camera Error */}
                        {cameraError && (
                            <Alert variant="default" className="mb-4 bg-gradient-to-br from-amber-50 to-amber-100/50 border-2 border-amber-300/60 shadow-md">
                                <AlertCircle className="h-5 w-5 text-amber-600" />
                                <AlertDescription className="text-amber-900 font-medium">
                                    <strong className="font-bold">Camera unavailable:</strong> {cameraError}
                                    <br />
                                    <span className="text-sm mt-2 inline-block">Use manual entry above instead.</span>
                                </AlertDescription>
                            </Alert>
                        )}

                        {/* Success */}
                        {vinDecodeStatus === 'success' && (
                            <Alert className="bg-gradient-to-br from-green-50 to-green-100/50 border-2 border-green-300/60 shadow-md">
                                <CheckCircle2 className="h-5 w-5 text-green-600" />
                                <AlertDescription className="text-green-900 font-bold text-base">
                                    {vinDecodeMessage}
                                </AlertDescription>
                            </Alert>
                        )}

                        {/* Error */}
                        {vinDecodeStatus === 'error' && (
                            <Alert variant="destructive" className="shadow-md border-2">
                                <AlertCircle className="h-5 w-5" />
                                <AlertDescription className="font-semibold">{vinDecodeMessage}</AlertDescription>
                            </Alert>
                        )}
                    </div>
                </div>
            )}

            {/* BASIC INFORMATION */}
            <div className="md:col-span-3 bg-gradient-to-br from-gray-50/50 to-transparent p-6 rounded-xl border border-gray-200/60 shadow-sm mb-6">
                <h3 className="text-lg font-bold text-foreground mb-5 flex items-center gap-2 border-b pb-3">
                    <span className="text-primary">📋</span> Basic Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    <FormField control={formInstance.control} name="make" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="font-semibold text-sm">
                                Make <span className="text-red-500 text-base">*</span>
                            </FormLabel>
                            <FormControl>
                                <Input 
                                    placeholder="Toyota" 
                                    {...field} 
                                    className={`h-11 shadow-sm focus:shadow-md focus:ring-2 focus:ring-primary/20 transition-all duration-200 ${getFieldClassName(field.value)}`}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={formInstance.control} name="model" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="font-semibold text-sm">
                                Model <span className="text-red-500 text-base">*</span>
                            </FormLabel>
                            <FormControl>
                                <Input 
                                    placeholder="Camry" 
                                    {...field} 
                                    className={`h-11 shadow-sm focus:shadow-md focus:ring-2 focus:ring-primary/20 transition-all duration-200 ${getFieldClassName(field.value)}`}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={formInstance.control} name="year" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="font-semibold text-sm">
                                Year <span className="text-red-500 text-base">*</span>
                            </FormLabel>
                            <FormControl>
                                <Input 
                                    type="number" 
                                    placeholder="2024" 
                                    {...field} 
                                    className={`h-11 font-mono shadow-sm focus:shadow-md focus:ring-2 focus:ring-primary/20 transition-all duration-200 ${getFieldClassName(field.value)}`}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={formInstance.control} name="price" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="font-semibold text-sm">
                                Price ($) <span className="text-red-500 text-base">*</span>
                            </FormLabel>
                            <FormControl>
                                <Input 
                                    type="number" 
                                    placeholder="25000" 
                                    {...field} 
                                    className={`h-11 font-mono text-lg shadow-sm focus:shadow-md focus:ring-2 focus:ring-primary/20 transition-all duration-200 ${getFieldClassName(field.value)}`}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={formInstance.control} name="mileage" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="font-semibold text-sm">
                                Mileage <span className="text-red-500 text-base">*</span>
                            </FormLabel>
                            <FormControl>
                                <Input 
                                    type="number" 
                                    placeholder="10000" 
                                    {...field} 
                                    className={`h-11 font-mono shadow-sm focus:shadow-md focus:ring-2 focus:ring-primary/20 transition-all duration-200 ${getFieldClassName(field.value)}`}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={formInstance.control} name="vin" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="font-semibold text-sm">
                                VIN <span className="text-red-500 text-base">*</span>
                            </FormLabel>
                            <FormControl>
                                <Input 
                                    placeholder="1HGBH41JXMN109186" 
                                    maxLength={17} 
                                    className={`font-mono h-11 shadow-sm focus:shadow-md focus:ring-2 focus:ring-primary/20 transition-all duration-200 ${getFieldClassName(field.value)}`}
                                    {...field} 
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                </div>
            </div>

            {/* MECHANICAL SPECS */}
            <div className="md:col-span-3 bg-white p-6 rounded-xl border border-gray-200/60 shadow-sm mb-6">
                <h3 className="text-lg font-bold text-foreground mb-5 flex items-center gap-2 border-b pb-3">
                    <span className="text-primary">⚙️</span> Mechanical Specifications
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    <FormField control={formInstance.control} name="engine" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="font-semibold text-sm">
                                Engine <span className="text-red-500 text-base">*</span>
                            </FormLabel>
                            <FormControl>
                                <Input 
                                    placeholder="2.5L 4-Cylinder" 
                                    {...field} 
                                    className={`h-11 shadow-sm focus:shadow-md focus:ring-2 focus:ring-primary/20 transition-all duration-200 ${getFieldClassName(field.value)}`}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={formInstance.control} name="fuelType" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="font-semibold text-sm">
                                Fuel Type <span className="text-red-500 text-base">*</span>
                            </FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                    <SelectTrigger className={`h-11 shadow-sm focus:shadow-md focus:ring-2 focus:ring-primary/20 transition-all duration-200 ${getFieldClassName(field.value)}`}>
                                        <SelectValue placeholder="Select fuel type" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    <SelectItem value="Gas">Gas</SelectItem>
                                    <SelectItem value="Diesel">Diesel</SelectItem>
                                    <SelectItem value="Electric">Electric</SelectItem>
                                    <SelectItem value="Hybrid">Hybrid</SelectItem>
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={formInstance.control} name="transmission" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="font-semibold text-sm">
                                Transmission <span className="text-red-500 text-base">*</span>
                            </FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                    <SelectTrigger className={`h-11 shadow-sm focus:shadow-md focus:ring-2 focus:ring-primary/20 transition-all duration-200 ${getFieldClassName(field.value)}`}>
                                        <SelectValue placeholder="Select transmission" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    <SelectItem value="Automatic">Automatic</SelectItem>
                                    <SelectItem value="Manual">Manual</SelectItem>
                                    <SelectItem value="FWD">FWD</SelectItem>
                                    <SelectItem value="RWD">RWD</SelectItem>
                                    <SelectItem value="AWD">AWD</SelectItem>
                                    <SelectItem value="4WD">4WD</SelectItem>
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )} />
                </div>
            </div>

            {/* BODY STYLE & COLORS */}
            <div className="md:col-span-3 bg-gradient-to-br from-gray-50/50 to-transparent p-6 rounded-xl border border-gray-200/60 shadow-sm mb-6">
                <h3 className="text-lg font-bold text-foreground mb-5 flex items-center gap-2 border-b pb-3">
                    <span className="text-primary">🎨</span> Appearance
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <FormField control={formInstance.control} name="bodyStyle" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="font-semibold text-sm">
                                Body Style <span className="text-red-500 text-base">*</span>
                            </FormLabel>
                            <FormControl>
                                <Input 
                                    placeholder="Sedan" 
                                    {...field} 
                                    className={`h-11 shadow-sm focus:shadow-md focus:ring-2 focus:ring-primary/20 transition-all duration-200 ${getFieldClassName(field.value)}`}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={formInstance.control} name="exteriorColor" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="font-semibold text-sm">
                                Exterior Color <span className="text-red-500 text-base">*</span>
                            </FormLabel>
                            <FormControl>
                                <Input 
                                    placeholder="Black" 
                                    {...field} 
                                    className={`h-11 shadow-sm focus:shadow-md focus:ring-2 focus:ring-primary/20 transition-all duration-200 ${getFieldClassName(field.value)}`}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={formInstance.control} name="interiorColor" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="font-semibold text-sm">
                                Interior Color <span className="text-red-500 text-base">*</span>
                            </FormLabel>
                            <FormControl>
                                <Input 
                                    placeholder="Beige" 
                                    {...field} 
                                    className={`h-11 shadow-sm focus:shadow-md focus:ring-2 focus:ring-primary/20 transition-all duration-200 ${getFieldClassName(field.value)}`}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                </div>
            </div>

            {/* STATUS & BADGES */}
            <div className="md:col-span-3 bg-white p-6 rounded-xl border border-gray-200/60 shadow-sm mb-6">
                <h3 className="text-lg font-bold text-foreground mb-5 flex items-center gap-2 border-b pb-3">
                    <span className="text-primary">🏷️</span> Status & Badges
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <FormField control={formInstance.control} name="condition" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="font-semibold text-sm">Condition</FormLabel>
                            <FormControl>
                                <Input 
                                    placeholder="Excellent" 
                                    {...field} 
                                    className="h-11 shadow-sm focus:shadow-md focus:ring-2 focus:ring-primary/20 transition-all duration-200"
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <div className="flex flex-col gap-4 justify-center">
                        <p className="text-sm font-semibold text-foreground">Display Badges</p>
                        <div className="flex items-center gap-8">
                            <FormField control={formInstance.control} name="isNew" render={({ field }) => (
                                <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                                    <FormControl>
                                        <Checkbox 
                                            checked={field.value} 
                                            onCheckedChange={field.onChange}
                                            className="h-5 w-5 transition-all duration-200 hover:scale-110"
                                        />
                                    </FormControl>
                                    <FormLabel className="font-semibold cursor-pointer hover:text-primary transition-colors duration-200">
                                        New Arrival
                                    </FormLabel>
                                </FormItem>
                            )} />
                            <FormField control={formInstance.control} name="isFeatured" render={({ field }) => (
                                <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                                    <FormControl>
                                        <Checkbox 
                                            checked={field.value} 
                                            onCheckedChange={field.onChange}
                                            className="h-5 w-5 transition-all duration-200 hover:scale-110"
                                        />
                                    </FormControl>
                                    <FormLabel className="font-semibold cursor-pointer hover:text-primary transition-colors duration-200">
                                        Featured
                                    </FormLabel>
                                </FormItem>
                            )} />
                        </div>
                    </div>
                </div>
            </div>

            {/* DESCRIPTION & FEATURES */}
            <div className="md:col-span-3 bg-gradient-to-br from-gray-50/50 to-transparent p-6 rounded-xl border border-gray-200/60 shadow-sm mb-6">
                <h3 className="text-lg font-bold text-foreground mb-5 flex items-center gap-2 border-b pb-3">
                    <span className="text-primary">📝</span> Details & Features
                </h3>
                <div className="space-y-5">
                    <FormField control={formInstance.control} name="description" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="font-semibold text-sm">
                                Description <span className="text-red-500 text-base">*</span>
                            </FormLabel>
                            <FormControl>
                                <Textarea 
                                    placeholder="Detailed vehicle description..." 
                                    {...field} 
                                    rows={4} 
                                    className={`shadow-sm focus:shadow-md focus:ring-2 focus:ring-primary/20 transition-all duration-200 resize-none ${getFieldClassName(field.value)}`}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />

                    <FormField control={formInstance.control} name="featuresInput" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="font-semibold text-sm">Features (comma-separated)</FormLabel>
                            <FormControl>
                                <Input 
                                    placeholder="Leather Seats, Sunroof, Backup Camera, Navigation" 
                                    {...field} 
                                    className="h-11 shadow-sm focus:shadow-md focus:ring-2 focus:ring-primary/20 transition-all duration-200"
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />

                    <FormField control={formInstance.control} name="optionsInput" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="font-semibold text-sm">Options (comma-separated)</FormLabel>
                            <FormControl>
                                <Input 
                                    placeholder="Navigation, Heated Seats, Premium Sound System" 
                                    {...field} 
                                    className="h-11 shadow-sm focus:shadow-md focus:ring-2 focus:ring-primary/20 transition-all duration-200"
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                </div>
            </div>

            {/* IMAGE UPLOAD */}
            <div className="md:col-span-3 bg-white p-6 rounded-xl border-2 border-dashed border-gray-300/60 shadow-sm hover:border-primary/40 hover:bg-primary/5 transition-all duration-300">
                <div className="flex items-center gap-2 mb-2">
                    <Upload className="w-5 h-5 text-primary" />
                    <FormLabel className="text-lg font-bold text-foreground">
                        Vehicle Images
                    </FormLabel>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                    <span className="font-semibold text-foreground">{totalImages} / {MAX_IMAGES}</span> images uploaded
                    {uploadDisabled && <span className="text-amber-600 font-semibold ml-2">(Maximum reached)</span>}
                </p>
                
                <div className="relative mb-6">
                    <input
                       type="file"
                       accept="image/*"
                       multiple
                       onChange={handleFileChange}
                       disabled={uploadDisabled}
                       className="block w-full text-sm text-gray-600 file:mr-4 file:py-3 file:px-6 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 file:cursor-pointer file:shadow-md hover:file:shadow-lg file:transition-all file:duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    />
                </div>

                {(currentImages.length > 0 || filesToUpload.length > 0) && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {currentImages.map((url, index) => (
                            <div key={`existing-${index}`} className="relative group">
                                <div className="aspect-square overflow-hidden rounded-lg border-2 border-gray-300 shadow-md hover:shadow-xl transition-all duration-300 hover:scale-105">
                                    <img 
                                        src={url} 
                                        alt={`Image ${index + 1}`} 
                                        className="w-full h-full object-cover" 
                                    />
                                </div>
                                <Button 
                                    type="button"
                                    variant="destructive" 
                                    size="icon" 
                                    className="absolute -top-2 -right-2 h-8 w-8 rounded-full p-0 opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-lg hover:scale-110 active:scale-95"
                                    onClick={() => handleRemoveExistingImage(url)}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                                <span className="absolute bottom-2 left-2 bg-black/80 text-white text-xs px-2 py-1 rounded-md font-semibold shadow-lg">
                                    #{index + 1}
                                </span>
                            </div>
                        ))}
                        {filesToUpload.map((file, index) => (
                            <div key={`new-${index}`} className="relative group">
                                <div className="aspect-square overflow-hidden rounded-lg border-2 border-primary border-dashed shadow-md hover:shadow-xl transition-all duration-300 hover:scale-105 bg-primary/5">
                                    <img 
                                        src={URL.createObjectURL(file)} 
                                        alt={`New ${index + 1}`} 
                                        className="w-full h-full object-cover" 
                                    />
                                </div>
                                <Button 
                                    type="button"
                                    variant="destructive" 
                                    size="icon" 
                                    className="absolute -top-2 -right-2 h-8 w-8 rounded-full p-0 opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-lg hover:scale-110 active:scale-95"
                                    onClick={() => handleRemoveFileToUpload(index)}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                                <span className="absolute bottom-2 left-2 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground text-xs px-2 py-1 rounded-md font-bold shadow-lg animate-pulse">
                                    NEW
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </>
    );
};
    // ====================================================================
    // RENDER
    // ====================================================================

    return (
        <div className="container mx-auto p-4 md:p-8 space-y-8">
            <Tabs defaultValue="inventory" className="w-full">
                <TabsList className="grid w-full max-w-md grid-cols-2 mb-8">
                    <TabsTrigger value="inventory" className="flex items-center gap-2">
                        <Car className="w-4 h-4" /> Inventory
                    </TabsTrigger>
                    <TabsTrigger value="interactions" className="flex items-center gap-2">
                        <Users className="w-4 h-4" /> Customer Interactions
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="inventory">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-4xl font-bold tracking-tight flex items-center gap-3">
                        <Car className="w-8 h-8" /> Inventory Management
                    </h1>
                    <p className="text-muted-foreground mt-2">
                        Scan VIN barcode or enter manually. Each vehicle gets a unique stock number.
                    </p>
                </div>
            </div>

            {/* ADD NEW VEHICLE */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><PlusCircle className="w-5 h-5" /> Add New Vehicle</CardTitle>
                    <CardDescription>Scan VIN barcode or enter details manually.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...addForm}>
                        <form onSubmit={addForm.handleSubmit(onAddSubmit)} className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {renderVehicleFormFields(addForm, false)}
                            <div className="md:col-span-3 flex justify-end pt-4">
                                <Button type="submit" disabled={isSubmitting} size="lg">
                                    {isSubmitting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Adding...</>) : "Add Vehicle to Inventory"}
                                </Button>
                            </div>
                        </form>
                    </Form>
                </CardContent>
            </Card>

            {/* INVENTORY TABLE */}
            <Card>
                <CardHeader>
                    <CardTitle>Current Inventory ({inventory.length})</CardTitle>
                    <CardDescription>All vehicles in database</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                            <span>Loading...</span>
                        </div>
                    ) : inventory.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <Car className="w-12 h-12 mx-auto mb-2 opacity-50" />
                            <p>No vehicles. Add your first vehicle above!</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Vehicle</TableHead>
                                        <TableHead>Year</TableHead>
                                        <TableHead>Mileage</TableHead>
                                        <TableHead>Price</TableHead>
                                        <TableHead>VIN</TableHead>
                                        <TableHead>Stock #</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {inventory.map((vehicle) => (
                                        <TableRow key={vehicle.id}>
                                            <TableCell className="font-medium">{vehicle.make} {vehicle.model}</TableCell>
                                            <TableCell>{vehicle.year}</TableCell>
                                            <TableCell>{vehicle.mileage.toLocaleString()} mi</TableCell>
                                            <TableCell>${vehicle.price.toLocaleString()}</TableCell>
                                            <TableCell className="font-mono text-xs">{vehicle.vin}</TableCell>
                                            <TableCell className="font-mono text-sm font-semibold text-primary">
                                                {vehicle.stockNumber || '—'}
                                            </TableCell>
                                                <div className="flex gap-1 flex-wrap">
                                                    {vehicle.isNew && <span className="text-xs font-semibold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">New</span>}
                                                    {vehicle.isFeatured && <span className="text-xs font-semibold bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">Featured</span>}
                                                    {vehicle.images.length > 0 && <span className="text-xs font-semibold bg-gray-100 text-gray-800 px-2 py-0.5 rounded-full">{vehicle.images.length} Photos</span>}
                                                </div>
                                            <TableCell className="text-right">
                                                <div className="flex gap-2 justify-end">
                                                    <Button variant="outline" size="icon" onClick={() => handleEditClick(vehicle)}>
                                                        <Pencil className="w-4 h-4" />
                                                    </Button>
                                                    <Button variant="default" size="icon" onClick={() => handleOpenSoldModal(vehicle)} className="bg-green-600 hover:bg-green-700">
                                                        <DollarSign className="w-4 h-4" />
                                                    </Button>
                                                    <Button variant="destructive" size="icon" onClick={() => handleDelete(vehicle)}>
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* EDIT DIALOG */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Edit Vehicle</DialogTitle>
                        <DialogDescription>
                            {currentEditingVehicle?.make} {currentEditingVehicle?.model}
                            {currentEditingVehicle?.stockNumber && (
                                <span className="ml-2 font-mono text-primary font-semibold">
                                    (Stock #{currentEditingVehicle.stockNumber})
                                </span>
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    <Form {...editForm}>
                        <form onSubmit={editForm.handleSubmit(onUpdateSubmit)} className="grid grid-cols-1 gap-4 py-4">
                            {renderVehicleFormFields(editForm, true)}
                            <DialogFooter className="mt-4">
                                <Button type="submit" disabled={isSubmitting}>
                                    {isSubmitting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>) : "Save Changes"}
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            {/* MARK AS SOLD DIALOG */}
{showSoldModal && selectedVehicle && (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg shadow-xl w-96 max-w-[90vw]">
            <h2 className="text-xl mb-3 font-bold">Mark Vehicle As Sold</h2>
            
            <div className="mb-4 p-3 bg-gray-50 rounded border">
                <p className="text-sm"><strong>Vehicle:</strong> {selectedVehicle.year} {selectedVehicle.make} {selectedVehicle.model}</p>
                <p className="text-sm"><strong>VIN:</strong> {selectedVehicle.vin}</p>
                <p className="text-sm"><strong>Stock #:</strong> {selectedVehicle.stockNumber || 'N/A'}</p>
                <p className="text-sm"><strong>Price:</strong> ${selectedVehicle.price.toLocaleString()}</p>
            </div>

            <Input
                type="text"
                placeholder="Customer Name"
                className="w-full border p-2 mt-3"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
            />

            <Input
                type="text"
                placeholder="Customer Phone"
                className="w-full border p-2 mt-3"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
            />

            {/* SAVVY FEEDBACK CHECKBOX - ADDED */}
            <div className="flex items-center space-x-2 mt-4 p-3 bg-blue-50 rounded border border-blue-200">
                <input
                    type="checkbox"
                    id="requestFeedback"
                    checked={requestFeedback}
                    onChange={(e) => setRequestFeedback(e.target.checked)}
                    className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <label htmlFor="requestFeedback" className="text-sm cursor-pointer">
                    <span className="font-semibold">✓ Request feedback from buyer</span>
                    <span className="text-gray-600 ml-1">(Sends automated review request)</span>
                </label>
            </div>

            <Button
                onClick={handleMarkSold}
                className="w-full bg-green-600 hover:bg-green-700 text-white p-2 mt-4 rounded"
                disabled={isSubmitting}
            >
                {isSubmitting ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin inline" />
                        Processing...
                    </>
                ) : (
                    "Save & Mark Sold"
                )}
            </Button>

            <Button
                onClick={() => {
                    setShowSoldModal(false);
                    setCustomerName('');
                    setCustomerPhone('');
                    setRequestFeedback(true);
                    setSelectedVehicle(null);
                }}
                variant="outline"
                className="w-full p-2 mt-2 rounded"
                disabled={isSubmitting}
            >
                Cancel
            </Button>
        </div>
    </div>
)}

            </TabsContent>

                <TabsContent value="interactions">
                    <CustomerInteractionDashboard />
                </TabsContent>
            </Tabs>

            <Toaster />
        </div>
    );
};
