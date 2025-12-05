import { useState } from "react";
import { MapPin, Phone, Clock, Mail, MessageCircle, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebaseConfig";

const Contact = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "",
    message: "",
    preferredContact: ""
  });
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState({ type: "", message: "" });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus({ type: "", message: "" });

    try {
      // Save to Firestore first
      const docRef = await addDoc(collection(db, "contact_submissions"), {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        subject: formData.subject,
        message: formData.message,
        preferredContact: formData.preferredContact,
        submittedAt: serverTimestamp(),
        status: "new"
      });

      console.log("Document written with ID: ", docRef.id);

      // Send notifications via API endpoint
      try {
        const response = await fetch('/api/send-contact', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(formData)
        });

        const data = await response.json();

        if (!response.ok) {
          console.error('API error:', data);
          throw new Error(data.error || 'Failed to send notifications');
        }

        console.log('Notifications sent successfully:', data);
      } catch (apiError) {
        console.error("Notification error (non-critical):", apiError);
        // Don't throw - form was saved successfully
      }

      setSubmitStatus({
        type: "success",
        message: "Thank you! Your message has been sent successfully. We'll get back to you soon."
      });

      setFormData({
        name: "",
        email: "",
        phone: "",
        subject: "",
        message: "",
        preferredContact: ""
      });

      if (showScheduleForm) setShowScheduleForm(false);

    } catch (error) {
      console.error("Error: ", error);
      setSubmitStatus({
        type: "error",
        message: "Sorry, there was an error submitting your message. Please try again or call us directly."
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    console.log(`Input changed: ${field} = ${value}`);
  };

  const openGoogleMaps = () => {
    const address = "102+Lombard+St,+Felton,+DE+19943";
    window.open(`https://www.google.com/maps/search/?api=1&query=${address}`, "_blank");
    console.log("Google Maps opened");
  };

  const handleCallNow = () => {
    console.log("Call initiated to (302) 284-7114");
    window.location.href = "tel:+13022847114";
  };

  const handleStartChat = () => {
    console.log("Chatbot trigger dispatched");
    window.dispatchEvent(new CustomEvent('toggleChatbot'));
  };

  const handleScheduleNow = () => {
    console.log("Schedule form opened");
    setShowScheduleForm(true);
    setFormData(prev => ({
      ...prev,
      subject: "test-drive",
      message: "I would like to schedule a visit."
    }));
    setTimeout(() => {
      const form = document.getElementById('contact-form');
      if (form) {
        form.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            Contact Cece Auto
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Get in touch with us today. We're here to help you find your perfect vehicle 
            or answer any questions you may have.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Contact Information */}
          <div className="lg:col-span-1 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Phone className="h-5 w-5 mr-2 text-primary" />
                  Call Us
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-lg font-semibold">(302) 284-7114</p>
                  <p className="text-sm text-muted-foreground">Sales & General Inquiries</p>
                  <p className="text-lg font-semibold">(302) 284-7114</p>
                  <p className="text-sm text-muted-foreground">Service & Parts</p>
                </div>
                <Button variant="default" className="w-full mt-4" onClick={handleCallNow}>
                  <Phone className="h-4 w-4 mr-2" />
                  Call Now
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <MapPin className="h-5 w-5 mr-2 text-primary" />
                  Visit Us
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="font-semibold">Cece Auto</p>
                  <p>102 Lombard St</p>
                  <p>Felton, DE 19943</p>
                </div>
                <Button variant="outline" className="w-full mt-4" onClick={openGoogleMaps}>
                  <MapPin className="h-4 w-4 mr-2" />
                  Get Directions
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Clock className="h-5 w-5 mr-2 text-primary" />
                  Hours of Operation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Monday - Thursday</span>
                    <span>10:00 AM - 5:00 PM</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Friday</span>
                    <span>10:00 AM - 5:00 PM</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Saturday</span>
                    <span>11:00 AM - 4:00 PM</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Mail className="h-5 w-5 mr-2 text-primary" />
                  Email Us
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p>ceceauto@yahoo.com</p>
                  <p className="text-sm text-muted-foreground">General inquiries</p>
                  <p>ceceauto@yahoo.com</p>
                  <p className="text-sm text-muted-foreground">Sales department</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Contact Form */}
          <div className="lg:col-span-2">
            <Card id="contact-form">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <MessageCircle className="h-5 w-5 mr-2 text-primary" />
                  {showScheduleForm ? "Schedule a Visit" : "Send Us a Message"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  {submitStatus.message && (
                    <div className={`p-4 rounded-lg ${
                      submitStatus.type === "success" 
                        ? "bg-green-50 text-green-800 border border-green-200" 
                        : "bg-red-50 text-red-800 border border-red-200"
                    }`}>
                      {submitStatus.message}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="name">Full Name *</Label>
                      <Input
                        id="name"
                        required
                        value={formData.name}
                        onChange={(e) => handleInputChange("name", e.target.value)}
                        placeholder="Your full name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">Email Address *</Label>
                      <Input
                        id="email"
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => handleInputChange("email", e.target.value)}
                        placeholder="your@email.com"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) => handleInputChange("phone", e.target.value)}
                        placeholder="(555) 123-4567"
                      />
                    </div>
                    <div>
                      <Label htmlFor="preferred-contact">Preferred Contact Method</Label>
                      <Select value={formData.preferredContact} onValueChange={(value) => handleInputChange("preferredContact", value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select preference" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="phone">Phone</SelectItem>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="text">Text Message</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="subject">Subject *</Label>
                    <Select value={formData.subject} onValueChange={(value) => handleInputChange("subject", value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="What can we help you with?" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="general">General Inquiry</SelectItem>
                        <SelectItem value="vehicle">Vehicle Question</SelectItem>
                        <SelectItem value="financing">Financing Options</SelectItem>
                        <SelectItem value="test-drive">Schedule Test Drive</SelectItem>
                        <SelectItem value="trade-in">Trade-in Evaluation</SelectItem>
                        <SelectItem value="service">Service Department</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="message">Message *</Label>
                    <Textarea
                      id="message"
                      required
                      value={formData.message}
                      onChange={(e) => handleInputChange("message", e.target.value)}
                      placeholder="Tell us how we can help you..."
                      rows={6}
                    />
                  </div>

                  {!showScheduleForm && (
                    <div className="flex flex-col sm:flex-row gap-4">
                      <Button type="submit" variant="default" size="lg" className="flex-1" disabled={isSubmitting}>
                        {isSubmitting ? "Sending..." : "Send Message"}
                      </Button>
                      <Button type="button" variant="outline" size="lg" className="flex-1" onClick={handleCallNow}>
                        Call Instead
                      </Button>
                    </div>
                  )}
                  {showScheduleForm && (
                    <Button type="submit" variant="default" size="lg" className="w-full" disabled={isSubmitting}>
                      {isSubmitting ? "Scheduling..." : "Schedule Visit"}
                    </Button>
                  )}
                </form>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Map Section */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Find Us on the Map</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-muted rounded-lg h-96 overflow-hidden">
              <iframe
                width="100%"
                height="100%"
                style={{ border: 0 }}
                loading="lazy"
                allowFullScreen
                src="https://www.google.com/maps/embed/v1/place?key=AIzaSyB6DrcEhX6IiuU0lpwNrK293uQHVgx7NFE&q=102+Lombard+St,Felton,DE+19943"
              ></iframe>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="text-center hover:shadow-hover transition-shadow">
            <CardContent className="p-8">
              <Phone className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Call for Immediate Assistance</h3>
              <p className="text-muted-foreground mb-4">Speak directly with our sales team</p>
              <Button variant="default" className="w-full" onClick={handleCallNow}>
                (302) 284-7114              </Button>
            </CardContent>
          </Card>

          <Card className="text-center hover:shadow-hover transition-shadow">
            <CardContent className="p-8">
              <FileText className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Apply for Financing</h3>
              <p className="text-muted-foreground mb-4">Start your financing application online</p>
              <Button variant="secondary" className="w-full">
                <a href="/financing">Apply for Financing</a>
              </Button>
            </CardContent>
          </Card>

          <Card className="text-center hover:shadow-hover transition-shadow">
            <CardContent className="p-8">
              <Clock className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Schedule Visit</h3>
              <p className="text-muted-foreground mb-4">Book an appointment at your convenience</p>
              <Button variant="outline" className="w-full" onClick={handleScheduleNow}>
                Schedule Now
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Contact;