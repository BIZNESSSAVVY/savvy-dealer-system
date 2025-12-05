import { Award, Users, Heart, Star, Clock, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom"; // Import Link for navigation

const About = () => {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-primary py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
            About Cece Auto
          </h1>
          <p className="text-xl text-white/90 max-w-3xl mx-auto">
            For more than 22 years Cece Automotive has proudly served Felton,
            Delaware — built on word-of-mouth, trusted by families, and focused
            on fair, second-chance financing for customers with challenged credit.
          </p>
        </div>
      </section>

      {/* Our Story */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
                Our Story
              </h2>
              <div className="space-y-4 text-lg text-muted-foreground">
                <p>
                  For more than two decades, Cece Automotive has served Felton
                  and the surrounding Delaware communities by helping families
                  secure reliable vehicles even when credit has been a challenge.
                </p>
                <p>
                  Our reputation was earned the old-fashioned way — through
                  honest service and customer referrals. We’ve relied on
                  word-of-mouth for 22 years because people know we treat them
                  fairly and work hard to find practical financing solutions.
                </p>
                <p>
                  Specializing in second-chance financing, Cece Automotive gives
                  hardworking families a real opportunity to rebuild credit and
                  regain independence behind the wheel. Friendly, fair, and
                  committed to doing right by our customers — that’s the Cece
                  way.
                </p>
              </div>
            </div>
            <div className="relative">
              <img
                src="cece.jfif"
                alt="Cece Auto dealership"
                className="rounded-lg shadow-hover w-full"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-primary/20 to-transparent rounded-lg"></div>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Our Values
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              These core principles guide every decision we make and every interaction we have
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="text-center hover:shadow-hover transition-shadow">
              <CardContent className="p-8">
                <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Heart className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-4">Integrity</h3>
                <p className="text-muted-foreground">
                  We believe in honest, transparent dealings with every customer. 
                  No hidden fees, no pressure tactics - just straightforward service.
                </p>
              </CardContent>
            </Card>

            <Card className="text-center hover:shadow-hover transition-shadow">
              <CardContent className="p-8">
                <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Shield className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-4">Quality</h3>
                <p className="text-muted-foreground">
                  Every vehicle undergoes thorough inspection to ensure it meets our 
                  high standards before it reaches our lot.
                </p>
              </CardContent>
            </Card>

            <Card className="text-center hover:shadow-hover transition-shadow">
              <CardContent className="p-8">
                <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Users className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-4">Community</h3>
                <p className="text-muted-foreground">
                  We're proud to be part of the Felton community and committed to 
                  supporting our neighbors' transportation needs.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Team - Commented Out */}
      {/* <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Meet Our Team
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Experienced professionals dedicated to helping you find the perfect vehicle
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="text-center hover:shadow-hover transition-shadow">
              <CardContent className="p-6">
                <img
                  src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face"
                  alt="Team member"
                  className="w-24 h-24 rounded-full mx-auto mb-4 object-cover"
                />
                <h3 className="text-lg font-semibold mb-2">Michael Rodriguez</h3>
                <p className="text-primary text-sm mb-2">General Manager</p>
                <p className="text-muted-foreground text-sm">
                  15+ years in automotive sales with a passion for customer service
                </p>
              </CardContent>
            </Card>

            <Card className="text-center hover:shadow-hover transition-shadow">
              <CardContent className="p-6">
                <img
                  src="https://images.unsplash.com/photo-1494790108755-2616b612b550?w=150&h=150&fit=crop&crop=face"
                  alt="Team member"
                  className="w-24 h-24 rounded-full mx-auto mb-4 object-cover"
                />
                <h3 className="text-lg font-semibold mb-2">Sarah Chen</h3>
                <p className="text-primary text-sm mb-2">Finance Manager</p>
                <p className="text-muted-foreground text-sm">
                  Helping customers find financing solutions that fit their budget
                </p>
              </CardContent>
            </Card>

            <Card className="text-center hover:shadow-hover transition-shadow">
              <CardContent className="p-6">
                <img
                  src="https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&h=150&fit=crop&crop=face"
                  alt="Team member"
                  className="w-24 h-24 rounded-full mx-auto mb-4 object-cover"
                />
                <h3 className="text-lg font-semibold mb-2">David Thompson</h3>
                <p className="text-primary text-sm mb-2">Sales Consultant</p>
                <p className="text-muted-foreground text-sm">
                  Local Delaware native with expertise in pre-owned vehicles
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section> */}

      {/* Stats */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-primary">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div className="text-white">
              <div className="text-3xl md:text-4xl font-bold mb-2">500+</div>
              <div className="text-white/80">Happy Customers</div>
            </div>
            <div className="text-white">
              <div className="text-3xl md:text-4xl font-bold mb-2">9</div>
              <div className="text-white/80">Years in Business</div>
            </div>
            <div className="text-white">
              <div className="text-3xl md:text-4xl font-bold mb-2">4.8</div>
              <div className="text-white/80">Star Rating</div>
            </div>
            <div className="text-white">
              <div className="text-3xl md:text-4xl font-bold mb-2">95%</div>
              <div className="text-white/80">Customer Satisfaction</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
            Ready to Experience the Cece Auto Difference?
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Visit us today and discover why so many Delaware residents trust us with their automotive needs.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/inventory">
              <Button variant="hero" size="lg" className="text-lg px-8">
                Browse Our Inventory
              </Button>
            </Link>
            <Link to="/contact">
              <Button variant="outline" size="lg" className="text-lg px-8">
                Contact Us Today
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default About;
