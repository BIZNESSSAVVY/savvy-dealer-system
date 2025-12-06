import { Phone, MapPin, Mail, Clock } from "lucide-react";
import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <footer className="bg-gradient-to-b from-background to-muted/50 border-t border-border shadow-md">
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-3 gap-8 text-sm text-muted-foreground">
        {/* Dealership Info */}
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-4">Savvy Dealer System</h3>
          <p className="mb-2">Your trusted dealership Nationwide</p>
          <p className="flex items-center mb-2">
            <span className="bg-primary/10 w-8 h-8 rounded-full flex items-center justify-center mr-2">
              <MapPin className="h-4 w-4 text-primary" />
            </span>
            102 Lombard St, USA 19943
          </p>
          <p className="flex items-center">
            <span className="bg-primary/10 w-8 h-8 rounded-full flex items-center justify-center mr-2">
              <Mail className="h-4 w-4 text-primary" />
            </span>
            biznesssavvy39@gmail.com
          </p>
        </div>

        {/* Quick Links */}
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-4">Quick Links</h3>
          <ul className="space-y-2">
            <li>
              <Link to="/" className="hover:text-primary transition-colors">
                Home
              </Link>
            </li>
            <li>
              <Link to="/inventory" className="hover:text-primary transition-colors">
                Inventory
              </Link>
            </li>
            <li>
              <Link to="/financing" className="hover:text-primary transition-colors">
                Financing
              </Link>
            </li>
            <li>
              <Link to="/about" className="hover:text-primary transition-colors">
                About
              </Link>
            </li>
            <li>
              <Link to="/contact" className="hover:text-primary transition-colors">
                Contact
              </Link>
            </li>
          </ul>
        </div>

        {/* Contact Info */}
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-4">Contact Us</h3>
          <p className="flex items-center mb-2">
            <span className="bg-primary/10 w-8 h-8 rounded-full flex items-center justify-center mr-2">
              <Phone className="h-4 w-4 text-primary" />
            </span>
            (317) 741-7443          </p>
          <p className="flex items-center mb-2">
            <span className="bg-primary/10 w-8 h-8 rounded-full flex items-center justify-center mr-2">
              <Clock className="h-4 w-4 text-primary" />
            </span>
            Mon-Fri: 10 AM - 5 PM | Sat: 10 AM -  4PM 
          </p>
          <p className="text-muted-foreground mt-4">
            &copy; {new Date().getFullYear()} Savvy Dealer System. All rights reserved.
          </p>
        </div>
      </div>

      {/* Bottom Bar - Guaranteed Visible */}
      <div className="bg-gray-900 text-center py-3 text-sm text-white">
        Powered by{" "}
        <a
          href="https://savvyordersystems.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline font-semibold"
        >
          Savvy OS
        </a>
      </div>
    </footer>
  );
};

export default Footer;
