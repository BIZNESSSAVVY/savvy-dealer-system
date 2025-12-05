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
              Featured Vehicles
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Hand-picked quality vehicles from our inventory, ready for their new owners
            </p>
          </div>
          
          {loading ? (
            <div className="text-center py-12">
              <p className="text-lg text-muted-foreground">Loading featured vehicles...</p>
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
                  View All Inventory
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <p className="text-lg text-muted-foreground">No vehicles available at the moment.</p>
            </div>
          )}
        </div>
      </section>

      {/* Why Choose Us Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Why Choose Cece Auto?
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              We're not just a car dealership - we're your trusted automotive partner in Felton, Delaware
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center p-6 rounded-lg hover:shadow-card transition-shadow animate-fade-in">
              <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Star className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Quality Assured</h3>
              <p className="text-muted-foreground">
                Every vehicle undergoes thorough inspection and comes with our quality guarantee
              </p>
            </div>
            
            <div className="text-center p-6 rounded-lg hover:shadow-card transition-shadow animate-fade-in">
              <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Local Expertise</h3>
              <p className="text-muted-foreground">
                Proudly serving Felton and surrounding communities with personalized service
              </p>
            </div>
            
            <div className="text-center p-6 rounded-lg hover:shadow-card transition-shadow animate-fade-in">
              <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Quick Financing</h3>
              <p className="text-muted-foreground">
                Fast approval process with flexible payment options to fit your budget
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gradient-primary">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to Find Your Perfect Car?
          </h2>
          <p className="text-xl text-white/90 mb-8">
            Browse our inventory or contact us today to discuss your automotive needs
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              variant="secondary" 
              size="lg" 
              className="text-lg px-8"
              onClick={() => navigate('/inventory')}
            >
              Browse Inventory
            </Button>
            <Button 
              variant="outline" 
              size="lg" 
              className="text-lg px-8 bg-white/10 border-white text-white hover:bg-white hover:text-primary"
              onClick={() => navigate('/contact')}
            >
              Contact Us Now
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Index;