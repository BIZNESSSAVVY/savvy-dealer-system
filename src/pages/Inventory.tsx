// src/pages/Inventory.tsx

import { Component, ReactNode, useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Search, Filter, Grid, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import VehicleCard from "@/components/VehicleCard";
import { Vehicle } from "@/types/vehicle";
import { db } from "@/firebaseConfig";
import { collection, onSnapshot, query, orderBy, CollectionReference } from "firebase/firestore";

type VehicleData = Omit<Vehicle, 'id'>;

const vehiclesCollectionRef = collection(db, "vehicles") as CollectionReference<VehicleData>;

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: string | null }> {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error: error.message || "Unknown error" };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="text-center py-16 text-red-500">
          <h3 className="text-xl font-semibold mb-2">Error loading inventory</h3>
          <p>{this.state.error}</p>
          <p className="text-muted-foreground">Please check the console for details or try again later.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

const Inventory = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState(searchParams.get("model") || "");
  const [makeFilter, setMakeFilter] = useState(searchParams.get("make") || "all");
  const [priceFilter, setPriceFilter] = useState(searchParams.get("maxPrice") || "any");
  const [sortBy, setSortBy] = useState("newest");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  useEffect(() => {
    setLoading(true);
    setError(null);
    
    const q = query(vehiclesCollectionRef, orderBy("year", "desc"));

    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const vehicleList: Vehicle[] = snapshot.docs.map(doc => {
          const data = doc.data() as VehicleData;
          return {
            id: doc.id,
            ...data,
            images: data.images || [],
            stockNumber: data.stockNumber || undefined,
            description: data.description || '',
            bodyStyle: data.bodyStyle || 'Sedan',
            condition: data.condition || 'Used',
            features: data.features || [],
            options: data.options || [],
          } as Vehicle;
        });
        
        setVehicles(vehicleList);
        setLoading(false);
      }, 
      (err) => {
        console.error("Firestore fetch error:", err);
        setError("Failed to load vehicle inventory. Check network and Firestore rules.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const makes = Array.from(new Set(vehicles.map((v) => v.make))).sort();

  const handleViewDetails = (id: string) => {
    navigate(`/vehicle/${id}`);
  };

  const handleScheduleTest = (id: string) => {
    navigate(`/vehicle/${id}#contact-form`);
  };

  const updateSearchParams = (newSearchTerm: string, newMakeFilter: string, newPriceFilter: string) => {
    const params = new URLSearchParams();
    if (newSearchTerm) params.set("model", newSearchTerm);
    if (newMakeFilter !== "all") params.set("make", newMakeFilter);
    if (newPriceFilter !== "any") params.set("maxPrice", newPriceFilter);
    setSearchParams(params, { replace: true });
  };

  const filteredVehicles = vehicles.filter((vehicle) => {
    const matchesSearch =
      searchTerm === "" ||
      `${vehicle.make} ${vehicle.model} ${vehicle.year} ${vehicle.description || ''} ${vehicle.stockNumber || ''}`
        .toLowerCase()
        .includes(searchTerm.toLowerCase());

    const matchesMake = makeFilter === "all" || vehicle.make.toLowerCase() === makeFilter.toLowerCase();

    const matchesPrice =
      priceFilter === "any" ||
      (priceFilter === "10000" && vehicle.price <= 10000) ||
      (priceFilter === "15000" && vehicle.price <= 15000) ||
      (priceFilter === "20000" && vehicle.price <= 20000) ||
      (priceFilter === "25000" && vehicle.price <= 25000) ||
      (priceFilter === "30000" && vehicle.price <= 30000) ||
      (priceFilter === "35000" && vehicle.price <= 35000);

    return matchesSearch && matchesMake && matchesPrice;
  });

  const sortedVehicles = [...filteredVehicles].sort((a, b) => {
    switch (sortBy) {
      case "price-low":
        return a.price - b.price;
      case "price-high":
        return b.price - a.price;
      case "mileage":
        return a.mileage - b.mileage;
      case "year":
        return b.year - a.year;
      case "newest":
        return (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0) || b.year - a.year;
      default:
        return 0;
    }
  });

  if (loading) {
    return (
      <div className="min-h-screen py-8 px-4 text-center">
        <h3 className="text-xl font-semibold text-primary">Loading Inventory... 🚗💨</h3>
        <p className="text-muted-foreground">Fetching latest vehicle data from Firestore.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen py-8 px-4 text-center text-red-500">
        <h3 className="text-xl font-semibold mb-2">Inventory Loading Error</h3>
        <p className="mb-4">{error}</p>
        <p className="text-muted-foreground">Please ensure your Firebase connection and security rules are configured correctly.</p>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8 bg-background">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Our Vehicle Inventory
            </h1>
            <p className="text-lg text-muted-foreground">
              Browse our selection of quality pre-owned vehicles
            </p>
          </div>

          <Card className="mb-8 bg-white shadow-xl border-4 border-primary">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-600" />
                  <Input
                    placeholder="Search vehicles..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      updateSearchParams(e.target.value, makeFilter, priceFilter);
                    }}
                    className="pl-10 bg-white border-2 border-slate-300 text-slate-900 font-medium hover:border-primary focus:border-primary"
                  />
                </div>
                <Select
                  value={makeFilter}
                  onValueChange={(value) => {
                    setMakeFilter(value);
                    updateSearchParams(searchTerm, value, priceFilter);
                  }}
                >
                  <SelectTrigger className="bg-white border-2 border-slate-300 text-slate-900 font-medium hover:border-primary focus:border-primary focus:ring-2 focus:ring-primary/20">
                    <SelectValue placeholder="Make" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Makes</SelectItem>
                    {makes.map((make) => (
                      <SelectItem key={make} value={make.toLowerCase()}>
                        {make}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={priceFilter}
                  onValueChange={(value) => {
                    setPriceFilter(value);
                    updateSearchParams(searchTerm, makeFilter, value);
                  }}
                >
                  <SelectTrigger className="bg-white border-2 border-slate-300 text-slate-900 font-medium hover:border-primary focus:border-primary focus:ring-2 focus:ring-primary/20">
                    <SelectValue placeholder="Max Price" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any Price</SelectItem>
                    <SelectItem value="10000">Under $10,000</SelectItem>
                    <SelectItem value="15000">Under $15,000</SelectItem>
                    <SelectItem value="20000">Under $20,000</SelectItem>
                    <SelectItem value="25000">Under $25,000</SelectItem>
                    <SelectItem value="30000">Under $30,000</SelectItem>
                    <SelectItem value="35000">Under $35,000</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="bg-white border-2 border-slate-300 text-slate-900 font-medium hover:border-primary focus:border-primary focus:ring-2 focus:ring-primary/20">
                    <SelectValue placeholder="Sort By" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest First</SelectItem>
                    <SelectItem value="price-low">Price: Low to High</SelectItem>
                    <SelectItem value="price-high">Price: High to Low</SelectItem>
                    <SelectItem value="mileage">Lowest Mileage</SelectItem>
                    <SelectItem value="year">Newest Year</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Button
                    variant={viewMode === "grid" ? "default" : "outline"}
                    size="icon"
                    onClick={() => setViewMode("grid")}
                  >
                    <Grid className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === "list" ? "default" : "outline"}
                    size="icon"
                    onClick={() => setViewMode("list")}
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">
                  Showing {sortedVehicles.length} of {vehicles.length} vehicles
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchTerm("");
                    setMakeFilter("all");
                    setPriceFilter("any");
                    setSearchParams({});
                  }}
                >
                  <Filter className="h-4 w-4 mr-2" />
                  Clear Filters
                </Button>
              </div>
            </CardContent>
          </Card>

          <div
            className={`grid gap-6 ${
              viewMode === "grid"
                ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
                : "grid-cols-1"
            }`}
          >
            {sortedVehicles.length > 0 ? (
              sortedVehicles.map((vehicle) => (
                <VehicleCard
                  key={vehicle.id}
                  vehicle={vehicle}
                  onViewDetails={handleViewDetails}
                  onScheduleTest={handleScheduleTest}
                />
              ))
            ) : (
              <div className="col-span-full text-center py-16">
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  No vehicles found
                </h3>
                <p className="text-muted-foreground mb-4">
                  Try adjusting your filters or search terms
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchTerm("");
                    setMakeFilter("all");
                    setPriceFilter("any");
                    setSearchParams({});
                  }}
                >
                  Clear Filters
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default Inventory;