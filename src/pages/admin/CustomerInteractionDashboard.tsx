// src/pages/admin/CustomerInteractionDashboard.tsx
// COMPLETE UPDATED VERSION WITH REVIEW TRACKING

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users, MessageCircle, DollarSign, FileText, Search, Filter, Eye, Phone, Mail, Star, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';

// FIREBASE IMPORTS
import { db } from '@/firebaseConfig';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';

// ====================================================================
// UPDATED TYPES WITH REVIEW FIELDS
// ====================================================================

interface ContactSubmission {
    id: string;
    type: 'contact';
    name: string;
    email: string;
    phone: string;
    subject: string;
    message: string;
    preferredContact: string;
    submittedAt: Date;
    status: string;
}

interface SoldVehicle {
    id: string;
    type: 'sale';
    customerName: string;
    customerPhone: string;
    vehicleId: string;
    vin: string;
    year: number;
    make: string;
    model: string;
    price: number;
    mileage: number;
    stockNumber?: string;
    dateSold: Date;
    
    // REVIEW TRACKING FIELDS
    requestFeedback?: boolean;
    feedbackSent?: boolean;
    feedbackSentAt?: Date;
    feedbackSubmitted?: boolean;
    feedbackSubmittedAt?: Date;
    feedbackSentiment?: 'positive' | 'neutral' | 'negative' | null;
    feedbackText?: string;
    status?: string;
}

interface CreditApplication {
    id: string;
    type: 'financing';
    firstName: string;
    lastName: string;
    email: string;
    mobilePhone: string;
    vehicleToFinance: string;
    monthlyIncome: string;
    submittedAt: Date;
    hasCoBuyer: boolean;
}

type Interaction = ContactSubmission | SoldVehicle | CreditApplication;

// ====================================================================
// MAIN COMPONENT
// ====================================================================

