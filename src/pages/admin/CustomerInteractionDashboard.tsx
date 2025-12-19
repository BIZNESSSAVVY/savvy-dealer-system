// src/pages/admin/CustomerInteractionDashboard.tsx
// PRACTICAL DEALER VERSION - Clean, intuitive, with date filtering

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
  PhoneCall, History, TrendingUp, Shield, Award, Target, CalendarDays, FilterX,
  AlertTriangle, ThumbsUp, ThumbsDown, Clock
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

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

// Customer Group Type
interface CustomerGroup {
    customerId: string;
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
    if (!dateValue) return 'Not available';
    const date = safeDateParse(dateValue);
    if (!date) return 'Not available';
    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
};

const formatShortDate = (dateValue: Date | null | undefined): string => {
    if (!dateValue) return '';
    const date = safeDateParse(dateValue);
    if (!date) return '';
    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric'
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

const getDateRangeFilter = (range: string): { start: Date | null; end: Date | null } => {
    const now = new Date();
    const start = new Date();
    
    switch (range) {
        case 'today':
            start.setHours(0, 0, 0, 0);
            return { start, end: now };
        case 'week':
            start.setDate(now.getDate() - 7);
            return { start, end: now };
        case 'month':
            start.setMonth(now.getMonth() - 1);
            return { start, end: now };
        case 'year':
            start.setFullYear(now.getFullYear() - 1);
            return { start, end: now };
        default:
            return { start: null, end: null };
    }
};

// ====================================================================
// MAIN COMPONENT - PRACTICAL DEALER VERSION
// ====================================================================

export const CustomerInteractionDashboard: React.FC = () => {
    const [interactions, setInteractions] = useState<Interaction[]>([]);
    const [customerGroups, setCustomerGroups] = useState<CustomerGroup[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<'all' | 'contact' | 'sale' | 'financing'>('all');
    const [dateRange, setDateRange] = useState<string>('all');
    const [viewMode, setViewMode] = useState<'customers' | 'sales'>('customers');
    const [selectedCustomer, setSelectedCustomer] = useState<CustomerGroup | null>(null);
    const [selectedInteraction, setSelectedInteraction] = useState<Interaction | null>(null);
    const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set());
    const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
    
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
            console.error("Error loading data:", error);
            toast({ 
                title: "Loading Error", 
                description: "Could not load customer data", 
                variant: "destructive" 
            });
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
                    customerName: customerName || 'Customer',
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
                    }
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
        const dateFilter = getDateRangeFilter(dateRange);
        
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(group => 
                group.customerName.toLowerCase().includes(term) ||
                group.primaryPhone.includes(term)
            );
        }
        
        if (filterType !== 'all') {
            filtered = filtered.filter(group => 
                group.interactions.some(i => i.type === filterType)
            );
        }
        
        // Apply date filter for sales view
        if (dateRange !== 'all' && viewMode === 'sales') {
            filtered = filtered.map(group => {
                const filteredInteractions = group.interactions.filter(interaction => {
                    if (!isSoldVehicle(interaction)) return false;
                    if (!interaction.dateSold || !dateFilter.start) return true;
                    return interaction.dateSold >= dateFilter.start;
                });
                
                return {
                    ...group,
                    interactions: filteredInteractions,
                    stats: {
                        ...group.stats,
                        totalSales: filteredInteractions.filter(isSoldVehicle).length,
                        totalRevenue: filteredInteractions
                            .filter(isSoldVehicle)
                            .reduce((sum, sale) => sum + sale.price, 0)
                    }
                };
            }).filter(group => group.stats.totalSales > 0);
        }
        
        return filtered;
    }, [customerGroups, searchTerm, filterType, dateRange, viewMode]);

    // Get sales data for sales view
    const salesData = useMemo(() => {
        return interactions
            .filter(isSoldVehicle)
            .sort((a, b) => (b.dateSold?.getTime() || 0) - (a.dateSold?.getTime() || 0));
    }, [interactions]);

    // Filter sales by date range
    const filteredSales = useMemo(() => {
        if (dateRange === 'all') return salesData;
        
        const dateFilter = getDateRangeFilter(dateRange);
        if (!dateFilter.start) return salesData;
        
        return salesData.filter(sale => {
            if (!sale.dateSold) return false;
            return sale.dateSold >= dateFilter.start!;
        });
    }, [salesData, dateRange]);

    // ====================================================================
    // QUICK STATS
    // ====================================================================

    const quickStats = useMemo(() => {
        const totalSales = filteredSales.length;
        const totalRevenue = filteredSales.reduce((sum, sale) => sum + sale.price, 0);
        const pendingReviews = filteredSales.filter(s => 
            s.requestFeedback && !s.feedbackSubmitted
        ).length;
        const negativeReviews = filteredSales.filter(s => 
            s.feedbackSentiment === 'negative'
        ).length;
        const avgSalePrice = totalSales > 0 ? Math.round(totalRevenue / totalSales) : 0;
        
        return { totalSales, totalRevenue, pendingReviews, negativeReviews, avgSalePrice };
    }, [filteredSales]);

    // ====================================================================
    // INTERACTION HANDLERS
    // ====================================================================

    const handleViewInteraction = (interaction: Interaction) => {
        setSelectedInteraction(interaction);
        setIsDetailDialogOpen(true);
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

    const handleCallCustomer = (phone: string) => {
        const cleanPhone = phone.replace(/\D/g, '');
        window.open(`tel:+1${cleanPhone}`, '_blank');
    };

    // ====================================================================
    // RENDER - CLEAN PRACTICAL UI
    // ====================================================================

    return (
        <div className="container mx-auto p-4 md:p-6 space-y-6">
            {/* HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2">
                        <Users className="w-6 h-6" /> Customer & Sales Dashboard
                    </h1>
                    <p className="text-gray-600 mt-1 text-sm">
                        Track customer interactions and sales performance
                    </p>
                </div>
                
                <Button variant="outline" size="sm" onClick={() => fetchInteractions()} className="gap-2">
                    <History className="w-4 h-4" /> Refresh
                </Button>
            </div>

            {/* SALES PERFORMANCE CARDS */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <Card className="border border-gray-200 shadow-sm">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Sales This Period</p>
                                <p className="text-xl font-bold text-gray-900">{quickStats.totalSales}</p>
                            </div>
                            <Car className="w-5 h-5 text-blue-600 opacity-80" />
                        </div>
                    </CardContent>
                </Card>
                
                <Card className="border border-gray-200 shadow-sm">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Revenue</p>
                                <p className="text-xl font-bold text-green-700">{formatCurrency(quickStats.totalRevenue)}</p>
                            </div>
                            <DollarSign className="w-5 h-5 text-green-600 opacity-80" />
                        </div>
                    </CardContent>
                </Card>
                
                <Card className={`border ${quickStats.pendingReviews > 0 ? 'border-amber-300 bg-amber-50' : 'border-gray-200'} shadow-sm`}>
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Pending Reviews</p>
                                <p className={`text-xl font-bold ${quickStats.pendingReviews > 0 ? 'text-amber-700' : 'text-gray-900'}`}>
                                    {quickStats.pendingReviews}
                                </p>
                            </div>
                            {quickStats.pendingReviews > 0 ? (
                                <AlertTriangle className="w-5 h-5 text-amber-600 animate-pulse" />
                            ) : (
                                <CheckCircle2 className="w-5 h-5 text-green-600" />
                            )}
                        </div>
                    </CardContent>
                </Card>
                
                <Card className={`border ${quickStats.negativeReviews > 0 ? 'border-red-300 bg-red-50' : 'border-gray-200'} shadow-sm`}>
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Needs Follow-up</p>
                                <p className={`text-xl font-bold ${quickStats.negativeReviews > 0 ? 'text-red-700' : 'text-gray-900'}`}>
                                    {quickStats.negativeReviews}
                                </p>
                            </div>
                            {quickStats.negativeReviews > 0 ? (
                                <AlertTriangle className="w-5 h-5 text-red-600 animate-pulse" />
                            ) : (
                                <ThumbsUp className="w-5 h-5 text-green-600" />
                            )}
                        </div>
                    </CardContent>
                </Card>
                
                <Card className="border border-gray-200 shadow-sm">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Avg Sale Price</p>
                                <p className="text-xl font-bold text-gray-900">{formatCurrency(quickStats.avgSalePrice)}</p>
                            </div>
                            <TrendingUp className="w-5 h-5 text-blue-600 opacity-80" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* FILTER BAR */}
            <Card className="border border-gray-200 shadow-sm">
                <CardContent className="p-4">
                    <div className="flex flex-col md:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                                placeholder="Search by name or phone..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 border-gray-300"
                            />
                        </div>
                        
                        <div className="flex gap-2">
                            <Select value={viewMode} onValueChange={(v: any) => setViewMode(v)}>
                                <SelectTrigger className="w-[140px] border-gray-300">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="customers">By Customer</SelectItem>
                                    <SelectItem value="sales">Sales List</SelectItem>
                                </SelectContent>
                            </Select>
                            
                            <Select value={filterType} onValueChange={(v: any) => setFilterType(v)}>
                                <SelectTrigger className="w-[140px] border-gray-300">
                                    <Filter className="h-4 w-4 mr-2" />
                                    <SelectValue placeholder="Type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Types</SelectItem>
                                    <SelectItem value="contact">Contacts</SelectItem>
                                    <SelectItem value="sale">Sales</SelectItem>
                                    <SelectItem value="financing">Financing</SelectItem>
                                </SelectContent>
                            </Select>
                            
                            <Select value={dateRange} onValueChange={setDateRange}>
                                <SelectTrigger className="w-[140px] border-gray-300">
                                    <CalendarDays className="h-4 w-4 mr-2" />
                                    <SelectValue placeholder="Date Range" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Time</SelectItem>
                                    <SelectItem value="today">Today</SelectItem>
                                    <SelectItem value="week">Last 7 Days</SelectItem>
                                    <SelectItem value="month">Last 30 Days</SelectItem>
                                    <SelectItem value="year">Last Year</SelectItem>
                                </SelectContent>
                            </Select>
                            
                            {(searchTerm || filterType !== 'all' || dateRange !== 'all') && (
                                <Button 
                                    variant="ghost" 
                                    size="icon"
                                    onClick={() => {
                                        setSearchTerm('');
                                        setFilterType('all');
                                        setDateRange('all');
                                    }}
                                    className="border border-gray-300"
                                >
                                    <FilterX className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* MAIN CONTENT */}
            {viewMode === 'customers' ? (
                <Card className="border border-gray-200 shadow-sm">
                    <CardHeader className="border-b border-gray-100">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-lg font-semibold text-gray-900">Customers</CardTitle>
                                <CardDescription className="text-gray-600">
                                    {filteredCustomerGroups.length} customers found
                                    {dateRange !== 'all' && ` • Showing ${dateRange} sales`}
                                </CardDescription>
                            </div>
                            <Badge variant="outline" className="text-gray-700">
                                {interactions.length} total interactions
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-16">
                                <Loader2 className="mr-3 h-6 w-6 animate-spin text-gray-400" />
                                <span className="text-gray-600">Loading customer data...</span>
                            </div>
                        ) : filteredCustomerGroups.length === 0 ? (
                            <div className="text-center py-16 text-gray-500">
                                <Users className="w-12 h-12 mx-auto mb-4 opacity-40" />
                                <p className="text-lg">No customers found</p>
                                <p className="text-sm mt-2">Try adjusting your search filters</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-100">
                                {filteredCustomerGroups.map((customer) => (
                                    <div key={customer.customerId} className="hover:bg-gray-50 transition-colors">
                                        {/* CUSTOMER HEADER */}
                                        <div 
                                            className="p-4 cursor-pointer"
                                            onClick={() => toggleCustomerExpand(customer.customerId)}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className="h-8 w-8 hover:bg-gray-200"
                                                    >
                                                        {expandedCustomers.has(customer.customerId) ? 
                                                            <ChevronUp className="h-4 w-4 text-gray-600" /> : 
                                                            <ChevronDown className="h-4 w-4 text-gray-600" />
                                                        }
                                                    </Button>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <User className="h-4 w-4 text-gray-500" />
                                                            <h3 className="font-semibold text-gray-900">{customer.customerName}</h3>
                                                            {customer.stats.totalSales > 1 && (
                                                                <Badge className="bg-blue-100 text-blue-800 text-xs">
                                                                    Repeat Buyer
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-3 mt-1">
                                                            <div className="flex items-center gap-1 text-sm text-gray-600">
                                                                <Phone className="h-3 w-3" />
                                                                {customer.primaryPhone}
                                                            </div>
                                                            <div className="text-sm text-gray-500">
                                                                • {customer.totalInteractions} interaction{customer.totalInteractions !== 1 ? 's' : ''}
                                                            </div>
                                                            {customer.lastActivity && (
                                                                <div className="text-sm text-gray-500">
                                                                    • Last activity: {formatShortDate(customer.lastActivity)}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                <div className="flex items-center gap-4">
                                                    {/* CUSTOMER STATS */}
                                                    <div className="hidden md:flex items-center gap-6">
                                                        {customer.stats.totalSales > 0 && (
                                                            <div className="text-center">
                                                                <div className="font-semibold text-green-700">{customer.stats.totalSales}</div>
                                                                <div className="text-xs text-gray-600">purchases</div>
                                                            </div>
                                                        )}
                                                        
                                                        {customer.stats.pendingReviews > 0 && (
                                                            <div className="text-center">
                                                                <div className="font-semibold text-amber-700">{customer.stats.pendingReviews}</div>
                                                                <div className="text-xs text-gray-600">pending</div>
                                                            </div>
                                                        )}
                                                        
                                                        {customer.stats.negativeReviews > 0 && (
                                                            <div className="text-center">
                                                                <div className="font-semibold text-red-700">{customer.stats.negativeReviews}</div>
                                                                <div className="text-xs text-gray-600">needs follow-up</div>
                                                            </div>
                                                        )}
                                                    </div>
                                                    
                                                    <Button 
                                                        size="sm" 
                                                        variant="ghost"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleCallCustomer(customer.primaryPhone);
                                                        }}
                                                        className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                                                    >
                                                        <PhoneCall className="h-4 w-4 mr-1" /> Call
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        {/* EXPANDED INTERACTIONS */}
                                        {expandedCustomers.has(customer.customerId) && (
                                            <div className="px-4 pb-4 bg-gray-50 border-t border-gray-100">
                                                <div className="pt-4">
                                                    <h4 className="font-medium text-gray-700 mb-3">Customer History</h4>
                                                    <div className="space-y-2">
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
                                                                     className="flex items-start gap-3 p-3 bg-white rounded border border-gray-200 hover:border-gray-300 transition-colors">
                                                                    <div className="pt-1">
                                                                        {interaction.type === 'contact' && (
                                                                            <MessageCircle className="h-4 w-4 text-blue-600" />
                                                                        )}
                                                                        {interaction.type === 'sale' && (
                                                                            <Car className="h-4 w-4 text-green-600" />
                                                                        )}
                                                                        {interaction.type === 'financing' && (
                                                                            <FileText className="h-4 w-4 text-purple-600" />
                                                                        )}
                                                                    </div>
                                                                    
                                                                    <div className="flex-1">
                                                                        <div className="flex justify-between items-start">
                                                                            <div>
                                                                                {isContactSubmission(interaction) && (
                                                                                    <>
                                                                                        <div className="font-medium text-gray-900">Contact: {interaction.subject}</div>
                                                                                        <div className="text-sm text-gray-600 mt-1">
                                                                                            {interaction.message.substring(0, 80)}...
                                                                                        </div>
                                                                                    </>
                                                                                )}
                                                                                
                                                                                {isSoldVehicle(interaction) && (
                                                                                    <>
                                                                                        <div className="font-medium text-gray-900">
                                                                                            {interaction.year} {interaction.make} {interaction.model}
                                                                                        </div>
                                                                                        <div className="text-sm text-gray-600 mt-1">
                                                                                            Sold for {formatCurrency(interaction.price)} • {formatShortDate(interaction.dateSold)}
                                                                                        </div>
                                                                                        {interaction.requestFeedback && !interaction.feedbackSubmitted && (
                                                                                            <div className="inline-flex items-center gap-1 mt-2 px-2 py-1 bg-amber-100 text-amber-800 rounded text-xs">
                                                                                                <Clock className="h-3 w-3" /> Review pending
                                                                                            </div>
                                                                                        )}
                                                                                        {interaction.feedbackSentiment === 'negative' && (
                                                                                            <div className="inline-flex items-center gap-1 mt-2 px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-medium">
                                                                                                <AlertTriangle className="h-3 w-3" /> Needs immediate follow-up
                                                                                            </div>
                                                                                        )}
                                                                                        {interaction.feedbackSentiment === 'positive' && (
                                                                                            <div className="inline-flex items-center gap-1 mt-2 px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                                                                                                <ThumbsUp className="h-3 w-3" /> Positive review
                                                                                            </div>
                                                                                        )}
                                                                                    </>
                                                                                )}
                                                                                
                                                                                {isCreditApplication(interaction) && (
                                                                                    <>
                                                                                        <div className="font-medium text-gray-900">Credit Application</div>
                                                                                        <div className="text-sm text-gray-600 mt-1">
                                                                                            ${interaction.monthlyIncome}/month • {interaction.hasCoBuyer ? 'With co-buyer' : 'Single'}
                                                                                        </div>
                                                                                    </>
                                                                                )}
                                                                            </div>
                                                                            
                                                                            <div className="text-right">
                                                                                <div className="text-xs text-gray-500">
                                                                                    {formatDate(
                                                                                        isContactSubmission(interaction) ? interaction.submittedAt :
                                                                                        isSoldVehicle(interaction) ? interaction.dateSold :
                                                                                        interaction.submittedAt
                                                                                    )}
                                                                                </div>
                                                                                <Button
                                                                                    variant="ghost"
                                                                                    size="sm"
                                                                                    className="mt-2 text-gray-600 hover:text-gray-900"
                                                                                    onClick={() => handleViewInteraction(interaction)}
                                                                                >
                                                                                    <Eye className="h-3 w-3 mr-1" /> View
                                                                                </Button>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            ) : (
                <Card className="border border-gray-200 shadow-sm">
                    <CardHeader className="border-b border-gray-100">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-lg font-semibold text-gray-900">Sales List</CardTitle>
                                <CardDescription className="text-gray-600">
                                    {filteredSales.length} sales • {formatCurrency(quickStats.totalRevenue)} revenue
                                    {dateRange !== 'all' && ` • ${dateRange}`}
                                </CardDescription>
                            </div>
                            <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-gray-700">
                                    {quickStats.pendingReviews > 0 ? `${quickStats.pendingReviews} pending reviews` : 'All reviews complete'}
                                </Badge>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-16">
                                <Loader2 className="mr-3 h-6 w-6 animate-spin text-gray-400" />
                                <span className="text-gray-600">Loading sales data...</span>
                            </div>
                        ) : filteredSales.length === 0 ? (
                            <div className="text-center py-16 text-gray-500">
                                <Car className="w-12 h-12 mx-auto mb-4 opacity-40" />
                                <p className="text-lg">No sales found</p>
                                <p className="text-sm mt-2">Try adjusting your date range</p>
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-gray-50 hover:bg-gray-50">
                                        <TableHead className="text-gray-700 font-semibold">Date</TableHead>
                                        <TableHead className="text-gray-700 font-semibold">Customer</TableHead>
                                        <TableHead className="text-gray-700 font-semibold">Vehicle</TableHead>
                                        <TableHead className="text-gray-700 font-semibold">Price</TableHead>
                                        <TableHead className="text-gray-700 font-semibold">Review Status</TableHead>
                                        <TableHead className="text-gray-700 font-semibold text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredSales.map((sale) => (
                                        <TableRow 
                                            key={sale.id} 
                                            className={`hover:bg-gray-50 ${
                                                sale.feedbackSentiment === 'negative' ? 'bg-red-50 hover:bg-red-100' : ''
                                            }`}
                                        >
                                            <TableCell className="font-medium">
                                                <div className="text-gray-900">{formatShortDate(sale.dateSold)}</div>
                                                {sale.dateSold && (
                                                    <div className="text-xs text-gray-500">
                                                        {sale.dateSold.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <div className="font-medium text-gray-900">{sale.customerName}</div>
                                                <div className="text-sm text-gray-600">{sale.customerPhone}</div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="font-medium text-gray-900">
                                                    {sale.year} {sale.make} {sale.model}
                                                </div>
                                                <div className="text-sm text-gray-600">
                                                    {sale.vin?.slice(-6)}
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-semibold text-green-700">
                                                {formatCurrency(sale.price)}
                                            </TableCell>
                                            <TableCell>
                                                {!sale.requestFeedback ? (
                                                    <div className="text-gray-500 text-sm">Not requested</div>
                                                ) : !sale.feedbackSubmitted ? (
                                                    <div className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-800 rounded-full text-sm font-medium">
                                                        <Clock className="h-3 w-3" /> Pending
                                                    </div>
                                                ) : sale.feedbackSentiment === 'negative' ? (
                                                    <div className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium animate-pulse">
                                                        <AlertTriangle className="h-3 w-3" /> NEEDS FOLLOW-UP
                                                    </div>
                                                ) : sale.feedbackSentiment === 'positive' ? (
                                                    <div className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                                                        <ThumbsUp className="h-3 w-3" /> Positive
                                                    </div>
                                                ) : (
                                                    <div className="text-gray-600 text-sm">Submitted</div>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-gray-600 hover:text-gray-900"
                                                        onClick={() => handleViewInteraction(sale)}
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => handleCallCustomer(sale.customerPhone)}
                                                        className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                                                    >
                                                        <PhoneCall className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* INTERACTION DETAIL DIALOG */}
            <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle className="text-gray-900">Interaction Details</DialogTitle>
                    </DialogHeader>
                    
                    {selectedInteraction && (
                        <div className="space-y-4">
                            {isContactSubmission(selectedInteraction) && (
                                <>
                                    <div className="space-y-2">
                                        <div><strong className="text-gray-700">Name:</strong> {selectedInteraction.name}</div>
                                        <div><strong className="text-gray-700">Phone:</strong> {selectedInteraction.phone}</div>
                                        <div><strong className="text-gray-700">Subject:</strong> {selectedInteraction.subject}</div>
                                        <div><strong className="text-gray-700">Message:</strong></div>
                                        <div className="p-3 bg-gray-50 rounded border border-gray-200">
                                            {selectedInteraction.message}
                                        </div>
                                        <div><strong className="text-gray-700">Submitted:</strong> {formatDate(selectedInteraction.submittedAt)}</div>
                                    </div>
                                </>
                            )}
                            
                            {isSoldVehicle(selectedInteraction) && (
                                <>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><strong className="text-gray-700">Customer:</strong> {selectedInteraction.customerName}</div>
                                        <div><strong className="text-gray-700">Phone:</strong> {selectedInteraction.customerPhone}</div>
                                        <div><strong className="text-gray-700">Vehicle:</strong> {selectedInteraction.year} {selectedInteraction.make} {selectedInteraction.model}</div>
                                        <div><strong className="text-gray-700">VIN:</strong> {selectedInteraction.vin}</div>
                                        <div><strong className="text-gray-700">Price:</strong> {formatCurrency(selectedInteraction.price)}</div>
                                        <div><strong className="text-gray-700">Date:</strong> {formatDate(selectedInteraction.dateSold)}</div>
                                    </div>
                                    
                                    {selectedInteraction.requestFeedback && (
                                        <div className="pt-4 border-t border-gray-200">
                                            <h4 className="font-semibold text-gray-900 mb-3">Review Status</h4>
                                            <div className="space-y-3">
                                                <div><strong className="text-gray-700">Review requested:</strong> Yes</div>
                                                <div><strong className="text-gray-700">Sent to customer:</strong> {selectedInteraction.feedbackSent ? 'Yes' : 'No'}</div>
                                                {selectedInteraction.feedbackSentAt && (
                                                    <div><strong className="text-gray-700">Sent on:</strong> {formatDate(selectedInteraction.feedbackSentAt)}</div>
                                                )}
                                                {selectedInteraction.feedbackText && (
                                                    <div>
                                                        <strong className="text-gray-700">Customer feedback:</strong>
                                                        <div className="mt-1 p-3 bg-gray-50 rounded border border-gray-200">
                                                            {selectedInteraction.feedbackText}
                                                        </div>
                                                    </div>
                                                )}
                                                {selectedInteraction.feedbackSentiment === 'negative' && (
                                                    <Alert className="bg-red-50 border-red-200">
                                                        <AlertTriangle className="h-4 w-4 text-red-600" />
                                                        <AlertDescription className="text-red-800 font-medium">
                                                            Customer needs immediate follow-up. Manager has been alerted.
                                                        </AlertDescription>
                                                    </Alert>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                            
                            {isCreditApplication(selectedInteraction) && (
                                <>
                                    <div className="space-y-2">
                                        <div><strong className="text-gray-700">Name:</strong> {selectedInteraction.firstName} {selectedInteraction.lastName}</div>
                                        <div><strong className="text-gray-700">Phone:</strong> {selectedInteraction.mobilePhone}</div>
                                        <div><strong className="text-gray-700">Vehicle:</strong> {selectedInteraction.vehicleToFinance || 'Not specified'}</div>
                                        <div><strong className="text-gray-700">Monthly Income:</strong> ${selectedInteraction.monthlyIncome}</div>
                                        <div><strong className="text-gray-700">Co-Buyer:</strong> {selectedInteraction.hasCoBuyer ? 'Yes' : 'No'}</div>
                                        <div><strong className="text-gray-700">Submitted:</strong> {formatDate(selectedInteraction.submittedAt)}</div>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                    
                    <DialogFooter>
                        {selectedInteraction && 'customerPhone' in selectedInteraction && (
                            <Button 
                                onClick={() => {
                                    if ('customerPhone' in selectedInteraction) {
                                        handleCallCustomer(selectedInteraction.customerPhone);
                                    }
                                }}
                                className="bg-blue-600 hover:bg-blue-700"
                            >
                                <PhoneCall className="h-4 w-4 mr-2" /> Call Customer
                            </Button>
                        )}
                        <Button 
                            variant="outline" 
                            onClick={() => setIsDetailDialogOpen(false)}
                        >
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Toaster />
        </div>
    );
};