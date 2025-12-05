import React from "react";
import { Link } from "react-router-dom";
import { MapPin, Phone, Clock, ArrowRight, Shield, Award, Users, Navigation } from "lucide-react";
import dealershipImage from "@/images/dealership.jpg";

const DealershipHighlight: React.FC = () => {
  // Use the new Savvy Dealer System contact details
  const NEW_COMPANY_NAME = "Savvy Dealer System";
  const NEW_ADDRESS = "100 Innovation Way, Suite S-D-S, Indianapolis, IN 46204";
  const NEW_PHONE_DESC = "Connect with a dealer specialist";

  return (
    <section className="w-full py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-background to-muted/20">
      <div className="max-w-7xl mx-auto">
        {/* Section Header - Updated to new brand and location */}
        <div className="text-center mb-12 animate-fade-in">
          <div className="inline-flex items-center justify-center mb-4">
            <div className="h-px w-12 bg-gradient-to-r from-transparent to-automotive-gold"></div>
            <Award className="h-6 w-6 text-automotive-gold mx-3" />
            <div className="h-px w-12 bg-gradient-to-l from-transparent to-automotive-gold"></div>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            Our Platform Hub in{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-automotive-gold">
              Indianapolis, IN
            </span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            The integrated system powering the future of car purchasing.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 items-center">
          {/* Image Section with Overlay - Alt text updated */}
          <div className="relative group animate-slide-up">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-automotive-gold/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
            <div className="relative rounded-2xl overflow-hidden shadow-premium border-2 border-automotive-gold/20">
              <img
                src={dealershipImage}
                alt={`${NEW_COMPANY_NAME} - Indianapolis Headquarters`}
                className="w-full h-[400px] object-cover transition-transform duration-700 group-hover:scale-105"
              />
              {/* Shine Effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
              
              {/* Badge Overlay - Updated to reflect platform status */}
              <div className="absolute top-4 right-4 bg-automotive-gold text-primary px-4 py-2 rounded-full font-semibold text-sm shadow-lg flex items-center gap-2">
                <Award className="h-4 w-4" />
                Next-Gen Dealer Solutions
              </div>
            </div>
          </div>

          {/* Content Section */}
          <div className="space-y-6 animate-scale-in">
            {/* Trust Badges - Updated for a platform focus */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="text-center p-4 bg-card rounded-xl border border-border hover:border-automotive-gold transition-colors duration-300">
                <Shield className="h-8 w-8 text-automotive-gold mx-auto mb-2" />
                <p className="text-sm font-semibold text-foreground">Secure Transactions</p>
              </div>
              <div className="text-center p-4 bg-card rounded-xl border border-border hover:border-automotive-gold transition-colors duration-300">
                <Award className="h-8 w-8 text-automotive-gold mx-auto mb-2" />
                <p className="text-sm font-semibold text-foreground">Nationwide Network</p>
              </div>
              <div className="text-center p-4 bg-card rounded-xl border border-border hover:border-automotive-gold transition-colors duration-300">
                <Users className="h-8 w-8 text-automotive-gold mx-auto mb-2" />
                <p className="text-sm font-semibold text-foreground">Dealer Support</p>
              </div>
            </div>

            {/* Description - Updated copy */}
            <div className="bg-gradient-to-br from-primary/5 to-automotive-gold/5 rounded-xl p-6 border border-automotive-gold/20">
              <p className="text-foreground text-lg leading-relaxed mb-6">
                The Savvy Dealer System is more than just a website—it's an integrated platform that connects trusted dealers, simplifies financing, and streamlines the vehicle search process for buyers across the country.
              </p>

              {/* Contact Info - Updated address and phone description */}
              <div className="space-y-3 mb-6">
                <div className="flex items-center text-muted-foreground">
                  <MapPin className="h-5 w-5 text-automotive-gold mr-3 flex-shrink-0" />
                  <span>{NEW_ADDRESS}</span>
                </div>
                <div className="flex items-center text-muted-foreground">
                  <Phone className="h-5 w-5 text-automotive-gold mr-3 flex-shrink-0" />
                  <span>{NEW_PHONE_DESC}</span>
                </div>
                <div className="flex items-center text-muted-foreground">
                  <Clock className="h-5 w-5 text-automotive-gold mr-3 flex-shrink-0" />
                  <span>Platform operating 24/7 (Support Mon-Fri, 10 AM - 5 PM)</span>
                </div>
              </div>

              {/* CTA Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Link to="/financing" className="w-full">
                  <button className="w-full group relative px-6 py-4 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden">
                    <span className="relative z-10 flex items-center justify-center gap-2">
                      Apply for Financing
                      <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                    </span>
                    <div className="absolute inset-0 bg-gradient-to-r from-automotive-gold/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  </button>
                </Link>
                
                <a 
                  href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(NEW_ADDRESS)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full"
                >
                  <button className="w-full group px-6 py-4 bg-automotive-gold hover:bg-automotive-gold/90 text-primary font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center gap-2">
                    <Navigation className="h-5 w-5 group-hover:rotate-45 transition-transform duration-300" />
                    Visit Our HQ (By Appointment)
                  </button>
                </a>
              </div>

              {/* Browse Inventory - Secondary Button */}
              <Link to="/inventory" className="block mt-4">
                <button className="w-full px-6 py-3 bg-card hover:bg-muted text-foreground font-semibold rounded-xl border-2 border-border hover:border-automotive-gold transition-all duration-300 flex items-center justify-center gap-2">
                  Browse Inventory
                  <ArrowRight className="h-4 w-4" />
                </button>
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom Stats Bar - Updated copy */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in">
          <div className="text-center p-6 bg-gradient-to-br from-primary/10 to-automotive-gold/10 rounded-xl border border-automotive-gold/30">
            <p className="text-3xl font-bold text-primary mb-2">350+</p>
            <p className="text-muted-foreground">Certified Dealers</p>
          </div>
          <div className="text-center p-6 bg-gradient-to-br from-primary/10 to-automotive-gold/10 rounded-xl border border-automotive-gold/30">
            <p className="text-3xl font-bold text-primary mb-2">1,500+</p>
            <p className="text-muted-foreground">Vehicles Available</p>
          </div>
          <div className="text-center p-6 bg-gradient-to-br from-primary/10 to-automotive-gold/10 rounded-xl border border-automotive-gold/30">
            <p className="text-3xl font-bold text-primary mb-2">Integrated</p>
            <p className="text-muted-foreground">Financing Solutions</p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default DealershipHighlight;