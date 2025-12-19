// src/pages/admin/CustomerInteractionDashboard.tsx
// ENHANCED 10X VERSION - GROUPED BY CUSTOMER + SMART FEATURES

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, Users, MessageCircle, DollarSign, FileText, Search, Filter, Eye, Phone, Mail, 
  Star, AlertCircle, CheckCircle2, ChevronDown, ChevronUp, User, Car, Calendar, 
  PhoneCall, History, TrendingUp, Shield, Award, Target
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// FIREBASE IMPORTS
import { db } from '@/firebaseConfig';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';

// ====================================================================
// ENHANCED TYPES
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
    submittedAt: Date | null;
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
    dateSold: Date | null;
    
    // REVIEW TRACKING
    requestFeedback?: boolean;
    feedbackSent?: boolean;
    feedbackSentAt?: Date | null;
    feedbackSubmitted?: boolean;
    feedbackSubmittedAt?: Date | null;
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
    submittedAt: Date | null;
    hasCoBuyer: boolean;
}

type Interaction = ContactSubmission | SoldVehicle | CreditApplication;

// NEW: Customer Group Type
interface CustomerGroup {
    customerId: string; // phone number is the unique identifier
    primaryPhone: string;
    customerName: string;
    totalInteractions: number;
    lastActivity: Date | null;
    interactions: Interaction[];
    stats: {
        totalSales: number;
        totalRevenue: number;
        pendingReviews: number;
        positiveReviews: number;
        negativeReviews: number;
        averageSalePrice: number;
    };
    tags: string[];
}

// Type guards
const isContactSubmission = (interaction: Interaction): interaction is ContactSubmission => interaction.type === 'contact';
const isSoldVehicle = (interaction: Interaction): interaction is SoldVehicle => interaction.type === 'sale';
const isCreditApplication = (interaction: Interaction): interaction is CreditApplication => interaction.type === 'financing';

// ====================================================================
// UTILITIES
// ====================================================================

const safeDateParse = (dateValue: any): Date | null => {
    if (!dateValue) return null;
    try {
        if (dateValue instanceof Date) return isNaN(dateValue.getTime()) ? null : dateValue;
        if (dateValue && typeof dateValue.toDate === 'function') {
            const date = dateValue.toDate();
            return isNaN(date.getTime()) ? null : date;
        }
        const date = new Date(dateValue);
        return isNaN(date.getTime()) ? null : date;
    } catch { return null; }
};

const formatDate = (dateValue: Date | null | undefined): string => {
    if (!dateValue) return 'N/A';
    const date = safeDateParse(dateValue);
    if (!date) return 'N/A';
    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
};

const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
};

// ====================================================================
// MAIN COMPONENT - 10X ENHANCED
// ====================================================================

