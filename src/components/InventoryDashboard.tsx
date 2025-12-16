// src/pages/admin/InventoryDashboard.tsx
// CLEAN IMPLEMENTATION - Native BarcodeDetector with ZXing fallback

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { v4 as uuidv4 } from 'uuid';


// FIREBASE IMPORTS
import { db, storage } from '@/firebaseConfig';
import { collection, doc, getDocs, deleteDoc, updateDoc, setDoc, query, where, orderBy, limit } from 'firebase/firestore';
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
        if (!selectedVehicle) return;

        const soldData: any = {
            vehicleId: selectedVehicle.id,
            vin: selectedVehicle.vin,
            year: selectedVehicle.year,
            make: selectedVehicle.make,
            model: selectedVehicle.model,
            price: selectedVehicle.price,
            mileage: selectedVehicle.mileage,
            dateSold: new Date().toISOString(),
            customerName,
            customerPhone,
        };

        if (selectedVehicle.stockNumber) {
            soldData.stockNumber = selectedVehicle.stockNumber;
        }

        try {
            await setDoc(doc(db, SOLD_VEHICLES_COLLECTION, selectedVehicle.id), soldData);
            await deleteDoc(doc(db, VEHICLES_COLLECTION, selectedVehicle.id));
            
            fetchInventory();
            handleCloseSoldModal();
            
            toast({
                title: "Vehicle Marked as Sold ✓",
                description: `${selectedVehicle.make} ${selectedVehicle.model} moved to sold inventory.`,
            });
        } catch (error) {
            console.error("Error marking vehicle as sold:", error);
            toast({
                title: "Error",
                description: "Failed to mark vehicle as sold. Please try again.",
                variant: "destructive",
            });
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

    // Replace the renderVehicleFormFields function with this improved version:
const renderVehicleFormFields = (formInstance: ReturnType<typeof useForm<InventoryFormValues>>, isEdit: boolean = false) => {
    const currentImages = isEdit ? existingImageUrls : [];
    const totalImages = currentImages.length + filesToUpload.length;
    const uploadDisabled = totalImages >= MAX_IMAGES;

    return (
        <>
            {/* VIN SCANNER - Only for Add form (UNCHANGED) */}
            {!isEdit && (
                <div className="md:col-span-3 mb-8 p-6 border-2 border-primary/20 rounded-2xl bg-gradient-to-br from-primary/5 via-white to-white shadow-lg">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-primary/10 rounded-lg">
                            <Scan className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-gray-900">VIN Scanner & Decoder</h3>
                            <p className="text-sm text-gray-600">Scan barcode or enter 17-character VIN for instant auto-fill</p>
                        </div>
                    </div>
                    
                    {/* Existing VIN scanner code remains exactly the same */}
                    <div className="flex flex-col gap-3 mb-3">
                        <div className="flex flex-col sm:flex-row gap-3">
                            <Input
                                placeholder="Enter 17-character VIN (e.g., 1HGBH41JXMN109186)"
                                value={vinInput}
                                onChange={(e) => setVinInput(e.target.value.toUpperCase())}
                                maxLength={17}
                                className="font-mono flex-1 text-lg bg-white border-2 border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 h-12 rounded-xl"
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
                                    className="whitespace-nowrap touch-manipulation bg-primary hover:bg-primary/90 h-12 px-6 rounded-xl font-semibold"
                                >
                                    {isDecodingVin ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Decoding...
                                        </>
                                    ) : (
                                        <>
                                            <Scan className="mr-2 h-4 w-4" />
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
                                    className="whitespace-nowrap touch-manipulation h-12 px-6 rounded-xl border-2 font-semibold"
                                    title="Scan VIN barcode with camera"
                                >
                                    <Camera className="mr-2 h-4 w-4" />
                                    Scan Barcode
                                </Button>
                            </div>
                        </div>
                        
                        {/* Tips */}
                        <div className="bg-gradient-to-r from-blue-50 to-blue-100 border-l-4 border-blue-500 rounded-r-lg p-4 text-sm">
                            <div className="flex items-start gap-3">
                                <div className="mt-0.5">
                                    <AlertCircle className="w-5 h-5 text-blue-600" />
                                </div>
                                <div>
                                    <p className="font-semibold text-blue-900 mb-2">🎯 Pro Tips for Quick Entry:</p>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                            <span className="text-blue-800">Scan door jamb VIN barcode</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                            <span className="text-blue-800">Manual entry works instantly</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                            <span className="text-blue-800">NHTSA auto-fills 80% of fields</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Rest of existing VIN scanner code remains exactly the same */}
                    {/* ... existing camera and status code ... */}
                </div>
            )}

            {/* PREMIUM DATA ENTRY SECTIONS */}
            <div className="space-y-8 md:col-span-3">
                
                {/* SECTION 1: CORE VEHICLE INFO */}
                <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                    <div className="border-b border-gray-100 bg-gradient-to-r from-gray-900 to-gray-800 p-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-white/10 rounded-lg">
                                <Car className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white">Vehicle Information</h3>
                                <p className="text-sm text-gray-300">Basic vehicle identification details</p>
                            </div>
                        </div>
                    </div>
                    
                    <div className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {[
                                { name: 'make', label: 'Make *', placeholder: 'Toyota', icon: null },
                                { name: 'model', label: 'Model *', placeholder: 'Camry', icon: null },
                                { name: 'year', label: 'Year *', placeholder: '2024', icon: null, type: 'number' },
                                { name: 'price', label: 'Price *', placeholder: '25000', icon: <DollarSign className="w-4 h-4" />, type: 'number' },
                                { name: 'mileage', label: 'Mileage *', placeholder: '10000', icon: null, type: 'number' },
                                isEdit ? { name: 'vin', label: 'VIN *', placeholder: '1HGBH41JXMN109186', icon: null } : null
                            ].filter(Boolean).map((field: any) => (
                                <FormField 
                                    key={field.name}
                                    control={formInstance.control} 
                                    name={field.name}
                                    render={({ field: formField }) => (
                                        <FormItem>
                                            <FormLabel className="font-semibold text-gray-700 flex items-center gap-2">
                                                {field.icon}
                                                {field.label}
                                            </FormLabel>
                                            <FormControl>
                                                <div className="relative">
                                                    {field.name === 'price' && (
                                                        <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 font-medium">$</span>
                                                    )}
                                                    <Input 
                                                        type={field.type || 'text'} 
                                                        placeholder={field.placeholder} 
                                                        {...formField}
                                                        className={`h-12 text-base bg-gray-50 border-2 border-gray-200 focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl transition-all ${
                                                            field.name === 'price' ? 'pl-10' : 'px-4'
                                                        } ${field.name === 'mileage' ? 'pr-12' : ''}`}
                                                        autoComplete="off"
                                                    />
                                                    {field.name === 'mileage' && (
                                                        <span className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-500 font-medium text-sm">
                                                            mi
                                                        </span>
                                                    )}
                                                </div>
                                            </FormControl>
                                            <FormMessage className="text-red-600 font-medium" />
                                        </FormItem>
                                    )} 
                                />
                            ))}
                        </div>
                    </div>
                </div>

                {/* SECTION 2: MECHANICAL SPECS */}
                <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                    <div className="border-b border-gray-100 bg-gradient-to-r from-blue-900 to-blue-800 p-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-white/10 rounded-lg">
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white">Mechanical Specifications</h3>
                                <p className="text-sm text-blue-300">Engine, transmission & fuel details</p>
                            </div>
                        </div>
                    </div>
                    
                    <div className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <FormField control={formInstance.control} name="engine" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="font-semibold text-gray-700">Engine *</FormLabel>
                                    <FormControl>
                                        <Input 
                                            placeholder="2.5L 4-Cylinder" 
                                            {...field} 
                                            className="h-12 text-base bg-gray-50 border-2 border-gray-200 focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl px-4"
                                            autoComplete="off"
                                        />
                                    </FormControl>
                                    <FormMessage className="text-red-600 font-medium" />
                                </FormItem>
                            )} />
                            
                            <FormField control={formInstance.control} name="fuelType" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="font-semibold text-gray-700">Fuel Type *</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger className="h-12 text-base bg-gray-50 border-2 border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl px-4">
                                                <SelectValue placeholder="Select fuel type" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent className="bg-white border-2 border-gray-200 rounded-xl shadow-lg">
                                            {['Gas', 'Diesel', 'Electric', 'Hybrid'].map((type) => (
                                                <SelectItem 
                                                    key={type} 
                                                    value={type} 
                                                    className="text-base py-3 hover:bg-gray-50 rounded-lg cursor-pointer"
                                                >
                                                    {type}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage className="text-red-600 font-medium" />
                                </FormItem>
                            )} />
                            
                            <FormField control={formInstance.control} name="transmission" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="font-semibold text-gray-700">Transmission *</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger className="h-12 text-base bg-gray-50 border-2 border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl px-4">
                                                <SelectValue placeholder="Select transmission" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent className="bg-white border-2 border-gray-200 rounded-xl shadow-lg">
                                            {['Automatic', 'Manual', 'FWD', 'RWD', 'AWD', '4WD'].map((type) => (
                                                <SelectItem 
                                                    key={type} 
                                                    value={type} 
                                                    className="text-base py-3 hover:bg-gray-50 rounded-lg cursor-pointer"
                                                >
                                                    {type}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage className="text-red-600 font-medium" />
                                </FormItem>
                            )} />
                        </div>
                    </div>
                </div>

                {/* SECTION 3: APPEARANCE & STYLE */}
                <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                    <div className="border-b border-gray-100 bg-gradient-to-r from-purple-900 to-purple-800 p-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-white/10 rounded-lg">
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white">Appearance & Style</h3>
                                <p className="text-sm text-purple-300">Visual characteristics & colors</p>
                            </div>
                        </div>
                    </div>
                    
                    <div className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <FormField control={formInstance.control} name="bodyStyle" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="font-semibold text-gray-700">Body Style *</FormLabel>
                                    <FormControl>
                                        <Input 
                                            placeholder="Sedan, SUV, Truck" 
                                            {...field} 
                                            className="h-12 text-base bg-gray-50 border-2 border-gray-200 focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl px-4"
                                            autoComplete="off"
                                        />
                                    </FormControl>
                                    <FormMessage className="text-red-600 font-medium" />
                                </FormItem>
                            )} />
                            
                            <FormField control={formInstance.control} name="exteriorColor" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="font-semibold text-gray-700">Exterior Color *</FormLabel>
                                    <FormControl>
                                        <Input 
                                            placeholder="Black, White, Red" 
                                            {...field} 
                                            className="h-12 text-base bg-gray-50 border-2 border-gray-200 focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl px-4"
                                            autoComplete="off"
                                        />
                                    </FormControl>
                                    <FormMessage className="text-red-600 font-medium" />
                                </FormItem>
                            )} />
                            
                            <FormField control={formInstance.control} name="interiorColor" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="font-semibold text-gray-700">Interior Color *</FormLabel>
                                    <FormControl>
                                        <Input 
                                            placeholder="Beige, Black, Gray" 
                                            {...field} 
                                            className="h-12 text-base bg-gray-50 border-2 border-gray-200 focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl px-4"
                                            autoComplete="off"
                                        />
                                    </FormControl>
                                    <FormMessage className="text-red-600 font-medium" />
                                </FormItem>
                            )} />
                        </div>
                    </div>
                </div>

                {/* SECTION 4: STATUS & MARKETING */}
                <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                    <div className="border-b border-gray-100 bg-gradient-to-r from-amber-900 to-amber-800 p-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-white/10 rounded-lg">
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white">Status & Marketing</h3>
                                <p className="text-sm text-amber-300">Vehicle condition & promotional badges</p>
                            </div>
                        </div>
                    </div>
                    
                    <div className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div>
                                <FormField control={formInstance.control} name="condition" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="font-semibold text-gray-700">Condition Rating</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger className="h-12 text-base bg-gray-50 border-2 border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl px-4">
                                                    <SelectValue placeholder="Select condition" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent className="bg-white border-2 border-gray-200 rounded-xl shadow-lg">
                                                {['Excellent', 'Good', 'Fair', 'Certified', 'Like New'].map((condition) => (
                                                    <SelectItem 
                                                        key={condition} 
                                                        value={condition} 
                                                        className="text-base py-3 hover:bg-gray-50 rounded-lg cursor-pointer"
                                                    >
                                                        {condition}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage className="text-red-600 font-medium" />
                                    </FormItem>
                                )} />
                            </div>
                            
                            <div>
                                <p className="font-semibold text-gray-700 mb-4">Promotional Badges</p>
                                <div className="space-y-4">
                                    <FormField control={formInstance.control} name="isNew" render={({ field }) => (
                                        <FormItem className="flex flex-row items-center space-x-4 space-y-0 p-4 bg-gray-50 rounded-xl border border-gray-200 hover:bg-gray-100 transition-colors">
                                            <FormControl>
                                                <Checkbox 
                                                    checked={field.value} 
                                                    onCheckedChange={field.onChange}
                                                    className="h-5 w-5 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                                />
                                            </FormControl>
                                            <div className="space-y-1 leading-none">
                                                <FormLabel className="font-semibold text-gray-700 text-base cursor-pointer">
                                                    New Arrival
                                                </FormLabel>
                                                <p className="text-sm text-gray-600">
                                                    Show "NEW" badge for 30 days
                                                </p>
                                            </div>
                                            <div className="ml-auto">
                                                <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full">
                                                    Marketing
                                                </span>
                                            </div>
                                        </FormItem>
                                    )} />
                                    
                                    <FormField control={formInstance.control} name="isFeatured" render={({ field }) => (
                                        <FormItem className="flex flex-row items-center space-x-4 space-y-0 p-4 bg-gray-50 rounded-xl border border-gray-200 hover:bg-gray-100 transition-colors">
                                            <FormControl>
                                                <Checkbox 
                                                    checked={field.value} 
                                                    onCheckedChange={field.onChange}
                                                    className="h-5 w-5 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                                />
                                            </FormControl>
                                            <div className="space-y-1 leading-none">
                                                <FormLabel className="font-semibold text-gray-700 text-base cursor-pointer">
                                                    Featured Vehicle
                                                </FormLabel>
                                                <p className="text-sm text-gray-600">
                                                    Prominently displayed on homepage
                                                </p>
                                            </div>
                                            <div className="ml-auto">
                                                <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded-full">
                                                    Premium
                                                </span>
                                            </div>
                                        </FormItem>
                                    )} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* SECTION 5: DESCRIPTION & FEATURES */}
                <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                    <div className="border-b border-gray-100 bg-gradient-to-r from-emerald-900 to-emerald-800 p-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-white/10 rounded-lg">
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white">Description & Features</h3>
                                <p className="text-sm text-emerald-300">Detailed information & selling points</p>
                            </div>
                        </div>
                    </div>
                    
                    <div className="p-6">
                        <FormField control={formInstance.control} name="description" render={({ field }) => (
                            <FormItem className="mb-8">
                                <FormLabel className="font-semibold text-gray-700">Vehicle Description *</FormLabel>
                                <FormControl>
                                    <div className="relative">
                                        <Textarea 
                                            placeholder="Describe the vehicle's condition, history, features, and unique selling points. Include maintenance records, upgrades, and anything special about this vehicle..."
                                            {...field} 
                                            rows={5}
                                            className="text-base min-h-[150px] resize-y bg-gray-50 border-2 border-gray-200 focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl p-4"
                                        />
                                        <div className="absolute bottom-3 right-3 bg-white px-2 py-1 rounded-lg border border-gray-200 shadow-sm">
                                            <span className="text-sm text-gray-500">{field.value?.length || 0}/2000</span>
                                        </div>
                                    </div>
                                </FormControl>
                                <FormMessage className="text-red-600 font-medium" />
                            </FormItem>
                        )} />
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <FormField control={formInstance.control} name="featuresInput" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="font-semibold text-gray-700 flex items-center gap-2">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        Key Features
                                    </FormLabel>
                                    <FormControl>
                                        <Textarea 
                                            placeholder="Leather Seats, Sunroof, Backup Camera, Apple CarPlay, Heated Seats, Navigation System, Blind Spot Monitoring"
                                            {...field} 
                                            rows={4}
                                            className="text-base resize-y bg-gray-50 border-2 border-gray-200 focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl p-4"
                                        />
                                    </FormControl>
                                    <p className="text-sm text-gray-500 mt-2">
                                        Separate features with commas. These appear as bullet points.
                                    </p>
                                </FormItem>
                            )} />
                            
                            <FormField control={formInstance.control} name="optionsInput" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="font-semibold text-gray-700 flex items-center gap-2">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                        </svg>
                                        Options & Packages
                                    </FormLabel>
                                    <FormControl>
                                        <Textarea 
                                            placeholder="Technology Package, Cold Weather Package, Premium Audio, Tow Package, Sport Package, Luxury Package"
                                            {...field} 
                                            rows={4}
                                            className="text-base resize-y bg-gray-50 border-2 border-gray-200 focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl p-4"
                                        />
                                    </FormControl>
                                    <p className="text-sm text-gray-500 mt-2">
                                        Factory-installed options and packages
                                    </p>
                                </FormItem>
                            )} />
                        </div>
                    </div>
                </div>

                {/* SECTION 6: PHOTO UPLOAD - PREMIUM */}
                <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                    <div className="border-b border-gray-100 bg-gradient-to-r from-rose-900 to-rose-800 p-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-white/10 rounded-lg">
                                <Upload className="w-6 h-6 text-white" />
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-xl font-bold text-white">Vehicle Photos</h3>
                                        <p className="text-sm text-rose-300">Upload high-quality images ({totalImages}/{MAX_IMAGES})</p>
                                    </div>
                                    <div className={`px-4 py-2 rounded-full text-sm font-semibold ${
                                        uploadDisabled ? 'bg-red-500 text-white' : 'bg-white/20 text-white'
                                    }`}>
                                        {totalImages}/{MAX_IMAGES}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div className="p-6">
                        <div className="mb-8">
                            <div className="relative group">
                                <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-primary/10 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                <label className="relative block cursor-pointer">
                                    <div className="border-3 border-dashed border-gray-300 hover:border-primary rounded-2xl p-8 text-center transition-all group-hover:border-primary/50 group-hover:bg-primary/5">
                                        <div className="flex flex-col items-center justify-center gap-4">
                                            <div className="p-4 bg-primary/10 rounded-full">
                                                <Upload className="w-8 h-8 text-primary" />
                                            </div>
                                            <div>
                                                <p className="text-lg font-semibold text-gray-800 mb-2">
                                                    Click to upload or drag & drop
                                                </p>
                                                <p className="text-sm text-gray-600 mb-4">
                                                    High-resolution JPG, PNG, or WebP (Max 10MB each)
                                                </p>
                                                <div className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white font-semibold rounded-lg hover:bg-primary/90 transition-colors">
                                                    Browse Files
                                                </div>
                                            </div>
                                            <p className="text-xs text-gray-500">
                                                Recommended: Exterior (front, back, sides), Interior (dashboard, seats, console), Engine, VIN sticker
                                            </p>
                                        </div>
                                    </div>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        onChange={handleFileChange}
                                        disabled={uploadDisabled}
                                        className="hidden"
                                    />
                                </label>
                            </div>
                        </div>

                        {(currentImages.length > 0 || filesToUpload.length > 0) && (
                            <div>
                                <div className="flex items-center justify-between mb-6">
                                    <h4 className="font-semibold text-gray-700 text-lg">Image Preview</h4>
                                    <div className="text-sm text-gray-600">
                                        {currentImages.length} existing, {filesToUpload.length} new
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                    {currentImages.map((url, index) => (
                                        <div key={`existing-${index}`} className="relative group">
                                            <div className="aspect-square overflow-hidden rounded-xl border-2 border-gray-200 bg-gray-50">
                                                <img 
                                                    src={url} 
                                                    alt={`Image ${index + 1}`} 
                                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                                                />
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                            </div>
                                            <Button 
                                                type="button"
                                                variant="destructive" 
                                                size="icon" 
                                                className="absolute -top-2 -right-2 h-8 w-8 rounded-full p-0 shadow-lg hover:scale-110 transition-transform"
                                                onClick={() => handleRemoveExistingImage(url)}
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                            <span className="absolute bottom-2 left-2 bg-black/80 text-white text-xs px-2 py-1 rounded-full font-semibold">
                                                #{index + 1}
                                            </span>
                                        </div>
                                    ))}
                                    
                                    {filesToUpload.map((file, index) => (
                                        <div key={`new-${index}`} className="relative group">
                                            <div className="aspect-square overflow-hidden rounded-xl border-2 border-dashed border-primary bg-primary/5">
                                                <img 
                                                    src={URL.createObjectURL(file)} 
                                                    alt={`New ${index + 1}`} 
                                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                                                />
                                            </div>
                                            <Button 
                                                type="button"
                                                variant="destructive" 
                                                size="icon" 
                                                className="absolute -top-2 -right-2 h-8 w-8 rounded-full p-0 shadow-lg hover:scale-110 transition-transform"
                                                onClick={() => handleRemoveFileToUpload(index)}
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                            <span className="absolute bottom-2 left-2 bg-primary text-white text-xs px-2 py-1 rounded-full font-semibold">
                                                NEW
                                            </span>
                                            <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full font-semibold">
                                                UPLOADING
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                
                                <div className="mt-8 p-4 bg-blue-50 border-l-4 border-blue-500 rounded-r-lg">
                                    <div className="flex items-start gap-3">
                                        <svg className="w-5 h-5 text-blue-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <div>
                                            <p className="font-semibold text-blue-900 mb-2">📸 Professional Photo Guidelines</p>
                                            <ul className="text-blue-800 space-y-1 text-sm">
                                                <li>• <strong>First image</strong> is the main thumbnail - use the best exterior shot</li>
                                                <li>• Include all angles: front, back, sides, wheels, interior, engine</li>
                                                <li>• Use natural lighting for true color representation</li>
                                                <li>• Remove personal items from interior shots</li>
                                                <li>• Capture the VIN sticker for documentation</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
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

                        <Button
                            onClick={handleMarkSold}
                            className="w-full bg-green-600 hover:bg-green-700 text-white p-2 mt-4 rounded"
                        >
                            Save & Mark Sold
                        </Button>

                        <Button
                            onClick={handleCloseSoldModal}
                            variant="outline"
                            className="w-full p-2 mt-2 rounded"
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
