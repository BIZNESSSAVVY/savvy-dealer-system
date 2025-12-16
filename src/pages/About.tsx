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
            About Savvy Dealer
          </h1>
          <p className="text-xl text-white/90 max-w-3xl mx-auto">
            Savvy Dealer is the modern platform for automotive retail. We connect dealerships with intelligent tools, transparent pricing, and streamlined financing to create better experiences for both dealers and their customers.
          </p>
        </div>
      </section>

      {/* Our Story */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
                Our Platform
              </h2>
              <div className="space-y-4 text-lg text-muted-foreground">
                <p>
                  Savvy Dealer was built to solve the complexities of modern automotive sales. We provide dealerships with a complete digital ecosystem—from inventory management and customer-facing websites to smart financing tools and deal structuring.
                </p>
                <p>
                  Our technology empowers dealers to operate more efficiently, reduce administrative overhead, and focus on what matters most: building relationships and moving inventory. The platform is designed to be intuitive for staff while delivering a premium, transparent experience for car buyers.
                </p>
                <p>
                  We specialize in integrating advanced tools like real-time financing approvals, digital paperwork, and AI-powered customer insights. This demo showcases how a dealership using our platform can present itself online and manage customer interactions seamlessly.
                </p>
              </div>
            </div>
            <div className="relative">
              <img
                src="/dealership.png" // Consider updating this image to a modern dealership or tech interface
                alt="Savvy Dealer platform interface"
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
              Our Core Principles
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              The foundation of our platform is built on these key principles
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="text-center hover:shadow-hover transition-shadow">
              <CardContent className="p-8">
                <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Shield className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-4">Transparency</h3>
                <p className="text-muted-foreground">
                  We believe in clear, upfront pricing and honest communication. Our tools eliminate hidden fees and create trust between dealers and customers.
                </p>
              </CardContent>
            </Card>

            <Card className="text-center hover:shadow-hover transition-shadow">
              <CardContent className="p-8">
                <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Award className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-4">Innovation</h3>
                <p className="text-muted-foreground">
                  We continuously evolve our platform with cutting-edge technology to simplify complex processes and deliver smarter automotive retail solutions.
                </p>
              </CardContent>
            </Card>

            <Card className="text-center hover:shadow-hover transition-shadow">
              <CardContent className="p-8">
                <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Users className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-4">Partnership</h3>
                <p className="text-muted-foreground">
                  We succeed when our dealership partners succeed. Our platform is designed to be a true partner in growth, not just another software vendor.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-primary">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div className="text-white">
              <div className="text-3xl md:text-4xl font-bold mb-2">150+</div>
              <div className="text-white/80">Dealer Partners</div>
            </div>
            <div className="text-white">
              <div className="text-3xl md:text-4xl font-bold mb-2">5</div>
              <div className="text-white/80">Platform Features</div>
            </div>
            <div className="text-white">
              <div className="text-3xl md:text-4xl font-bold mb-2">4.9</div>
              <div className="text-white/80">Partner Rating</div>
            </div>
            <div className="text-white">
              <div className="text-3xl md:text-4xl font-bold mb-2">98%</div>
              <div className="text-white/80">Dealer Retention</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
            Experience the Future of Automotive Retail
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            This demo showcases how our platform transforms dealership operations and customer experiences. Explore the features and see the difference.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/inventory">
              <Button variant="hero" size="lg" className="text-lg px-8">
                View Demo Inventory
              </Button>
            </Link>
            <Link to="/contact">
              <Button variant="outline" size="lg" className="text-lg px-8">
                Request Platform Demo
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default About;