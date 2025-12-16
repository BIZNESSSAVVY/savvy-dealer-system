import { useState, useEffect } from "react";
import { Search, Star, Shield, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import heroBackground from "@/assets/hero-bg.png";
import { db } from "@/firebaseConfig";
import { collection, onSnapshot, query, CollectionReference } from "firebase/firestore";
import { Vehicle } from "@/types/vehicle";

type VehicleData = Omit<Vehicle, 'id'>;
const vehiclesCollectionRef = collection(db, "vehicles") as CollectionReference<VehicleData>;

const Hero = () => {
  const navigate = useNavigate();
  const [searchMake, setSearchMake] = useState("");
  const [searchModel, setSearchModel] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [makes, setMakes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(vehiclesCollectionRef);
    
    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const vehicleList = snapshot.docs.map(doc => doc.data() as VehicleData);
        const uniqueMakes = Array.from(new Set(vehicleList.map(v => v.make))).sort();
        setMakes(uniqueMakes);
        setLoading(false);
      }, 
      (err) => {
        console.error("Error fetching makes:", err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleSearch = () => {
    const searchParams = new URLSearchParams();
    if (searchMake) searchParams.set("make", searchMake);
    if (searchModel) searchParams.set("model", searchModel);
    if (maxPrice) searchParams.set("maxPrice", maxPrice);
    navigate(`/inventory?${searchParams.toString()}`);
  };

  return (
    <section className="relative min-h-[70vh] flex items-center justify-center overflow-hidden">
      {/* Background Image */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${heroBackground})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-primary/90 via-primary/70 to-primary/50"></div>
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center pt-8">
        <div className="animate-fade-in">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
            Experience the{" "}
            <span className="text-automotive-gold">Future of Automotive Retail</span>
          </h1>
          <p className="text-xl md:text-2xl text-white/90 mb-8 max-w-3xl mx-auto">
            A complete demo platform showcasing intelligent inventory management, 
            transparent pricing, and streamlined customer experiences.
          </p>

          {/* Search Bar */}
          <div className="bg-white/95 backdrop-blur-sm rounded-xl p-6 shadow-premium max-w-4xl mx-auto mb-8 animate-slide-up">
            <h3 className="text-lg font-semibold text-primary mb-4">
              Explore the Demo Inventory
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Select value={searchMake} onValueChange={setSearchMake} disabled={loading}>
                <SelectTrigger className="bg-white border-2 border-slate-300 text-slate-900 font-medium hover:border-primary focus:border-primary focus:ring-2 focus:ring-primary/20">
                  <SelectValue placeholder={loading ? "Loading..." : "Make"} />
                </SelectTrigger>
                <SelectContent>
                  {makes.map((make) => (
                    <SelectItem key={make} value={make.toLowerCase()}>
                      {make}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                placeholder="Model"
                value={searchModel}
                onChange={(e) => setSearchModel(e.target.value)}
                className="bg-white border-2 border-slate-300 text-slate-900 font-medium hover:border-primary focus:border-primary"
              />

              <Select value={maxPrice} onValueChange={setMaxPrice}>
                <SelectTrigger className="bg-white border-2 border-slate-300 text-slate-900 font-medium hover:border-primary focus:border-primary focus:ring-2 focus:ring-primary/20">
                  <SelectValue placeholder="Max Price" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10000">Under $10,000</SelectItem>
                  <SelectItem value="15000">Under $15,000</SelectItem>
                  <SelectItem value="20000">Under $20,000</SelectItem>
                  <SelectItem value="25000">Under $25,000</SelectItem>
                  <SelectItem value="30000">Under $30,000</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="hero"
                size="lg"
                className="w-full"
                onClick={handleSearch}
              >
                <Search className="h-5 w-5 mr-2" />
                Search Vehicles
              </Button>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
            <Button
              variant="hero"
              size="lg"
              className="text-lg px-8"
              onClick={() => navigate("/inventory")}
            >
              View Demo Inventory
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="text-lg px-8 bg-white/10 border-white text-white hover:bg-white hover:text-primary"
              onClick={() => navigate("/contact")}
            >
              Request Platform Demo
            </Button>
          </div>

          {/* Trust Indicators */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="flex flex-col items-center text-white animate-scale-in">
              <div className="bg-white/20 p-4 rounded-full mb-4">
                <DollarSign className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-semibold mb-2">
                Transparent Pricing
              </h3>
              <p className="text-white/80 text-sm">
                Clear, upfront pricing with no hidden fees or surprises
              </p>
            </div>

            <div className="flex flex-col items-center text-white animate-scale-in">
              <div className="bg-white/20 p-4 rounded-full mb-4">
                <Shield className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Smart Financing</h3>
              <p className="text-white/80 text-sm">
                Integrated tools for fast approvals and flexible terms
              </p>
            </div>

            <div className="flex flex-col items-center text-white animate-scale-in">
              <div className="bg-white/20 p-4 rounded-full mb-4">
                <Star className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-semibold mb-2">
                Dealer-First Platform
              </h3>
              <p className="text-white/80 text-sm">
                Technology built to empower modern dealerships
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;