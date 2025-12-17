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
// Add these Lucide React icon imports
import { 
  Scan, 
  Camera, 
  X, 
  Upload, 
  CheckCircle,
  AlertCircle,
  Car,
  Calendar,
  DollarSign,
  Gauge,
  Key,
  Zap,
  Database,
  Lightbulb,
  MapPin,
  Keyboard,
  Tag,
  Fingerprint,
  Cog,
  Fuel,
  Settings,
  Paintbrush,
  Droplets,
  Palette,
  BadgeCheck,
  Star,
  FileText,
  Sparkles,
  Package,
  ImageIcon,
  GalleryVertical,
  Info,
  Users,
  PlusCircle,
  Pencil,
  Trash2,
  Loader2,
} from "lucide-react";
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

   const renderVehicleFormFields = (formInstance: ReturnType<typeof useForm<InventoryFormValues>>, isEdit: boolean = false) => {
    const currentImages = isEdit ? existingImageUrls : [];
    const totalImages = currentImages.length + filesToUpload.length;
    const uploadDisabled = totalImages >= MAX_IMAGES;

    return (
        <>
            {/* VIN SCANNER - Only for Add form */}
            {!isEdit && (
                <div className="relative md:col-span-3 mb-8 p-6 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border-0 shadow-lg overflow-hidden">
                    {/* Animated background effect */}
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.1)_0%,rgba(99,102,241,0.05)_50%,transparent_100%)]"></div>
                    
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="relative">
                                <div className="absolute inset-0 bg-blue-500 blur-lg opacity-30 animate-pulse"></div>
                                <Scan className="relative w-7 h-7 text-blue-600" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold bg-gradient-to-r from-blue-700 to-indigo-700 bg-clip-text text-transparent">
                                    VIN DECODER
                                </h3>
                                <p className="text-sm text-blue-600/80 font-medium">
                                    Instant vehicle data extraction
                                </p>
                            </div>
                            <div className="ml-auto flex items-center gap-2">
                                <div className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold">
                                    ⚡ Auto-fill
                                </div>
                                <div className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-semibold">
                                    📱 Mobile Scan
                                </div>
                            </div>
                        </div>
                        
                        <div className="mb-8">
                            <div className="flex flex-col lg:flex-row gap-4 items-stretch">
                                <div className="flex-1 relative">
                                    <div className="absolute -inset-1 bg-gradient-to-r from-blue-400 to-indigo-400 rounded-xl blur opacity-20 group-hover:opacity-30 transition-all duration-300"></div>
                                    <Input
                                        placeholder="ENTER 17-CHARACTER VIN (e.g., 1HGBH41JXMN109186)"
                                        value={vinInput}
                                        onChange={(e) => setVinInput(e.target.value.toUpperCase())}
                                        maxLength={17}
                                        className="relative font-mono flex-1 text-lg h-14 pl-12 bg-white/90 backdrop-blur-sm border-2 border-blue-200 rounded-xl shadow-lg hover:border-blue-300 transition-all"
                                        disabled={isDecodingVin || isCameraOpen}
                                        autoComplete="off"
                                    />
                                    <Key className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-blue-500" />
                                    <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                                        <div className="flex items-center gap-1">
                                            {Array.from({ length: 17 }).map((_, i) => (
                                                <div 
                                                    key={i}
                                                    className={`w-1 h-3 rounded-full ${i < vinInput.length ? 'bg-green-500' : 'bg-gray-300'}`}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="flex gap-3">
                                    <Button
                                        type="button"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handleVinScan();
                                        }}
                                        disabled={isDecodingVin || vinInput.length !== 17 || isCameraOpen}
                                        size="lg"
                                        className="relative h-14 px-8 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-200 overflow-hidden group"
                                    >
                                        <div className="absolute inset-0 bg-white/20 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                                        {isDecodingVin ? (
                                            <>
                                                <Loader2 className="relative mr-3 h-5 w-5 animate-spin" />
                                                <span className="relative">DECODING VIN...</span>
                                            </>
                                        ) : (
                                            <>
                                                <div className="relative flex items-center gap-3">
                                                    <div className="p-1.5 bg-white/20 rounded-lg">
                                                        <Scan className="h-5 w-5" />
                                                    </div>
                                                    <span>DECODE NOW</span>
                                                </div>
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
                                        className="h-14 px-6 border-2 border-blue-300 text-blue-700 hover:bg-blue-50 font-semibold rounded-xl hover:border-blue-400 hover:shadow-md transition-all group"
                                        title="Scan VIN barcode with camera"
                                    >
                                        <div className="relative flex items-center gap-3">
                                            <div className="p-1.5 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                                                <Camera className="h-5 w-5" />
                                            </div>
                                            <span>SCAN BARCODE</span>
                                        </div>
                                    </Button>
                                </div>
                            </div>
                            
                            {/* Stats Bar */}
                            <div className="mt-4 flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2 text-blue-600">
                                    <CheckCircle className="w-4 h-4" />
                                    <span>17-character validation</span>
                                </div>
                                <div className="flex items-center gap-2 text-green-600">
                                    <Zap className="w-4 h-4" />
                                    <span>Instant results</span>
                                </div>
                                <div className="flex items-center gap-2 text-purple-600">
                                    <Database className="w-4 h-4" />
                                    <span>40+ data points</span>
                                </div>
                            </div>
                        </div>

                        {/* Tips Panel - Premium Style */}
                        <div className="bg-gradient-to-r from-blue-900/5 to-indigo-900/5 border border-blue-200/50 rounded-xl p-5 mb-6 backdrop-blur-sm">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg">
                                    <Lightbulb className="w-5 h-5 text-white" />
                                </div>
                                <h4 className="text-lg font-bold text-blue-900">PRO TIPS FOR DEALERS</h4>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-white p-4 rounded-lg shadow-sm border border-blue-100 hover:shadow-md transition-shadow">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                        <span className="font-bold text-blue-800">📸 BARCODE SCANNER</span>
                                    </div>
                                    <p className="text-sm text-blue-700">Point camera at VIN barcode (door jamb sticker) for instant capture</p>
                                </div>
                                <div className="bg-white p-4 rounded-lg shadow-sm border border-blue-100 hover:shadow-md transition-shadow">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                        <span className="font-bold text-green-800">⌨️ MANUAL ENTRY</span>
                                    </div>
                                    <p className="text-sm text-green-700">Type or paste VIN - fastest method with 99% accuracy rate</p>
                                </div>
                                <div className="bg-white p-4 rounded-lg shadow-sm border border-blue-100 hover:shadow-md transition-shadow">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                                        <span className="font-bold text-purple-800">🚀 AFTER DECODE</span>
                                    </div>
                                    <p className="text-sm text-purple-700">Add pricing, photos & features - 80% faster than manual entry</p>
                                </div>
                            </div>
                        </div>

                        {/* Camera View - Premium */}
                        {isCameraOpen && (
                            <div className="relative mb-6 bg-gradient-to-br from-gray-900 to-black rounded-2xl overflow-hidden shadow-2xl border border-gray-700">
                                <video
                                    ref={videoRef}
                                    className="w-full h-64 sm:h-96 object-cover"
                                    playsInline
                                    muted
                                />
                                
                                {/* Premium Scanning Overlay */}
                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                    <div className="relative">
                                        {/* Scanning frame */}
                                        <div className="relative border-4 border-white/20 rounded-xl w-80 h-48 backdrop-blur-sm bg-black/40">
                                            {/* Corner animations */}
                                            <div className="absolute -top-3 -left-3 w-12 h-12">
                                                <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-green-400 rounded-tl-lg animate-pulse"></div>
                                            </div>
                                            <div className="absolute -top-3 -right-3 w-12 h-12">
                                                <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-green-400 rounded-tr-lg animate-pulse delay-150"></div>
                                            </div>
                                            <div className="absolute -bottom-3 -left-3 w-12 h-12">
                                                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-green-400 rounded-bl-lg animate-pulse delay-300"></div>
                                            </div>
                                            <div className="absolute -bottom-3 -right-3 w-12 h-12">
                                                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-green-400 rounded-br-lg animate-pulse delay-500"></div>
                                            </div>
                                            
                                            {/* Scanning line */}
                                            <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
                                                <div className="w-full h-1 bg-gradient-to-r from-transparent via-green-400 to-transparent animate-[scanning_2s_ease-in-out_infinite]"></div>
                                            </div>
                                        </div>
                                        
                                        {/* Status card */}
                                        <div className="mt-6 bg-gradient-to-r from-black/90 to-gray-900/90 backdrop-blur-md px-6 py-4 rounded-xl border border-gray-700 shadow-2xl max-w-md mx-4 text-center">
                                            <div className="flex items-center justify-center gap-3 mb-2">
                                                <div className="relative">
                                                    <div className="absolute inset-0 bg-green-500 rounded-full blur animate-ping"></div>
                                                    <Camera className="relative w-6 h-6 text-green-300" />
                                                </div>
                                                <p className="text-white text-lg font-bold tracking-wide">
                                                    {scanStatus}
                                                </p>
                                            </div>
                                            <p className="text-green-300 text-sm font-medium mb-2">
                                                🎯 Position VIN barcode in frame
                                            </p>
                                            <div className="flex items-center justify-center gap-4 text-xs">
                                                <span className="flex items-center gap-1 text-yellow-200">
                                                    <MapPin className="w-3 h-3" />
                                                    Door jamb sticker
                                                </span>
                                                <span className="flex items-center gap-1 text-blue-200">
                                                    <Car className="w-3 h-3" />
                                                    Driver side
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Premium Control Buttons */}
                                <Button
                                    type="button"
                                    onClick={handleCloseCamera}
                                    variant="destructive"
                                    size="icon"
                                    className="absolute top-4 right-4 z-10 shadow-2xl h-12 w-12 rounded-full bg-gradient-to-br from-red-500 to-red-700 border-2 border-white/20 hover:scale-110 transition-transform"
                                >
                                    <X className="h-6 w-6" />
                                </Button>
                                
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
                                    className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 shadow-xl bg-gradient-to-r from-gray-800 to-gray-900 text-white border border-gray-600 hover:border-gray-500 hover:bg-gray-800"
                                >
                                    <Keyboard className="mr-2 h-4 w-4" />
                                    ENTER VIN MANUALLY
                                </Button>
                            </div>
                        )}

                        {/* Status Messages - Premium */}
                        {cameraError && (
                            <div className="mb-4 bg-gradient-to-r from-amber-50 to-orange-50 border-l-4 border-amber-500 rounded-r-xl p-4 shadow-lg">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-amber-100 rounded-lg">
                                        <AlertCircle className="h-5 w-5 text-amber-600" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-amber-900">Camera Unavailable</h4>
                                        <p className="text-amber-800">{cameraError}</p>
                                        <p className="text-sm text-amber-700 mt-1">
                                            Use manual VIN entry above for instant results
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {vinDecodeStatus === 'success' && (
                            <div className="mb-4 bg-gradient-to-r from-green-50 to-emerald-50 border-l-4 border-green-500 rounded-r-xl p-4 shadow-lg">
                                <div className="flex items-center gap-3">
                                    <div className="relative">
                                        <div className="absolute inset-0 bg-green-400 rounded-full blur animate-ping"></div>
                                        <div className="relative p-2 bg-green-100 rounded-lg">
                                            <CheckCircle className="h-6 w-6 text-green-600" />
                                        </div>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-green-900 text-lg">✓ VIN SUCCESSFULLY DECODED</h4>
                                        <p className="text-green-800 font-medium">{vinDecodeMessage}</p>
                                        <div className="flex items-center gap-2 mt-2">
                                            <div className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-bold">
                                                ✅ 40+ Data Points Extracted
                                            </div>
                                            <div className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-bold">
                                                ⚡ Ready for Pricing
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {vinDecodeStatus === 'error' && (
                            <div className="mb-4 bg-gradient-to-r from-red-50 to-rose-50 border-l-4 border-red-500 rounded-r-xl p-4 shadow-lg">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-red-100 rounded-lg">
                                        <AlertCircle className="h-6 w-6 text-red-600" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-red-900 text-lg">✗ DECODING ERROR</h4>
                                        <p className="text-red-800 font-medium">{vinDecodeMessage}</p>
                                        <p className="text-sm text-red-700 mt-1">
                                            Check VIN format and try again, or contact support
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* FORM SECTIONS - Premium Design */}
            <div className="space-y-8">
                {/* BASIC INFORMATION - Card Style */}
                <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl p-6 border border-gray-200 shadow-lg">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg">
                            <Car className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-gray-900">VEHICLE IDENTITY</h3>
                            <p className="text-sm text-gray-600">Core vehicle information</p>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <FormField 
                            control={formInstance.control} 
                            name="make" 
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="font-semibold text-gray-700 flex items-center gap-2">
                                        <Car className="w-4 h-4" />
                                        Make *
                                    </FormLabel>
                                    <FormControl>
                                        <div className="relative group">
                                            <div className="absolute inset-0 bg-gradient-to-r from-blue-400/0 to-indigo-400/0 rounded-lg blur transition-all duration-300 group-hover:from-blue-400/10 group-hover:to-indigo-400/10"></div>
                                            <Input 
                                                placeholder="Toyota"
                                                {...field}
                                                className="relative bg-white border-2 border-gray-200 rounded-xl h-11 hover:border-blue-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                                            />
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} 
                        />
                        
                        <FormField 
                            control={formInstance.control} 
                            name="model" 
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="font-semibold text-gray-700 flex items-center gap-2">
                                        <Tag className="w-4 h-4" />
                                        Model *
                                    </FormLabel>
                                    <FormControl>
                                        <div className="relative group">
                                            <div className="absolute inset-0 bg-gradient-to-r from-blue-400/0 to-indigo-400/0 rounded-lg blur transition-all duration-300 group-hover:from-blue-400/10 group-hover:to-indigo-400/10"></div>
                                            <Input 
                                                placeholder="Camry"
                                                {...field}
                                                className="relative bg-white border-2 border-gray-200 rounded-xl h-11 hover:border-blue-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                                            />
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} 
                        />
                        
                        <FormField 
                            control={formInstance.control} 
                            name="year" 
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="font-semibold text-gray-700 flex items-center gap-2">
                                        <Calendar className="w-4 h-4" />
                                        Year *
                                    </FormLabel>
                                    <FormControl>
                                        <div className="relative group">
                                            <div className="absolute inset-0 bg-gradient-to-r from-blue-400/0 to-indigo-400/0 rounded-lg blur transition-all duration-300 group-hover:from-blue-400/10 group-hover:to-indigo-400/10"></div>
                                            <Input 
                                                type="number"
                                                placeholder="2024"
                                                {...field}
                                                className="relative bg-white border-2 border-gray-200 rounded-xl h-11 hover:border-blue-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                                            />
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} 
                        />
                        
                        <FormField 
                            control={formInstance.control} 
                            name="price" 
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="font-semibold text-gray-700 flex items-center gap-2">
                                        <DollarSign className="w-4 h-4" />
                                        Price ($) *
                                    </FormLabel>
                                    <FormControl>
                                        <div className="relative group">
                                            <div className="absolute inset-0 bg-gradient-to-r from-blue-400/0 to-indigo-400/0 rounded-lg blur transition-all duration-300 group-hover:from-blue-400/10 group-hover:to-indigo-400/10"></div>
                                            <Input 
                                                type="number"
                                                placeholder="25000"
                                                {...field}
                                                className="relative bg-white border-2 border-gray-200 rounded-xl h-11 hover:border-blue-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                                            />
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} 
                        />
                        
                        <FormField 
                            control={formInstance.control} 
                            name="mileage" 
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="font-semibold text-gray-700 flex items-center gap-2">
                                        <Gauge className="w-4 h-4" />
                                        Mileage *
                                    </FormLabel>
                                    <FormControl>
                                        <div className="relative group">
                                            <div className="absolute inset-0 bg-gradient-to-r from-blue-400/0 to-indigo-400/0 rounded-lg blur transition-all duration-300 group-hover:from-blue-400/10 group-hover:to-indigo-400/10"></div>
                                            <Input 
                                                type="number"
                                                placeholder="10000"
                                                {...field}
                                                className="relative bg-white border-2 border-gray-200 rounded-xl h-11 hover:border-blue-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                                            />
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} 
                        />
                        
                        <FormField 
                            control={formInstance.control} 
                            name="vin" 
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="font-semibold text-gray-700 flex items-center gap-2">
                                        <Fingerprint className="w-4 h-4" />
                                        VIN *
                                    </FormLabel>
                                    <FormControl>
                                        <div className="relative group">
                                            <div className="absolute inset-0 bg-gradient-to-r from-blue-400/0 to-indigo-400/0 rounded-lg blur transition-all duration-300 group-hover:from-blue-400/10 group-hover:to-indigo-400/10"></div>
                                            <Input 
                                                placeholder="1HGBH41JXMN109186"
                                                {...field}
                                                maxLength={17}
                                                className="relative font-mono bg-white border-2 border-gray-200 rounded-xl h-11 hover:border-blue-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                                            />
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} 
                        />
                    </div>
                </div>

                {/* MECHANICAL SPECS - Card Style */}
                <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl p-6 border border-gray-200 shadow-lg">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg">
                            <Cog className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-gray-900">MECHANICAL SPECIFICATIONS</h3>
                            <p className="text-sm text-gray-600">Power & performance details</p>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <FormField control={formInstance.control} name="engine" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="font-semibold text-gray-700 flex items-center gap-2">
                                    <Cog className="w-4 h-4" />
                                    Engine *
                                </FormLabel>
                                <FormControl>
                                    <div className="relative group">
                                        <div className="absolute inset-0 bg-gradient-to-r from-orange-400/0 to-red-400/0 rounded-lg blur transition-all duration-300 group-hover:from-orange-400/10 group-hover:to-red-400/10"></div>
                                        <Input 
                                            placeholder="2.5L 4-Cylinder Turbo"
                                            {...field}
                                            className="relative bg-white border-2 border-gray-200 rounded-xl h-11 hover:border-orange-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition-all"
                                        />
                                    </div>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        
                        <FormField control={formInstance.control} name="fuelType" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="font-semibold text-gray-700 flex items-center gap-2">
                                    <Fuel className="w-4 h-4" />
                                    Fuel Type *
                                </FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                        <div className="relative group">
                                            <div className="absolute inset-0 bg-gradient-to-r from-orange-400/0 to-red-400/0 rounded-lg blur transition-all duration-300 group-hover:from-orange-400/10 group-hover:to-red-400/10"></div>
                                            <SelectTrigger className="relative bg-white border-2 border-gray-200 rounded-xl h-11 hover:border-orange-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition-all">
                                                <SelectValue placeholder="Select fuel type" />
                                            </SelectTrigger>
                                        </div>
                                    </FormControl>
                                    <SelectContent className="border-2 border-gray-200 rounded-xl shadow-lg">
                                        <SelectItem value="Gas" className="hover:bg-orange-50 cursor-pointer">⛽ Gas</SelectItem>
                                        <SelectItem value="Diesel" className="hover:bg-orange-50 cursor-pointer">🚛 Diesel</SelectItem>
                                        <SelectItem value="Electric" className="hover:bg-orange-50 cursor-pointer">🔋 Electric</SelectItem>
                                        <SelectItem value="Hybrid" className="hover:bg-orange-50 cursor-pointer">⚡ Hybrid</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )} />
                        
                        <FormField control={formInstance.control} name="transmission" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="font-semibold text-gray-700 flex items-center gap-2">
                                    <Settings className="w-4 h-4" />
                                    Transmission *
                                </FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                        <div className="relative group">
                                            <div className="absolute inset-0 bg-gradient-to-r from-orange-400/0 to-red-400/0 rounded-lg blur transition-all duration-300 group-hover:from-orange-400/10 group-hover:to-red-400/10"></div>
                                            <SelectTrigger className="relative bg-white border-2 border-gray-200 rounded-xl h-11 hover:border-orange-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition-all">
                                                <SelectValue placeholder="Select transmission" />
                                            </SelectTrigger>
                                        </div>
                                    </FormControl>
                                    <SelectContent className="border-2 border-gray-200 rounded-xl shadow-lg">
                                        <SelectItem value="Automatic" className="hover:bg-orange-50 cursor-pointer">🤖 Automatic</SelectItem>
                                        <SelectItem value="Manual" className="hover:bg-orange-50 cursor-pointer">👋 Manual</SelectItem>
                                        <SelectItem value="FWD" className="hover:bg-orange-50 cursor-pointer">⬆️ FWD</SelectItem>
                                        <SelectItem value="RWD" className="hover:bg-orange-50 cursor-pointer">⬇️ RWD</SelectItem>
                                        <SelectItem value="AWD" className="hover:bg-orange-50 cursor-pointer">🔀 AWD</SelectItem>
                                        <SelectItem value="4WD" className="hover:bg-orange-50 cursor-pointer">⛰️ 4WD</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )} />
                    </div>
                </div>

                {/* BODY STYLE & COLORS - Card Style */}
                <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl p-6 border border-gray-200 shadow-lg">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
                            <Paintbrush className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-gray-900">DESIGN & COLORS</h3>
                            <p className="text-sm text-gray-600">Vehicle aesthetics</p>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <FormField 
                            control={formInstance.control} 
                            name="bodyStyle" 
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="font-semibold text-gray-700 flex items-center gap-2">
                                        <Car className="w-4 h-4" />
                                        Body Style *
                                    </FormLabel>
                                    <FormControl>
                                        <div className="relative group">
                                            <div className="absolute inset-0 bg-gradient-to-r from-purple-400/0 to-pink-400/0 rounded-lg blur transition-all duration-300 group-hover:from-purple-400/10 group-hover:to-pink-400/10"></div>
                                            <Input 
                                                placeholder="SUV"
                                                {...field}
                                                className="relative bg-white border-2 border-gray-200 rounded-xl h-11 hover:border-purple-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all"
                                            />
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} 
                        />
                        
                        <FormField 
                            control={formInstance.control} 
                            name="exteriorColor" 
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="font-semibold text-gray-700 flex items-center gap-2">
                                        <Droplets className="w-4 h-4" />
                                        Exterior Color *
                                    </FormLabel>
                                    <FormControl>
                                        <div className="relative group">
                                            <div className="absolute inset-0 bg-gradient-to-r from-purple-400/0 to-pink-400/0 rounded-lg blur transition-all duration-300 group-hover:from-purple-400/10 group-hover:to-pink-400/10"></div>
                                            <Input 
                                                placeholder="Midnight Black"
                                                {...field}
                                                className="relative bg-white border-2 border-gray-200 rounded-xl h-11 hover:border-purple-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all"
                                            />
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} 
                        />
                        
                        <FormField 
                            control={formInstance.control} 
                            name="interiorColor" 
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="font-semibold text-gray-700 flex items-center gap-2">
                                        <Palette className="w-4 h-4" />
                                        Interior Color *
                                    </FormLabel>
                                    <FormControl>
                                        <div className="relative group">
                                            <div className="absolute inset-0 bg-gradient-to-r from-purple-400/0 to-pink-400/0 rounded-lg blur transition-all duration-300 group-hover:from-purple-400/10 group-hover:to-pink-400/10"></div>
                                            <Input 
                                                placeholder="Chestnut Brown"
                                                {...field}
                                                className="relative bg-white border-2 border-gray-200 rounded-xl h-11 hover:border-purple-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all"
                                            />
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} 
                        />
                    </div>
                </div>

                {/* STATUS - Card Style */}
                <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl p-6 border border-gray-200 shadow-lg">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-lg">
                            <BadgeCheck className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-gray-900">STATUS & BADGES</h3>
                            <p className="text-sm text-gray-600">Inventory visibility</p>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField control={formInstance.control} name="condition" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="font-semibold text-gray-700 flex items-center gap-2">
                                    <Star className="w-4 h-4" />
                                    Condition
                                </FormLabel>
                                <FormControl>
                                    <div className="relative group">
                                        <div className="absolute inset-0 bg-gradient-to-r from-emerald-400/0 to-teal-400/0 rounded-lg blur transition-all duration-300 group-hover:from-emerald-400/10 group-hover:to-teal-400/10"></div>
                                        <Input 
                                            placeholder="Excellent / Like New"
                                            {...field}
                                            className="relative bg-white border-2 border-gray-200 rounded-xl h-11 hover:border-emerald-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all"
                                        />
                                    </div>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        
                        <div>
                            <p className="font-semibold text-gray-700 mb-4">FEATURED BADGES</p>
                            <div className="flex items-center space-x-8">
                                <FormField control={formInstance.control} name="isNew" render={({ field }) => (
                                    <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                                        <FormControl>
                                            <div className="relative">
                                                <Checkbox 
                                                    checked={field.value} 
                                                    onCheckedChange={field.onChange}
                                                    className="h-6 w-6 border-2 border-gray-300 data-[state=checked]:bg-gradient-to-br data-[state=checked]:from-blue-500 data-[state=checked]:to-indigo-600 rounded-lg"
                                                />
                                            </div>
                                        </FormControl>
                                        <div>
                                            <FormLabel className="font-semibold text-gray-700 cursor-pointer">
                                                🆕 New Arrival
                                            </FormLabel>
                                            <p className="text-xs text-gray-500">Highlight recent inventory</p>
                                        </div>
                                    </FormItem>
                                )} />
                                
                                <FormField control={formInstance.control} name="isFeatured" render={({ field }) => (
                                    <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                                        <FormControl>
                                            <div className="relative">
                                                <Checkbox 
                                                    checked={field.value} 
                                                    onCheckedChange={field.onChange}
                                                    className="h-6 w-6 border-2 border-gray-300 data-[state=checked]:bg-gradient-to-br data-[state=checked]:from-amber-500 data-[state=checked]:to-orange-600 rounded-lg"
                                                />
                                            </div>
                                        </FormControl>
                                        <div>
                                            <FormLabel className="font-semibold text-gray-700 cursor-pointer">
                                                ⭐ Featured
                                            </FormLabel>
                                            <p className="text-xs text-gray-500">Promote on homepage</p>
                                        </div>
                                    </FormItem>
                                )} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* DESCRIPTION & FEATURES - Card Style */}
                <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl p-6 border border-gray-200 shadow-lg">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-gradient-to-br from-amber-500 to-yellow-500 rounded-lg">
                            <FileText className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-gray-900">DESCRIPTION & FEATURES</h3>
                            <p className="text-sm text-gray-600">Selling points & details</p>
                        </div>
                    </div>
                    
                    <div className="space-y-6">
                        <FormField control={formInstance.control} name="description" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="font-semibold text-gray-700 flex items-center gap-2">
                                    <FileText className="w-4 h-4" />
                                    Description *
                                </FormLabel>
                                <FormControl>
                                    <div className="relative group">
                                        <div className="absolute inset-0 bg-gradient-to-r from-amber-400/0 to-yellow-400/0 rounded-lg blur transition-all duration-300 group-hover:from-amber-400/10 group-hover:to-yellow-400/10"></div>
                                        <Textarea 
                                            placeholder="Describe this vehicle... Highlight key features, condition, and unique selling points."
                                            {...field}
                                            rows={4}
                                            className="relative bg-white border-2 border-gray-200 rounded-xl min-h-[120px] hover:border-amber-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all resize-y"
                                        />
                                    </div>
                                </FormControl>
                                <div className="flex justify-between text-sm text-gray-500">
                                    <span>Engaging descriptions increase sales</span>
                                    <span>{field.value?.length || 0}/2000 chars</span>
                                </div>
                                <FormMessage />
                            </FormItem>
                        )} />
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField control={formInstance.control} name="featuresInput" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="font-semibold text-gray-700 flex items-center gap-2">
                                        <Sparkles className="w-4 h-4" />
                                        Features (comma-separated)
                                    </FormLabel>
                                    <FormControl>
                                        <div className="relative group">
                                            <div className="absolute inset-0 bg-gradient-to-r from-amber-400/0 to-yellow-400/0 rounded-lg blur transition-all duration-300 group-hover:from-amber-400/10 group-hover:to-yellow-400/10"></div>
                                            <Input 
                                                placeholder="Leather Seats, Sunroof, Backup Camera, Heated Steering Wheel"
                                                {...field}
                                                className="relative bg-white border-2 border-gray-200 rounded-xl h-11 hover:border-amber-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all"
                                            />
                                        </div>
                                    </FormControl>
                                    <p className="text-xs text-gray-500 mt-1">Separate with commas for better display</p>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            
                            <FormField control={formInstance.control} name="optionsInput" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="font-semibold text-gray-700 flex items-center gap-2">
                                        <Package className="w-4 h-4" />
                                        Options (comma-separated)
                                    </FormLabel>
                                    <FormControl>
                                        <div className="relative group">
                                            <div className="absolute inset-0 bg-gradient-to-r from-amber-400/0 to-yellow-400/0 rounded-lg blur transition-all duration-300 group-hover:from-amber-400/10 group-hover:to-yellow-400/10"></div>
                                            <Input 
                                                placeholder="Navigation Package, Cold Weather Package, Premium Sound"
                                                {...field}
                                                className="relative bg-white border-2 border-gray-200 rounded-xl h-11 hover:border-amber-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all"
                                            />
                                        </div>
                                    </FormControl>
                                    <p className="text-xs text-gray-500 mt-1">Factory and dealer-installed options</p>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>
                    </div>
                </div>

                {/* IMAGE UPLOAD - Premium Card */}
                <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl p-6 border border-gray-200 shadow-lg">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-gradient-to-br from-rose-500 to-pink-500 rounded-lg">
                                <ImageIcon className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-gray-900">VEHICLE PHOTOS</h3>
                                <p className="text-sm text-gray-600">High-quality images sell faster</p>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-4">
                            <div className="px-4 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-full border border-blue-200">
                                <span className="font-bold text-blue-700">{totalImages} / {MAX_IMAGES}</span>
                                <span className="text-blue-600 text-sm ml-2">Images</span>
                            </div>
                            <div className={`px-3 py-1 rounded-full text-sm font-bold ${uploadDisabled ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                {uploadDisabled ? '⚠️ Limit Reached' : '✅ Ready'}
                            </div>
                        </div>
                    </div>
                    
                    <div className="mb-6">
                        <div className="relative group w-full">
                            <div className="absolute inset-0 bg-gradient-to-r from-rose-400/0 to-pink-400/0 rounded-xl blur transition-all duration-300 group-hover:from-rose-400/10 group-hover:to-pink-400/10"></div>
                            <label className="relative block cursor-pointer">
                                <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 hover:border-rose-400 rounded-2xl bg-white/80 backdrop-blur-sm p-8 transition-all hover:shadow-lg group-hover:scale-[1.01]">
                                    <div className="p-4 bg-gradient-to-br from-rose-100 to-pink-100 rounded-full mb-4">
                                        <Upload className="w-8 h-8 text-rose-600" />
                                    </div>
                                    <p className="text-lg font-bold text-gray-800 mb-2">
                                        🚀 DRAG & DROP PHOTOS HERE
                                    </p>
                                    <p className="text-gray-600 text-center mb-4">
                                        Upload up to {MAX_IMAGES} high-quality images
                                        <br />
                                        <span className="text-sm text-gray-500">Supports JPG, PNG, WebP • Max 10MB each</span>
                                    </p>
                                    <div className="px-6 py-3 bg-gradient-to-r from-rose-500 to-pink-500 text-white font-semibold rounded-lg hover:from-rose-600 hover:to-pink-600 transition-all shadow-md hover:shadow-lg">
                                        BROWSE FILES
                                    </div>
                                </div>
                                <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    onChange={handleFileChange}
                                    disabled={uploadDisabled}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                                />
                            </label>
                        </div>
                    </div>
                    
                    {/* Image Grid */}
                    {(currentImages.length > 0 || filesToUpload.length > 0) && (
                        <div className="mt-8">
                            <div className="flex items-center gap-2 mb-4">
                                <GalleryVertical className="w-5 h-5 text-gray-600" />
                                <h4 className="font-bold text-gray-800">PHOTO GALLERY</h4>
                                <span className="ml-auto text-sm text-gray-600">
                                    Click images to enlarge • Drag to reorder
                                </span>
                            </div>
                            
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                {currentImages.map((url, index) => (
                                    <div key={`existing-${index}`} className="relative group rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 hover:scale-[1.03]">
                                        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 to-indigo-500/0 group-hover:from-blue-500/10 group-hover:to-indigo-500/10 transition-all duration-300"></div>
                                        <img 
                                            src={url} 
                                            alt={`Vehicle image ${index + 1}`} 
                                            className="w-full h-32 object-cover"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                                        <Button 
                                            type="button"
                                            variant="destructive" 
                                            size="icon" 
                                            className="absolute top-2 right-2 h-8 w-8 rounded-full bg-gradient-to-br from-red-500 to-red-700 border-2 border-white shadow-lg opacity-0 group-hover:opacity-100 hover:scale-110 transition-all duration-200"
                                            onClick={() => handleRemoveExistingImage(url)}
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                        <div className="absolute bottom-2 left-2 bg-black/80 text-white text-xs px-2 py-1 rounded-full font-bold">
                                            #{index + 1}
                                        </div>
                                        <div className="absolute top-2 left-2 bg-blue-600 text-white text-xs px-2 py-1 rounded-full font-bold">
                                            ✓ EXISTING
                                        </div>
                                    </div>
                                ))}
                                
                                {filesToUpload.map((file, index) => (
                                    <div key={`new-${index}`} className="relative group rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 hover:scale-[1.03] border-2 border-dashed border-green-400">
                                        <div className="absolute inset-0 bg-gradient-to-br from-green-500/0 to-emerald-500/0 group-hover:from-green-500/10 group-hover:to-emerald-500/10 transition-all duration-300"></div>
                                        <img 
                                            src={URL.createObjectURL(file)} 
                                            alt={`New image ${index + 1}`} 
                                            className="w-full h-32 object-cover"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                                        <Button 
                                            type="button"
                                            variant="destructive" 
                                            size="icon" 
                                            className="absolute top-2 right-2 h-8 w-8 rounded-full bg-gradient-to-br from-red-500 to-red-700 border-2 border-white shadow-lg opacity-0 group-hover:opacity-100 hover:scale-110 transition-all duration-200"
                                            onClick={() => handleRemoveFileToUpload(index)}
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                        <div className="absolute bottom-2 left-2 bg-black/80 text-white text-xs px-2 py-1 rounded-full font-bold">
                                            #{currentImages.length + index + 1}
                                        </div>
                                        <div className="absolute top-2 left-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-xs px-2 py-1 rounded-full font-bold animate-pulse">
                                            🆕 NEW
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    
                    {/* Upload Status */}
                    <div className="mt-6 flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 text-gray-600">
                            <Info className="w-4 h-4" />
                            <span>Tip: Upload exterior, interior, and detail shots</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                                <span className="text-gray-700">Existing: {currentImages.length}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
                                <span className="text-gray-700">New: {filesToUpload.length}</span>
                            </div>
                        </div>
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