export const CustomerInteractionDashboard: React.FC = () => {
    const [interactions, setInteractions] = useState<Interaction[]>([]);
    const [filteredInteractions, setFilteredInteractions] = useState<Interaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<'all' | 'contact' | 'sale' | 'financing'>('all');
    const [selectedInteraction, setSelectedInteraction] = useState<Interaction | null>(null);
    const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);

    const { toast } = useToast();

    // ====================================================================
    // FETCH DATA WITH REVIEW FIELDS
    // ====================================================================

    const fetchInteractions = async () => {
        setIsLoading(true);
        try {
            const allInteractions: Interaction[] = [];

            // Fetch Contact Submissions
            const contactRef = collection(db, 'contact_submissions');
            const contactQuery = query(contactRef, orderBy('submittedAt', 'desc'));
            const contactSnapshot = await getDocs(contactQuery);
            
            contactSnapshot.docs.forEach(doc => {
                const data = doc.data();
                allInteractions.push({
                    id: doc.id,
                    type: 'contact',
                    name: data.name || '',
                    email: data.email || '',
                    phone: data.phone || '',
                    subject: data.subject || '',
                    message: data.message || '',
                    preferredContact: data.preferredContact || '',
                    submittedAt: data.submittedAt?.toDate() || new Date(),
                    status: data.status || 'new',
                } as ContactSubmission);
            });

            // Fetch Sold Vehicles WITH REVIEW FIELDS
            const soldRef = collection(db, 'sold_vehicles');
            const soldQuery = query(soldRef, orderBy('dateSold', 'desc'));
            const soldSnapshot = await getDocs(soldQuery);
            
            soldSnapshot.docs.forEach(doc => {
                const data = doc.data();
                allInteractions.push({
                    id: doc.id,
                    type: 'sale',
                    customerName: data.customerName || '',
                    customerPhone: data.customerPhone || '',
                    vehicleId: data.vehicleId || '',
                    vin: data.vin || '',
                    year: data.year || 0,
                    make: data.make || '',
                    model: data.model || '',
                    price: data.price || 0,
                    mileage: data.mileage || 0,
                    stockNumber: data.stockNumber,
                    dateSold: data.dateSold ? new Date(data.dateSold) : new Date(),
                    
                    // REVIEW FIELDS
                    requestFeedback: data.requestFeedback || false,
                    feedbackSent: data.feedbackSent || false,
                    feedbackSentAt: data.feedbackSentAt ? new Date(data.feedbackSentAt) : undefined,
                    feedbackSubmitted: data.feedbackSubmitted || false,
                    feedbackSubmittedAt: data.feedbackSubmittedAt ? new Date(data.feedbackSubmittedAt) : undefined,
                    feedbackSentiment: data.feedbackSentiment || null,
                    feedbackText: data.feedbackText || '',
                    status: data.status || 'pending',
                } as SoldVehicle);
            });

            // Fetch Credit Applications
            const creditRef = collection(db, 'creditApplications');
            const creditQuery = query(creditRef, orderBy('submittedAt', 'desc'));
            const creditSnapshot = await getDocs(creditQuery);
            
            creditSnapshot.docs.forEach(doc => {
                const data = doc.data();
                allInteractions.push({
                    id: doc.id,
                    type: 'financing',
                    firstName: data.firstName || '',
                    lastName: data.lastName || '',
                    email: data.email || '',
                    mobilePhone: data.mobilePhone || '',
                    vehicleToFinance: data.vehicleToFinance || '',
                    monthlyIncome: data.monthlyIncome || '',
                    submittedAt: data.submittedAt ? new Date(data.submittedAt) : new Date(),
                    hasCoBuyer: data.hasCoBuyer || false,
                } as CreditApplication);
            });

            // Sort all interactions by date (most recent first)
            allInteractions.sort((a, b) => {
                const dateA = a.type === 'contact' ? a.submittedAt : 
                             a.type === 'sale' ? a.dateSold : a.submittedAt;
                const dateB = b.type === 'contact' ? b.submittedAt : 
                             b.type === 'sale' ? b.dateSold : b.submittedAt;
                return dateB.getTime() - dateA.getTime();
            });

            setInteractions(allInteractions);
            setFilteredInteractions(allInteractions);
        } catch (error) {
            console.error("Error fetching interactions:", error);
            toast({ 
                title: "Error", 
                description: "Failed to load interactions.", 
                variant: "destructive" 
            });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchInteractions();
    }, []);

    // ====================================================================
    // FILTERING
    // ====================================================================

    useEffect(() => {
        let filtered = [...interactions];

        // Filter by type
        if (filterType !== 'all') {
            filtered = filtered.filter(i => i.type === filterType);
        }

        // Filter by search term
        if (searchTerm) {
            filtered = filtered.filter(i => {
                const searchLower = searchTerm.toLowerCase();
                if (i.type === 'contact') {
                    return i.name.toLowerCase().includes(searchLower) ||
                           i.email.toLowerCase().includes(searchLower) ||
                           i.phone.includes(searchTerm);
                } else if (i.type === 'sale') {
                    const sale = i as SoldVehicle;
                    return sale.customerName.toLowerCase().includes(searchLower) ||
                           sale.customerPhone.includes(searchTerm) ||
                           `${sale.year} ${sale.make} ${sale.model}`.toLowerCase().includes(searchLower) ||
                           sale.vin.toLowerCase().includes(searchLower) ||
                           (sale.feedbackText && sale.feedbackText.toLowerCase().includes(searchLower));
                } else {
                    return `${i.firstName} ${i.lastName}`.toLowerCase().includes(searchLower) ||
                           i.email.toLowerCase().includes(searchLower) ||
                           i.mobilePhone.includes(searchTerm);
                }
            });
        }

        setFilteredInteractions(filtered);
    }, [searchTerm, filterType, interactions]);

    // ====================================================================
    // HELPERS
    // ====================================================================

    const getInteractionBadge = (type: string) => {
        switch (type) {
            case 'contact':
                return <Badge className="bg-blue-100 text-blue-800"><MessageCircle className="w-3 h-3 mr-1" /> Contact</Badge>;
            case 'sale':
                return <Badge className="bg-green-100 text-green-800"><DollarSign className="w-3 h-3 mr-1" /> Sale</Badge>;
            case 'financing':
                return <Badge className="bg-purple-100 text-purple-800"><FileText className="w-3 h-3 mr-1" /> Financing</Badge>;
            default:
                return null;
        }
    };

    const getReviewBadge = (sale: SoldVehicle) => {
        if (!sale.requestFeedback) {
            return <Badge variant="outline" className="bg-gray-100 text-gray-600">❌ No Review</Badge>;
        }
        
        if (!sale.feedbackSent) {
            return <Badge variant="outline" className="bg-gray-100">⏳ Pending</Badge>;
        }
        
        if (!sale.feedbackSubmitted) {
            return <Badge variant="outline" className="bg-yellow-100 text-yellow-800">📤 Sent</Badge>;
        }
        
        switch (sale.feedbackSentiment) {
            case 'positive':
                return <Badge className="bg-green-100 text-green-800">✅ Positive</Badge>;
            case 'negative':
                return <Badge className="bg-red-100 text-red-800">⚠️ Needs Follow-up</Badge>;
            case 'neutral':
                return <Badge className="bg-blue-100 text-blue-800">📝 Feedback</Badge>;
            default:
                return <Badge variant="outline">📝 Submitted</Badge>;
        }
    };

    const formatDate = (date: Date | undefined) => {
        if (!date) return 'N/A';
        return new Intl.DateTimeFormat('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    };

    const handleViewDetails = (interaction: Interaction) => {
        setSelectedInteraction(interaction);
        setIsDetailDialogOpen(true);
    };

    // ====================================================================
    // STATS WITH REVIEW METRICS
    // ====================================================================

    const stats = {
        total: interactions.length,
        contacts: interactions.filter(i => i.type === 'contact').length,
        sales: interactions.filter(i => i.type === 'sale').length,
        financing: interactions.filter(i => i.type === 'financing').length,
        
        // Review Stats
        reviewRequests: interactions.filter(i => 
            i.type === 'sale' && (i as SoldVehicle).requestFeedback
        ).length,
        reviewsSent: interactions.filter(i => 
            i.type === 'sale' && (i as SoldVehicle).feedbackSent
        ).length,
        reviewsSubmitted: interactions.filter(i => 
            i.type === 'sale' && (i as SoldVehicle).feedbackSubmitted
        ).length,
        positiveReviews: interactions.filter(i => 
            i.type === 'sale' && (i as SoldVehicle).feedbackSentiment === 'positive'
        ).length,
        negativeReviews: interactions.filter(i => 
            i.type === 'sale' && (i as SoldVehicle).feedbackSentiment === 'negative'
        ).length,
    };

    // ====================================================================
    // RENDER
    // ====================================================================

    return (
        <div className="container mx-auto p-4 md:p-8 space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-4xl font-bold tracking-tight flex items-center gap-3">
                        <Users className="w-8 h-8" /> Customer Interactions
                    </h1>
                    <p className="text-muted-foreground mt-2">
                        Track all customer touchpoints: inquiries, sales, and review status
                    </p>
                </div>
            </div>

            {/* ENHANCED STATS CARDS WITH REVIEW METRICS */}
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Total</p>
                                <p className="text-2xl font-bold">{stats.total}</p>
                            </div>
                            <Users className="w-6 h-6 text-primary opacity-20" />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Contacts</p>
                                <p className="text-2xl font-bold text-blue-600">{stats.contacts}</p>
                            </div>
                            <MessageCircle className="w-6 h-6 text-blue-600 opacity-20" />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Sales</p>
                                <p className="text-2xl font-bold text-green-600">{stats.sales}</p>
                            </div>
                            <DollarSign className="w-6 h-6 text-green-600 opacity-20" />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Reviews Sent</p>
                                <p className="text-2xl font-bold text-amber-600">{stats.reviewsSent}</p>
                            </div>
                            <Star className="w-6 h-6 text-amber-600 opacity-20" />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Positive</p>
                                <p className="text-2xl font-bold text-emerald-600">{stats.positiveReviews}</p>
                            </div>
                            <CheckCircle2 className="w-6 h-6 text-emerald-600 opacity-20" />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">⚠️ Follow-up</p>
                                <p className="text-2xl font-bold text-rose-600">{stats.negativeReviews}</p>
                            </div>
                            <AlertCircle className="w-6 h-6 text-rose-600 opacity-20" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* FILTERS */}
            <Card>
                <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by name, email, phone, VIN, feedback..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                        <Select value={filterType} onValueChange={(value: any) => setFilterType(value)}>
                            <SelectTrigger className="w-full md:w-[200px]">
                                <Filter className="h-4 w-4 mr-2" />
                                <SelectValue placeholder="Filter by type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Interactions</SelectItem>
                                <SelectItem value="contact">Contact Forms</SelectItem>
                                <SelectItem value="sale">Sales</SelectItem>
                                <SelectItem value="financing">Financing Apps</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* ENHANCED INTERACTIONS TABLE WITH REVIEW STATUS */}
            <Card>
                <CardHeader>
                    <CardTitle>All Interactions ({filteredInteractions.length})</CardTitle>
                    <CardDescription>Customer touchpoints sorted by most recent</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                            <span>Loading interactions...</span>
                        </div>
                    ) : filteredInteractions.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                            <p>No interactions found</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Customer</TableHead>
                                        <TableHead>Contact Info</TableHead>
                                        <TableHead>Details</TableHead>
                                        <TableHead>Review Status</TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredInteractions.map((interaction) => {
                                        const isSale = interaction.type === 'sale';
                                        const sale = interaction as SoldVehicle;
                                        
                                        return (
                                            <TableRow key={`${interaction.type}-${interaction.id}`}>
                                                <TableCell>{getInteractionBadge(interaction.type)}</TableCell>
                                                <TableCell className="font-medium">
                                                    {interaction.type === 'contact' ? interaction.name :
                                                     interaction.type === 'sale' ? interaction.customerName :
                                                     `${interaction.firstName} ${interaction.lastName}`}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="text-sm space-y-1">
                                                        {interaction.type === 'contact' && (
                                                            <>
                                                                <div className="flex items-center gap-1">
                                                                    <Mail className="w-3 h-3" />
                                                                    <span className="text-xs">{interaction.email}</span>
                                                                </div>
                                                                {interaction.phone && (
                                                                    <div className="flex items-center gap-1">
                                                                        <Phone className="w-3 h-3" />
                                                                        <span className="text-xs">{interaction.phone}</span>
                                                                    </div>
                                                                )}
                                                            </>
                                                        )}
                                                        {interaction.type === 'sale' && (
                                                            <div className="flex items-center gap-1">
                                                                <Phone className="w-3 h-3" />
                                                                <span className="text-xs">{interaction.customerPhone}</span>
                                                            </div>
                                                        )}
                                                        {interaction.type === 'financing' && (
                                                            <>
                                                                <div className="flex items-center gap-1">
                                                                    <Mail className="w-3 h-3" />
                                                                    <span className="text-xs">{interaction.email}</span>
                                                                </div>
                                                                <div className="flex items-center gap-1">
                                                                    <Phone className="w-3 h-3" />
                                                                    <span className="text-xs">{interaction.mobilePhone}</span>
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="text-sm">
                                                        {interaction.type === 'contact' && (
                                                            <span className="text-muted-foreground">Subject: {interaction.subject}</span>
                                                        )}
                                                        {interaction.type === 'sale' && (
                                                            <div>
                                                                <div className="font-medium">{sale.year} {sale.make} {sale.model}</div>
                                                                <div className="text-xs text-muted-foreground">
                                                                    ${sale.price.toLocaleString()} • {sale.vin}
                                                                </div>
                                                            </div>
                                                        )}
                                                        {interaction.type === 'financing' && (
                                                            <div className="text-xs text-muted-foreground">
                                                                {interaction.vehicleToFinance || 'Vehicle info pending'}
                                                            </div>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {isSale ? (
                                                        <div className="space-y-1">
                                                            {getReviewBadge(sale)}
                                                            {sale.feedbackSubmittedAt && (
                                                                <div className="text-xs text-gray-500">
                                                                    {formatDate(sale.feedbackSubmittedAt)}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-gray-400">—</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-sm text-muted-foreground">
                                                    {formatDate(
                                                        interaction.type === 'contact' ? interaction.submittedAt :
                                                        interaction.type === 'sale' ? interaction.dateSold :
                                                        interaction.submittedAt
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleViewDetails(interaction)}
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* ENHANCED DETAIL DIALOG WITH REVIEW INFO */}
            <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
                <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Interaction Details</DialogTitle>
                        <DialogDescription>
                            {selectedInteraction && getInteractionBadge(selectedInteraction.type)}
                        </DialogDescription>
                    </DialogHeader>
                    {selectedInteraction && (
                        <div className="space-y-4">
                            {selectedInteraction.type === 'contact' && (
                                <>
                                    <div><strong>Name:</strong> {selectedInteraction.name}</div>
                                    <div><strong>Email:</strong> {selectedInteraction.email}</div>
                                    <div><strong>Phone:</strong> {selectedInteraction.phone || 'N/A'}</div>
                                    <div><strong>Subject:</strong> {selectedInteraction.subject}</div>
                                    <div><strong>Preferred Contact:</strong> {selectedInteraction.preferredContact || 'N/A'}</div>
                                    <div><strong>Message:</strong><br/>{selectedInteraction.message}</div>
                                    <div><strong>Submitted:</strong> {formatDate(selectedInteraction.submittedAt)}</div>
                                    <div><strong>Status:</strong> <Badge>{selectedInteraction.status}</Badge></div>
                                </>
                            )}
                            
                            {selectedInteraction.type === 'sale' && (() => {
                                const sale = selectedInteraction as SoldVehicle;
                                return (
                                    <>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div><strong>Customer:</strong> {sale.customerName}</div>
                                            <div><strong>Phone:</strong> {sale.customerPhone}</div>
                                            <div><strong>Vehicle:</strong> {sale.year} {sale.make} {sale.model}</div>
                                            <div><strong>VIN:</strong> {sale.vin}</div>
                                            <div><strong>Stock #:</strong> {sale.stockNumber || 'N/A'}</div>
                                            <div><strong>Sale Price:</strong> ${sale.price.toLocaleString()}</div>
                                            <div><strong>Mileage:</strong> {sale.mileage.toLocaleString()} mi</div>
                                            <div><strong>Date Sold:</strong> {formatDate(sale.dateSold)}</div>
                                        </div>
                                        
                                        {/* REVIEW STATUS SECTION */}
                                        <div className="pt-4 border-t mt-4">
                                            <h4 className="font-semibold mb-2 flex items-center gap-2">
                                                <Star className="w-4 h-4" /> Review Status
                                            </h4>
                                            {sale.requestFeedback ? (
                                                <div className="space-y-3">
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div>
                                                            <strong>Review Request:</strong> 
                                                            <span className={`ml-2 ${sale.feedbackSent ? 'text-green-600' : 'text-amber-600'}`}>
                                                                {sale.feedbackSent ? '✅ Sent' : '⏳ Pending'}
                                                            </span>
                                                        </div>
                                                        {sale.feedbackSentAt && (
                                                            <div><strong>Sent At:</strong> {formatDate(sale.feedbackSentAt)}</div>
                                                        )}
                                                    </div>
                                                    
                                                    {sale.feedbackSubmitted && (
                                                        <>
                                                            <div className="grid grid-cols-2 gap-4">
                                                                <div>
                                                                    <strong>Customer Response:</strong>
                                                                    <div className="mt-1">
                                                                        {getReviewBadge(sale)}
                                                                    </div>
                                                                </div>
                                                                {sale.feedbackSubmittedAt && (
                                                                    <div><strong>Response Date:</strong> {formatDate(sale.feedbackSubmittedAt)}</div>
                                                                )}
                                                            </div>
                                                            
                                                            {sale.feedbackText && (
                                                                <div>
                                                                    <strong>Feedback:</strong>
                                                                    <div className="mt-2 p-3 bg-gray-50 rounded border">
                                                                        {sale.feedbackText}
                                                                    </div>
                                                                </div>
                                                            )}
                                                            
                                                            {sale.feedbackSentiment === 'negative' && (
                                                                <Alert className="bg-red-50 border-red-200">
                                                                    <AlertCircle className="h-4 w-4 text-red-600" />
                                                                    <AlertDescription className="text-red-800 font-medium">
                                                                        Manager has been alerted via SMS
                                                                    </AlertDescription>
                                                                </Alert>
                                                            )}
                                                            
                                                            {sale.feedbackSentiment === 'positive' && (
                                                                <Alert className="bg-green-50 border-green-200">
                                                                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                                                                    <AlertDescription className="text-green-800 font-medium">
                                                                        Customer was redirected to Google Reviews
                                                                    </AlertDescription>
                                                                </Alert>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="text-gray-500 italic">
                                                    No review was requested for this sale
                                                </div>
                                            )}
                                        </div>
                                    </>
                                );
                            })()}
                            
                            {selectedInteraction.type === 'financing' && (
                                <>
                                    <div><strong>Name:</strong> {selectedInteraction.firstName} {selectedInteraction.lastName}</div>
                                    <div><strong>Email:</strong> {selectedInteraction.email}</div>
                                    <div><strong>Phone:</strong> {selectedInteraction.mobilePhone}</div>
                                    <div><strong>Vehicle:</strong> {selectedInteraction.vehicleToFinance || 'N/A'}</div>
                                    <div><strong>Monthly Income:</strong> ${selectedInteraction.monthlyIncome || 'N/A'}</div>
                                    <div><strong>Co-Buyer:</strong> {selectedInteraction.hasCoBuyer ? 'Yes' : 'No'}</div>
                                    <div><strong>Submitted:</strong> {formatDate(selectedInteraction.submittedAt)}</div>
                                </>
                            )}
                        </div>
                    )}
                    <DialogFooter>
                        <Button onClick={() => setIsDetailDialogOpen(false)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Toaster />
        </div>
    );
};