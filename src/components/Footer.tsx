import { Phone, MapPin, Mail, Clock } from "lucide-react";
import { Link } from "react-router-dom";

const COMPANY_NAME = "Savvy Dealer System";
const PHONE_DISPLAY = "(317) 741-7443";
const EMAIL_ADDRESS = "sales@savvyordersystems.com";
const ADDRESS_DISPLAY = "100 Innovation Way, Suite S-D-S, Indianapolis, IN 46204";
const TAGLINE = "The modern dealer platform provider";

const Footer = () => {
  return (
    <footer className="bg-gradient-to-b from-background to-muted/50 border-t border-border shadow-md">
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-3 gap-8 text-sm text-muted-foreground">
        {/* Dealership Info (Updated) */}
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-4">{COMPANY_NAME}</h3>
          <p className="mb-2">{TAGLINE}</p>
          
          <p className="flex items-center mb-2">
            <span className="bg-primary/10 w-8 h-8 rounded-full flex items-center justify-center mr-2">
              <MapPin className="h-4 w-4 text-primary" />
            </span>
            {ADDRESS_DISPLAY}
          </p>
          <p className="flex items-center">
            <span className="bg-primary/10 w-8 h-8 rounded-full flex items-center justify-center mr-2">
              <Mail className="h-4 w-4 text-primary" />
            </span>
            <a 
              href={`mailto:${EMAIL_ADDRESS}`} 
              className="hover:text-primary transition-colors"
            >
              {EMAIL_ADDRESS}
            </a>
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

        {/* Contact Info (Updated) */}
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-4">Contact Us</h3>
          <p className="flex items-center mb-2">
            <span className="bg-primary/10 w-8 h-8 rounded-full flex items-center justify-center mr-2">
              <Phone className="h-4 w-4 text-primary" />
            </span>
            <a 
              href={`tel:+1${PHONE_DISPLAY.replace(/\D/g,'')}`}
              className="hover:text-primary transition-colors"
            >
              {PHONE_DISPLAY}
            </a>
          </p>
          <p className="flex items-center mb-2">
            <span className="bg-primary/10 w-8 h-8 rounded-full flex items-center justify-center mr-2">
              <Clock className="h-4 w-4 text-primary" />
            </span>
            Mon-Fri: 10 AM - 5 PM | Sat: 10 AM - 4 PM
          </p>
          <p className="text-muted-foreground mt-4">
            &copy; {new Date().getFullYear()} {COMPANY_NAME}. All rights reserved.
          </p>
        </div>
      </div>

      {/* Bottom Gradient Bar (Updated) */}
      <div className="bg-gradient-primary text-center py-3 text-sm font-medium text-white/80 shadow-inner">
        Platform by{" "}
        <a
          href="#" // Using '#' as a placeholder link for the system name
          rel="noopener noreferrer"
          className="text-white hover:text-secondary-foreground transition-colors font-semibold"
        >
          Savvy Dealer Systems
        </a>
      </div>
    </footer>
  );
};

export default Footer;