export const CustomerInteractionDashboard: React.FC = () => {
    const [interactions, setInteractions] = useState<Interaction[]>([]);
    const [customerGroups, setCustomerGroups] = useState<CustomerGroup[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<'all' | 'contact' | 'sale' | 'financing'>('all');
    const [viewMode, setViewMode] = useState<'customers' | 'timeline'>('customers');
    const [selectedCustomer, setSelectedCustomer] = useState<CustomerGroup | null>(null);
    const [selectedInteraction, setSelectedInteraction] = useState<Interaction | null>(null);
    const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set());
    const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
    const [isCustomerDetailOpen, setIsCustomerDetailOpen] = useState(false);
    
    const { toast } = useToast();

    // ====================================================================
    // DATA FETCHING & GROUPING
    // ====================================================================

    const fetchInteractions = async () => {
        setIsLoading(true);
        try {
            const allInteractions: Interaction[] = [];

            // Fetch all data in parallel
            const [contactSnapshot, soldSnapshot, creditSnapshot] = await Promise.all([
                getDocs(query(collection(db, 'contact_submissions'), orderBy('submittedAt', 'desc'))),
                getDocs(query(collection(db, 'sold_vehicles'), orderBy('dateSold', 'desc'))),
                getDocs(query(collection(db, 'creditApplications'), orderBy('submittedAt', 'desc')))
            ]);

            // Process contacts
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
                    submittedAt: safeDateParse(data.submittedAt),
                    status: data.status || 'new',
                });
            });

            // Process sales
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
                    dateSold: safeDateParse(data.dateSold),
                    requestFeedback: data.requestFeedback || false,
                    feedbackSent: data.feedbackSent || false,
                    feedbackSentAt: safeDateParse(data.feedbackSentAt),
                    feedbackSubmitted: data.feedbackSubmitted || false,
                    feedbackSubmittedAt: safeDateParse(data.feedbackSubmittedAt),
                    feedbackSentiment: data.feedbackSentiment || null,
                    feedbackText: data.feedbackText || '',
                    status: data.status || 'pending',
                });
            });

            // Process credit apps
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
                    submittedAt: safeDateParse(data.submittedAt),
                    hasCoBuyer: data.hasCoBuyer || false,
                });
            });

            setInteractions(allInteractions);
            groupCustomersByPhone(allInteractions);
        } catch (error) {
            console.error("Error:", error);
            toast({ title: "Error", description: "Failed to load data", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    const groupCustomersByPhone = (allInteractions: Interaction[]) => {
        const phoneMap = new Map<string, CustomerGroup>();
        
        allInteractions.forEach(interaction => {
            const phone = isContactSubmission(interaction) ? interaction.phone :
                         isSoldVehicle(interaction) ? interaction.customerPhone :
                         interaction.mobilePhone;
            
            if (!phone) return;
            
            const cleanPhone = phone.replace(/\D/g, '').slice(-10);
            if (!cleanPhone) return;
            
            if (!phoneMap.has(cleanPhone)) {
                const customerName = isContactSubmission(interaction) ? interaction.name :
                                   isSoldVehicle(interaction) ? interaction.customerName :
                                   `${interaction.firstName} ${interaction.lastName}`;
                
                phoneMap.set(cleanPhone, {
                    customerId: cleanPhone,
                    primaryPhone: phone,
                    customerName: customerName || 'Unknown Customer',
                    totalInteractions: 0,
                    lastActivity: null,
                    interactions: [],
                    stats: {
                        totalSales: 0,
                        totalRevenue: 0,
                        pendingReviews: 0,
                        positiveReviews: 0,
                        negativeReviews: 0,
                        averageSalePrice: 0
                    },
                    tags: []
                });
            }
            
            const group = phoneMap.get(cleanPhone)!;
            group.interactions.push(interaction);
            group.totalInteractions++;
            
            // Update last activity
            const interactionDate = isContactSubmission(interaction) ? interaction.submittedAt :
                                  isSoldVehicle(interaction) ? interaction.dateSold :
                                  interaction.submittedAt;
            
            if (interactionDate && (!group.lastActivity || interactionDate > group.lastActivity)) {
                group.lastActivity = interactionDate;
            }
            
            // Update stats for sales
            if (isSoldVehicle(interaction)) {
                group.stats.totalSales++;
                group.stats.totalRevenue += interaction.price || 0;
                
                if (interaction.requestFeedback) {
                    if (!interaction.feedbackSubmitted) {
                        group.stats.pendingReviews++;
                    } else if (interaction.feedbackSentiment === 'positive') {
                        group.stats.positiveReviews++;
                    } else if (interaction.feedbackSentiment === 'negative') {
                        group.stats.negativeReviews++;
                    }
                }
            }
            
            // Generate tags
            const tags = new Set(group.tags);
            if (isSoldVehicle(interaction)) tags.add('Buyer');
            if (isContactSubmission(interaction)) tags.add('Inquirer');
            if (isCreditApplication(interaction)) tags.add('Financing');
            if (group.stats.totalSales > 1) tags.add('Repeat Customer');
            if (group.stats.positiveReviews > 0) tags.add('Happy Customer');
            if (group.stats.negativeReviews > 0) tags.add('Needs Attention');
            
            group.tags = Array.from(tags);
        });
        
        // Calculate averages
        Array.from(phoneMap.values()).forEach(group => {
            if (group.stats.totalSales > 0) {
                group.stats.averageSalePrice = Math.round(group.stats.totalRevenue / group.stats.totalSales);
            }
        });
        
        // Sort by last activity (most recent first)
        const sortedGroups = Array.from(phoneMap.values()).sort((a, b) => {
            if (!a.lastActivity && !b.lastActivity) return 0;
            if (!a.lastActivity) return 1;
            if (!b.lastActivity) return -1;
            return b.lastActivity.getTime() - a.lastActivity.getTime();
        });
        
        setCustomerGroups(sortedGroups);
    };

    useEffect(() => {
        fetchInteractions();
    }, []);

    // ====================================================================
    // FILTERED DATA
    // ====================================================================

    const filteredCustomerGroups = useMemo(() => {
        let filtered = [...customerGroups];
        
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(group => 
                group.customerName.toLowerCase().includes(term) ||
                group.primaryPhone.includes(term) ||
                group.tags.some(tag => tag.toLowerCase().includes(term))
            );
        }
        
        if (filterType !== 'all') {
            filtered = filtered.filter(group => 
                group.interactions.some(i => i.type === filterType)
            );
        }
        
        return filtered;
    }, [customerGroups, searchTerm, filterType]);

    const getInteractionBadge = (type: string) => {
        const config = {
            contact: { bg: 'bg-blue-100 text-blue-800', icon: MessageCircle, label: 'Contact' },
            sale: { bg: 'bg-green-100 text-green-800', icon: DollarSign, label: 'Sale' },
            financing: { bg: 'bg-purple-100 text-purple-800', icon: FileText, label: 'Financing' }
        }[type];
        
        if (!config) return null;
        const Icon = config.icon;
        return <Badge className={`${config.bg}`}><Icon className="w-3 h-3 mr-1" /> {config.label}</Badge>;
    };

    const getReviewBadge = (sale: SoldVehicle) => {
        if (!sale.requestFeedback) return <Badge variant="outline" className="bg-gray-100 text-gray-600">No Review</Badge>;
        if (!sale.feedbackSent) return <Badge variant="outline" className="bg-gray-100">Pending</Badge>;
        if (!sale.feedbackSubmitted) return <Badge variant="outline" className="bg-yellow-100 text-yellow-800">Sent</Badge>;
        
        const config = {
            positive: { bg: 'bg-green-100 text-green-800', label: 'Positive' },
            negative: { bg: 'bg-red-100 text-red-800', label: 'Needs Follow-up' },
            neutral: { bg: 'bg-blue-100 text-blue-800', label: 'Feedback' }
        }[sale.feedbackSentiment || 'neutral'];
        
        return <Badge className={config?.bg}>{config?.label}</Badge>;
    };

    // ====================================================================
    // INTERACTION HANDLERS
    // ====================================================================

    const handleViewInteraction = (interaction: Interaction) => {
        setSelectedInteraction(interaction);
        setIsDetailDialogOpen(true);
    };

    const handleViewCustomer = (customer: CustomerGroup) => {
        setSelectedCustomer(customer);
        setIsCustomerDetailOpen(true);
    };

    const toggleCustomerExpand = (customerId: string) => {
        const newExpanded = new Set(expandedCustomers);
        if (newExpanded.has(customerId)) {
            newExpanded.delete(customerId);
        } else {
            newExpanded.add(customerId);
        }
        setExpandedCustomers(newExpanded);
    };

    // ====================================================================
    // QUICK STATS
    // ====================================================================

    const quickStats = useMemo(() => {
        const totalCustomers = customerGroups.length;
        const repeatCustomers = customerGroups.filter(g => g.stats.totalSales > 1).length;
        const pendingReviews = customerGroups.reduce((sum, g) => sum + g.stats.pendingReviews, 0);
        const totalRevenue = customerGroups.reduce((sum, g) => sum + g.stats.totalRevenue, 0);
        const avgCustomerValue = totalCustomers > 0 ? Math.round(totalRevenue / totalCustomers) : 0;
        
        return { totalCustomers, repeatCustomers, pendingReviews, totalRevenue, avgCustomerValue };
    }, [customerGroups]);

    // ====================================================================
    // RENDER - 10X ENHANCED UI
    // ====================================================================

    return (
        <div className="container mx-auto p-4 md:p-8 space-y-6">
            {/* HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl md:text-4xl font-bold tracking-tight flex items-center gap-3">
                        <Users className="w-8 h-8" /> Customer Intelligence
                    </h1>
                    <p className="text-muted-foreground mt-2">
                        Grouped by customer • Real business insights • No fluff
                    </p>
                </div>
                
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => fetchInteractions()}>
                        <History className="w-4 h-4 mr-2" /> Refresh
                    </Button>
                    <Select value={viewMode} onValueChange={(v: any) => setViewMode(v)}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="customers">By Customer</SelectItem>
                            <SelectItem value="timeline">Timeline</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* QUICK STATS BAR */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <Card className="border-l-4 border-l-blue-500">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Total Customers</p>
                                <p className="text-2xl font-bold">{quickStats.totalCustomers}</p>
                            </div>
                            <User className="w-6 h-6 text-blue-500 opacity-60" />
                        </div>
                    </CardContent>
                </Card>
                
                <Card className="border-l-4 border-l-green-500">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Repeat Buyers</p>
                                <p className="text-2xl font-bold text-green-600">{quickStats.repeatCustomers}</p>
                            </div>
                            <Award className="w-6 h-6 text-green-500 opacity-60" />
                        </div>
                    </CardContent>
                </Card>
                
                <Card className="border-l-4 border-l-amber-500">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Pending Reviews</p>
                                <p className="text-2xl font-bold text-amber-600">{quickStats.pendingReviews}</p>
                            </div>
                            <Star className="w-6 h-6 text-amber-500 opacity-60" />
                        </div>
                    </CardContent>
                </Card>
                
                <Card className="border-l-4 border-l-emerald-500">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Total Revenue</p>
                                <p className="text-2xl font-bold text-emerald-600">{formatCurrency(quickStats.totalRevenue)}</p>
                            </div>
                            <TrendingUp className="w-6 h-6 text-emerald-500 opacity-60" />
                        </div>
                    </CardContent>
                </Card>
                
                <Card className="border-l-4 border-l-purple-500">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Avg. Customer Value</p>
                                <p className="text-2xl font-bold text-purple-600">{formatCurrency(quickStats.avgCustomerValue)}</p>
                            </div>
                            <Target className="w-6 h-6 text-purple-500 opacity-60" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* FILTER BAR */}
            <Card>
                <CardContent className="p-5">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search customers by name, phone, or tag..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                        <Select value={filterType} onValueChange={(v: any) => setFilterType(v)}>
                            <SelectTrigger className="w-full md:w-[200px]">
                                <Filter className="h-4 w-4 mr-2" />
                                <SelectValue placeholder="Filter type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Interactions</SelectItem>
                                <SelectItem value="contact">Contact Forms</SelectItem>
                                <SelectItem value="sale">Sales</SelectItem>
                                <SelectItem value="financing">Financing</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* MAIN CONTENT */}
            <Tabs value={viewMode} className="w-full">
                <TabsContent value="customers" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Customers ({filteredCustomerGroups.length})</CardTitle>
                            <CardDescription>
                                Grouped by phone number • Click to expand details
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {isLoading ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="mr-3 h-8 w-8 animate-spin" />
                                    <span className="text-lg">Loading customer data...</span>
                                </div>
                            ) : filteredCustomerGroups.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
                                    <p className="text-lg">No customers found</p>
                                    <p className="text-sm mt-2">Try adjusting your search filters</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {filteredCustomerGroups.map((customer) => (
                                        <Card key={customer.customerId} className="overflow-hidden">
                                            {/* CUSTOMER HEADER */}
                                            <div 
                                                className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                                                onClick={() => toggleCustomerExpand(customer.customerId)}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                                            {expandedCustomers.has(customer.customerId) ? 
                                                                <ChevronUp className="h-4 w-4" /> : 
                                                                <ChevronDown className="h-4 w-4" />
                                                            }
                                                        </Button>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <h3 className="font-bold text-lg">{customer.customerName}</h3>
                                                                <TooltipProvider>
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <Button 
                                                                                variant="ghost" 
                                                                                size="sm" 
                                                                                className="h-6 px-2"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    handleViewCustomer(customer);
                                                                                }}
                                                                            >
                                                                                <Eye className="h-3 w-3" />
                                                                            </Button>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent>View full profile</TooltipContent>
                                                                    </Tooltip>
                                                                </TooltipProvider>
                                                            </div>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <Phone className="h-3 w-3 text-muted-foreground" />
                                                                <span className="text-sm font-mono">{customer.primaryPhone}</span>
                                                                <span className="text-xs text-muted-foreground">
                                                                    • {customer.totalInteractions} interaction{customer.totalInteractions !== 1 ? 's' : ''}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="flex items-center gap-3">
                                                        {/* TAGS */}
                                                        <div className="flex flex-wrap gap-1 max-w-[300px] justify-end">
                                                            {customer.tags.slice(0, 3).map((tag, idx) => (
                                                                <Badge key={idx} variant="outline" className="text-xs">
                                                                    {tag}
                                                                </Badge>
                                                            ))}
                                                            {customer.tags.length > 3 && (
                                                                <Badge variant="outline" className="text-xs">
                                                                    +{customer.tags.length - 3} more
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        
                                                        {/* QUICK STATS */}
                                                        <div className="hidden md:flex items-center gap-4">
                                                            {customer.stats.totalSales > 0 && (
                                                                <TooltipProvider>
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <div className="text-center">
                                                                                <div className="font-bold text-green-600">{customer.stats.totalSales}</div>
                                                                                <div className="text-xs text-muted-foreground">Sales</div>
                                                                            </div>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent>
                                                                            Total purchases: {customer.stats.totalSales}<br/>
                                                                            Revenue: {formatCurrency(customer.stats.totalRevenue)}
                                                                        </TooltipContent>
                                                                    </Tooltip>
                                                                </TooltipProvider>
                                                            )}
                                                            
                                                            {customer.stats.pendingReviews > 0 && (
                                                                <TooltipProvider>
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <div className="text-center">
                                                                                <div className="font-bold text-amber-600">{customer.stats.pendingReviews}</div>
                                                                                <div className="text-xs text-muted-foreground">Pending</div>
                                                                            </div>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent>
                                                                            Reviews awaiting response
                                                                        </TooltipContent>
                                                                    </Tooltip>
                                                                </TooltipProvider>
                                                            )}
                                                            
                                                            {customer.stats.positiveReviews > 0 && (
                                                                <TooltipProvider>
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <div className="text-center">
                                                                                <div className="font-bold text-emerald-600">{customer.stats.positiveReviews}</div>
                                                                                <div className="text-xs text-muted-foreground">Positive</div>
                                                                            </div>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent>
                                                                            Positive feedback received
                                                                        </TooltipContent>
                                                                    </Tooltip>
                                                                </TooltipProvider>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            {/* EXPANDED INTERACTIONS */}
                                            {expandedCustomers.has(customer.customerId) && (
                                                <div className="border-t p-4 bg-gray-50/50">
                                                    <div className="space-y-3">
                                                        <h4 className="font-semibold text-sm text-muted-foreground flex items-center gap-2">
                                                            <History className="h-4 w-4" /> Interaction History
                                                        </h4>
                                                        
                                                        {customer.interactions
                                                            .sort((a, b) => {
                                                                const dateA = isContactSubmission(a) ? a.submittedAt :
                                                                             isSoldVehicle(a) ? a.dateSold : a.submittedAt;
                                                                const dateB = isContactSubmission(b) ? b.submittedAt :
                                                                             isSoldVehicle(b) ? b.dateSold : b.submittedAt;
                                                                return (dateB?.getTime() || 0) - (dateA?.getTime() || 0);
                                                            })
                                                            .map((interaction, idx) => (
                                                                <div key={`${interaction.type}-${idx}`} 
                                                                     className="flex items-start gap-3 p-3 bg-white rounded-lg border hover:shadow-sm transition-shadow">
                                                                    <div className="pt-1">
                                                                        {getInteractionBadge(interaction.type)}
                                                                    </div>
                                                                    
                                                                    <div className="flex-1">
                                                                        <div className="flex justify-between items-start">
                                                                            <div>
                                                                                {isContactSubmission(interaction) && (
                                                                                    <>
                                                                                        <div className="font-medium">{interaction.subject}</div>
                                                                                        <div className="text-sm text-muted-foreground mt-1">
                                                                                            {interaction.message.substring(0, 100)}...
                                                                                        </div>
                                                                                    </>
                                                                                )}
                                                                                
                                                                                {isSoldVehicle(interaction) && (
                                                                                    <>
                                                                                        <div className="font-medium flex items-center gap-2">
                                                                                            <Car className="h-4 w-4" />
                                                                                            {interaction.year} {interaction.make} {interaction.model}
                                                                                        </div>
                                                                                        <div className="text-sm text-muted-foreground mt-1">
                                                                                            Sold for {formatCurrency(interaction.price)} • {interaction.mileage.toLocaleString()} miles
                                                                                        </div>
                                                                                        {interaction.requestFeedback && (
                                                                                            <div className="mt-2">
                                                                                                {getReviewBadge(interaction)}
                                                                                            </div>
                                                                                        )}
                                                                                    </>
                                                                                )}
                                                                                
                                                                                {isCreditApplication(interaction) && (
                                                                                    <>
                                                                                        <div className="font-medium">Credit Application</div>
                                                                                        <div className="text-sm text-muted-foreground mt-1">
                                                                                            Income: ${interaction.monthlyIncome} • {interaction.hasCoBuyer ? 'With co-buyer' : 'Single applicant'}
                                                                                        </div>
                                                                                    </>
                                                                                )}
                                                                            </div>
                                                                            
                                                                            <div className="text-right">
                                                                                <div className="text-xs text-muted-foreground">
                                                                                    {formatDate(
                                                                                        isContactSubmission(interaction) ? interaction.submittedAt :
                                                                                        isSoldVehicle(interaction) ? interaction.dateSold :
                                                                                        interaction.submittedAt
                                                                                    )}
                                                                                </div>
                                                                                <Button
                                                                                    variant="ghost"
                                                                                    size="sm"
                                                                                    className="mt-2"
                                                                                    onClick={() => handleViewInteraction(interaction)}
                                                                                >
                                                                                    <Eye className="h-3 w-3 mr-1" /> Details
                                                                                </Button>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                    </div>
                                                </div>
                                            )}
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
                
                <TabsContent value="timeline">
                    <Card>
                        <CardHeader>
                            <CardTitle>Timeline View</CardTitle>
                            <CardDescription>All interactions in chronological order</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {isLoading ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="mr-3 h-8 w-8 animate-spin" />
                                    <span>Loading timeline...</span>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {interactions
                                        .sort((a, b) => {
                                            const dateA = isContactSubmission(a) ? a.submittedAt :
                                                         isSoldVehicle(a) ? a.dateSold : a.submittedAt;
                                            const dateB = isContactSubmission(b) ? b.submittedAt :
                                                         isSoldVehicle(b) ? b.dateSold : b.submittedAt;
                                            return (dateB?.getTime() || 0) - (dateA?.getTime() || 0);
                                        })
                                        .map((interaction) => {
                                            const customerGroup = customerGroups.find(g => 
                                                g.interactions.some(i => i.id === interaction.id)
                                            );
                                            
                                            return (
                                                <div key={interaction.id} className="flex items-start gap-4 p-4 border rounded-lg hover:shadow-sm transition-shadow">
                                                    <div className="pt-1">
                                                        {getInteractionBadge(interaction.type)}
                                                    </div>
                                                    
                                                    <div className="flex-1">
                                                        <div className="flex justify-between items-start">
                                                            <div>
                                                                <div className="font-medium">
                                                                    {isContactSubmission(interaction) ? interaction.name :
                                                                     isSoldVehicle(interaction) ? interaction.customerName :
                                                                     `${interaction.firstName} ${interaction.lastName}`}
                                                                </div>
                                                                
                                                                {customerGroup && (
                                                                    <div className="text-xs text-muted-foreground mt-1">
                                                                        {customerGroup.stats.totalSales > 0 ? 
                                                                            `${customerGroup.stats.totalSales} purchase${customerGroup.stats.totalSales !== 1 ? 's' : ''}` : 
                                                                            'New customer'}
                                                                    </div>
                                                                )}
                                                                
                                                                <div className="text-sm mt-2">
                                                                    {isContactSubmission(interaction) && (
                                                                        <span className="text-muted-foreground">"{interaction.message.substring(0, 80)}..."</span>
                                                                    )}
                                                                    {isSoldVehicle(interaction) && (
                                                                        <span className="font-medium">
                                                                            {interaction.year} {interaction.make} {interaction.model} • {formatCurrency(interaction.price)}
                                                                        </span>
                                                                    )}
                                                                    {isCreditApplication(interaction) && (
                                                                        <span className="text-muted-foreground">Financing application submitted</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            
                                                            <div className="text-right">
                                                                <div className="text-xs text-muted-foreground">
                                                                    {formatDate(
                                                                        isContactSubmission(interaction) ? interaction.submittedAt :
                                                                        isSoldVehicle(interaction) ? interaction.dateSold :
                                                                        interaction.submittedAt
                                                                    )}
                                                                </div>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="mt-2"
                                                                    onClick={() => handleViewInteraction(interaction)}
                                                                >
                                                                    <Eye className="h-3 w-3" />
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* INTERACTION DETAIL DIALOG */}
            <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
                <DialogContent className="sm:max-w-[700px]">
                    <DialogHeader>
                        <DialogTitle>Interaction Details</DialogTitle>
                        <DialogDescription>
                            {selectedInteraction && getInteractionBadge(selectedInteraction.type)}
                        </DialogDescription>
                    </DialogHeader>
                    
                    {selectedInteraction && (
                        <div className="space-y-4">
                            {isContactSubmission(selectedInteraction) && (
                                <>
                                    <div><strong>Name:</strong> {selectedInteraction.name}</div>
                                    <div><strong>Phone:</strong> {selectedInteraction.phone}</div>
                                    <div><strong>Subject:</strong> {selectedInteraction.subject}</div>
                                    <div><strong>Message:</strong><br/>{selectedInteraction.message}</div>
                                    <div><strong>Submitted:</strong> {formatDate(selectedInteraction.submittedAt)}</div>
                                </>
                            )}
                            
                            {isSoldVehicle(selectedInteraction) && (
                                <>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><strong>Customer:</strong> {selectedInteraction.customerName}</div>
                                        <div><strong>Phone:</strong> {selectedInteraction.customerPhone}</div>
                                        <div><strong>Vehicle:</strong> {selectedInteraction.year} {selectedInteraction.make} {selectedInteraction.model}</div>
                                        <div><strong>Sale Price:</strong> {formatCurrency(selectedInteraction.price)}</div>
                                    </div>
                                    
                                    {selectedInteraction.requestFeedback && (
                                        <div className="pt-4 border-t">
                                            <h4 className="font-semibold mb-2">Review Status</h4>
                                            <div className="space-y-2">
                                                <div><strong>Requested:</strong> {selectedInteraction.requestFeedback ? 'Yes' : 'No'}</div>
                                                <div><strong>Sent:</strong> {selectedInteraction.feedbackSent ? 'Yes' : 'No'}</div>
                                                {selectedInteraction.feedbackText && (
                                                    <div>
                                                        <strong>Feedback:</strong>
                                                        <div className="mt-1 p-2 bg-gray-50 rounded">{selectedInteraction.feedbackText}</div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                            
                            {isCreditApplication(selectedInteraction) && (
                                <>
                                    <div><strong>Name:</strong> {selectedInteraction.firstName} {selectedInteraction.lastName}</div>
                                    <div><strong>Phone:</strong> {selectedInteraction.mobilePhone}</div>
                                    <div><strong>Monthly Income:</strong> ${selectedInteraction.monthlyIncome}</div>
                                    <div><strong>Co-Buyer:</strong> {selectedInteraction.hasCoBuyer ? 'Yes' : 'No'}</div>
                                </>
                            )}
                        </div>
                    )}
                    
                    <DialogFooter>
                        <Button onClick={() => setIsDetailDialogOpen(false)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* CUSTOMER DETAIL DIALOG */}
            <Dialog open={isCustomerDetailOpen} onOpenChange={setIsCustomerDetailOpen}>
                <DialogContent className="sm:max-w-[800px]">
                    <DialogHeader>
                        <DialogTitle>Customer Profile</DialogTitle>
                        <DialogDescription>
                            Complete interaction history and customer insights
                        </DialogDescription>
                    </DialogHeader>
                    
                    {selectedCustomer && (
                        <div className="space-y-6">
                            {/* CUSTOMER HEADER */}
                            <div className="flex items-start justify-between">
                                <div>
                                    <h3 className="text-2xl font-bold">{selectedCustomer.customerName}</h3>
                                    <div className="flex items-center gap-2 mt-1">
                                        <Phone className="h-4 w-4" />
                                        <span className="font-mono">{selectedCustomer.primaryPhone}</span>
                                    </div>
                                </div>
                                
                                <div className="flex flex-wrap gap-2">
                                    {selectedCustomer.tags.map((tag, idx) => (
                                        <Badge key={idx} variant="secondary">{tag}</Badge>
                                    ))}
                                </div>
                            </div>
                            
                            {/* QUICK STATS */}
                            <div className="grid grid-cols-3 gap-4">
                                <Card>
                                    <CardContent className="p-4 text-center">
                                        <div className="text-2xl font-bold text-green-600">{selectedCustomer.stats.totalSales}</div>
                                        <div className="text-sm text-muted-foreground">Total Purchases</div>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardContent className="p-4 text-center">
                                        <div className="text-2xl font-bold">{formatCurrency(selectedCustomer.stats.totalRevenue)}</div>
                                        <div className="text-sm text-muted-foreground">Total Revenue</div>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardContent className="p-4 text-center">
                                        <div className="text-2xl font-bold">{selectedCustomer.totalInteractions}</div>
                                        <div className="text-sm text-muted-foreground">Total Interactions</div>
                                    </CardContent>
                                </Card>
                            </div>
                            
                            {/* REVIEW STATS */}
                            {selectedCustomer.stats.pendingReviews > 0 || selectedCustomer.stats.positiveReviews > 0 && (
                                <div className="space-y-2">
                                    <h4 className="font-semibold">Review Status</h4>
                                    <div className="flex gap-4">
                                        {selectedCustomer.stats.pendingReviews > 0 && (
                                            <Badge variant="outline" className="bg-amber-50 text-amber-800">
                                                ⏳ {selectedCustomer.stats.pendingReviews} Pending
                                            </Badge>
                                        )}
                                        {selectedCustomer.stats.positiveReviews > 0 && (
                                            <Badge variant="outline" className="bg-emerald-50 text-emerald-800">
                                                ✅ {selectedCustomer.stats.positiveReviews} Positive
                                            </Badge>
                                        )}
                                        {selectedCustomer.stats.negativeReviews > 0 && (
                                            <Badge variant="outline" className="bg-red-50 text-red-800">
                                                ⚠️ {selectedCustomer.stats.negativeReviews} Needs Follow-up
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                            )}
                            
                            {/* VEHICLES PURCHASED */}
                            {selectedCustomer.stats.totalSales > 0 && (
                                <div className="space-y-3">
                                    <h4 className="font-semibold flex items-center gap-2">
                                        <Car className="h-4 w-4" /> Vehicles Purchased
                                    </h4>
                                    <div className="space-y-2">
                                        {selectedCustomer.interactions
                                            .filter(isSoldVehicle)
                                            .map((sale, idx) => (
                                                <div key={idx} className="p-3 border rounded-lg">
                                                    <div className="font-medium">{sale.year} {sale.make} {sale.model}</div>
                                                    <div className="text-sm text-muted-foreground">
                                                        {formatCurrency(sale.price)} • {sale.mileage.toLocaleString()} miles • {formatDate(sale.dateSold)}
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            )}
                            
                            {/* ACTION BUTTONS */}
                            <div className="flex gap-3 pt-4 border-t">
                                <Button variant="outline" className="flex-1" onClick={() => {
                                    navigator.clipboard.writeText(selectedCustomer.primaryPhone);
                                    toast({ title: "Copied!", description: "Phone number copied to clipboard" });
                                }}>
                                    <PhoneCall className="h-4 w-4 mr-2" /> Copy Phone
                                </Button>
                                <Button variant="default" className="flex-1" onClick={() => {
                                    const phone = selectedCustomer.primaryPhone.replace(/\D/g, '');
                                    window.open(`tel:+1${phone}`, '_blank');
                                }}>
                                    <Phone className="h-4 w-4 mr-2" /> Call Customer
                                </Button>
                            </div>
                        </div>
                    )}
                    
                    <DialogFooter>
                        <Button onClick={() => setIsCustomerDetailOpen(false)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Toaster />
        </div>
    );
};