// src/pages/Index.tsx

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Hero from "@/components/Hero";
import DealershipHighlight from "@/components/DealershipHighlight";
import VehicleCard, { Vehicle } from "@/components/VehicleCard";
import { Button } from "@/components/ui/button";
import { ArrowRight, Star, Users, Clock } from "lucide-react";

// 🎯 Firestore Imports
import { db } from "@/firebaseConfig";
import { collection, query, orderBy, limit, onSnapshot, CollectionReference } from "firebase/firestore";

type VehicleData = Omit<Vehicle, 'id'>;
const vehiclesCollectionRef = collection(db, "vehicles") as CollectionReference<VehicleData>;

const Index = () => {
  const navigate = useNavigate();
  const [featuredVehicles, setFeaturedVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  // 🎯 Fetch 3 vehicles from Firestore
  useEffect(() => {
    const q = query(
      vehiclesCollectionRef, 
      orderBy("year", "desc"), 
      limit(3)
    );

    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const vehicleList: Vehicle[] = snapshot.docs.map(doc => {
          const data = doc.data() as VehicleData;
          return {
            id: doc.id,
            ...data,
            images: data.images || [],
            stockNumber: data.stockNumber || undefined, // 🎯 Include stock number
          } as Vehicle;
        });
        
        setFeaturedVehicles(vehicleList);
        setLoading(false);
      }, 
      (err) => {
        console.error("Error fetching featured vehicles:", err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleViewDetails = (id: string) => {
    navigate(`/vehicle/${id}`);
  };

  const handleScheduleTest = (id: string) => {
    navigate(`/vehicle/${id}#contact-form`);
  };

  return (
    <div>
      <Hero />
      
      {/* 🎯 NEW: DealershipHighlight Section - Right after Hero */}
      <DealershipHighlight />
      
      {/* Featured Vehicles Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Demo Vehicle Showcase
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Live demo vehicles showcasing the platform's real-time inventory management
            </p>
          </div>
          
          {loading ? (
            <div className="text-center py-12">
              <p className="text-lg text-muted-foreground">Loading demo vehicles...</p>
            </div>
          ) : featuredVehicles.length > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
                {featuredVehicles.map((vehicle) => (
                  <VehicleCard
                    key={vehicle.id}
                    vehicle={vehicle}
                    onViewDetails={handleViewDetails}
                    onScheduleTest={handleScheduleTest}
                  />
                ))}
              </div>
              
              <div className="text-center">
                <Button 
                  variant="hero" 
                  size="lg" 
                  className="text-lg px-8"
                  onClick={() => navigate('/inventory')}
                >
                  View All Demo Inventory
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <p className="text-lg text-muted-foreground">No demo vehicles available at the moment.</p>
            </div>
          )}
        </div>
      </section>

      {/* Platform Features Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Why Choose the Savvy Dealer Platform?
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              A complete digital solution built to transform automotive retail
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center p-6 rounded-lg hover:shadow-card transition-shadow animate-fade-in">
              <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Star className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Live Inventory Management</h3>
              <p className="text-muted-foreground">
                Real-time vehicle listings, automated updates, and seamless integration with your sales workflow
              </p>
            </div>
            
            <div className="text-center p-6 rounded-lg hover:shadow-card transition-shadow animate-fade-in">
              <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Intuitive Customer Tools</h3>
              <p className="text-muted-foreground">
                Built-in financing applications, contact forms, and customer relationship management
              </p>
            </div>
            
            <div className="text-center p-6 rounded-lg hover:shadow-card transition-shadow animate-fade-in">
              <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Automated Notifications</h3>
              <p className="text-muted-foreground">
                Instant SMS and email alerts for leads, financing applications, and customer inquiries
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gradient-primary">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to Explore the Platform?
          </h2>
          <p className="text-xl text-white/90 mb-8">
            Test the interactive features or request a full platform demo for your dealership
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              variant="secondary" 
              size="lg" 
              className="text-lg px-8"
              onClick={() => navigate('/inventory')}
            >
              Explore Demo Inventory
            </Button>
            <Button 
              variant="outline" 
              size="lg" 
              className="text-lg px-8 bg-white/10 border-white text-white hover:bg-white hover:text-primary"
              onClick={() => navigate('/contact')}
            >
              Request Platform Demo
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Index;