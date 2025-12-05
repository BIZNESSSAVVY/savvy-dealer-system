import { useState, useEffect } from "react";
import { FileText, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { collection, addDoc, getDocs } from "firebase/firestore";
import { db } from "../firebaseConfig";

const states = [
  "AB", "AL", "AK", "AZ", "AR", "BC", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY",
  "LA", "ME", "MD", "MA", "MB", "MI", "MN", "MS", "MO", "MT", "NB", "NC", "ND", "NE", "NH", "NJ", "NL", "NM", "NS", "NT",
  "NU", "NV", "NY", "OH", "OK", "ON", "OR", "PA", "PE", "PR", "QC", "RI", "SC", "SD", "SK", "TN", "TX", "UT", "VT", "VA",
  "WA", "WV", "WI", "WY", "YT"
];

interface InventoryVehicle {
  id: string;
  year: number;
  make: string;
  model: string;
  vin: string;
}

const Financing = () => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [textConsentChecked, setTextConsentChecked] = useState(false);
  const [hasCoBuyer, setHasCoBuyer] = useState(false);
  const [inventoryVehicles, setInventoryVehicles] = useState<InventoryVehicle[]>([]);
  const [loadingVehicles, setLoadingVehicles] = useState(true);

  const [formData, setFormData] = useState({
    firstName: "",
    middleName: "",
    lastName: "",
    address1: "",
    address2: "",
    city: "",
    state: "",
    zip: "",
    ssn: "",
    dob: "",
    dlNumber: "",
    dlState: "",
    dlExp: "",
    mobilePhone: "",
    homePhone: "",
    email: "",
    residenceYears: "0",
    residenceMonths: "0",
    residenceType: "",
    rentMortgage: "",
    employer: "",
    employerType: "",
    monthlyIncome: "",
    occupation: "",
    employerAddress1: "",
    employerAddress2: "",
    employerCity: "",
    employerState: "",
    employerZip: "",
    workPhone: "",
    jobYears: "0",
    jobMonths: "0",
    vehicleToFinance: "",
    stockNumber: "",
    year: "",
    make: "",
    model: "",
    trim: "",
    vin: "",
    mileage: "",
    checkingAccount: "",
    checkingAccountNumber: "",
    checkingBankName: "",
    checkingBankAddress1: "",
    checkingBankAddress2: "",
    checkingBankCity: "",
    checkingBankState: "",
    checkingBankZip: "",
    checkingBankPhone: "",
    savingsAccount: "",
    savingsAccountNumber: "",
    savingsBankName: "",
    savingsBankAddress1: "",
    savingsBankAddress2: "",
    savingsBankCity: "",
    savingsBankState: "",
    savingsBankZip: "",
    savingsBankPhone: "",
    loanTerm: "",
    amountRequired: "",
    downpayment: "",
    additionalComments: ""
  });

  // Fetch vehicles from Firebase on component mount
  useEffect(() => {
    const fetchVehicles = async () => {
      try {
        const vehiclesCollection = collection(db, "vehicles");
        const vehiclesSnapshot = await getDocs(vehiclesCollection);
        const vehiclesList = vehiclesSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            year: data.year || 0,
            make: data.make || "",
            model: data.model || "",
            vin: data.vin || ""
          };
        });
        
        // Sort by year (newest first), then by make
        vehiclesList.sort((a, b) => {
          if (b.year !== a.year) return b.year - a.year;
          return a.make.localeCompare(b.make);
        });
        
        setInventoryVehicles(vehiclesList);
      } catch (error) {
        console.error("Error fetching vehicles:", error);
        toast({
          title: "Warning",
          description: "Could not load vehicle inventory. You can still fill out the form manually.",
          variant: "destructive"
        });
      } finally {
        setLoadingVehicles(false);
      }
    };

    fetchVehicles();
  }, [toast]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleVehicleSelect = (vehicleString: string) => {
    handleInputChange("vehicleToFinance", vehicleString);
    
    // Parse the selected vehicle to auto-fill fields
    const selectedVehicle = inventoryVehicles.find(v => 
      `${v.year} ${v.make} ${v.model} - VIN: ${v.vin}` === vehicleString
    );
    
    if (selectedVehicle) {
      handleInputChange("year", selectedVehicle.year.toString());
      handleInputChange("make", selectedVehicle.make);
      handleInputChange("model", selectedVehicle.model);
      handleInputChange("vin", selectedVehicle.vin);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!consentChecked) {
      toast({
        title: "Consent Required",
        description: "Please acknowledge and consent to the credit application terms.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Save to Firestore first
      const docRef = await addDoc(collection(db, "creditApplications"), {
        ...formData,
        hasCoBuyer,
        consentAcknowledged: consentChecked,
        textConsentAcknowledged: textConsentChecked,
        submittedAt: new Date().toISOString()
      });

      console.log("Document written with ID: ", docRef.id);

      // Send notifications via API endpoint
      try {
        const response = await fetch('/api/send-financing', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...formData,
            hasCoBuyer,
            consentAcknowledged: consentChecked,
            textConsentAcknowledged: textConsentChecked
          })
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

      toast({
        title: "Application Submitted!",
        description: "Your credit application has been received. We'll contact you shortly."
      });

      // Reset form
      setFormData({
        firstName: "", middleName: "", lastName: "", address1: "", address2: "",
        city: "", state: "", zip: "", ssn: "", dob: "", dlNumber: "", dlState: "",
        dlExp: "", mobilePhone: "", homePhone: "", email: "", residenceYears: "0",
        residenceMonths: "0", residenceType: "", rentMortgage: "", employer: "",
        employerType: "", monthlyIncome: "", occupation: "", employerAddress1: "",
        employerAddress2: "", employerCity: "", employerState: "", employerZip: "",
        workPhone: "", jobYears: "0", jobMonths: "0", vehicleToFinance: "",
        stockNumber: "", year: "", make: "", model: "", trim: "", vin: "",
        mileage: "", checkingAccount: "", checkingAccountNumber: "",
        checkingBankName: "", checkingBankAddress1: "", checkingBankAddress2: "",
        checkingBankCity: "", checkingBankState: "", checkingBankZip: "",
        checkingBankPhone: "", savingsAccount: "", savingsAccountNumber: "",
        savingsBankName: "", savingsBankAddress1: "", savingsBankAddress2: "",
        savingsBankCity: "", savingsBankState: "", savingsBankZip: "",
        savingsBankPhone: "", loanTerm: "", amountRequired: "", downpayment: "",
        additionalComments: ""
      });
      setConsentChecked(false);
      setTextConsentChecked(false);
      setHasCoBuyer(false);

    } catch (error) {
      console.error("Error submitting application:", error);
      toast({
        title: "Submission Error",
        description: "There was an error submitting your application. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            Apply for Financing in Felton, DE
          </h1>
          <h2 className="text-2xl font-semibold text-primary mb-4">
            APPLY FOR CREDIT
          </h2>
        </div>

        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Attention Customers:</strong> Do you have a checking account? If so, kindly enter the name of your banking institution in the Additional Comments section of the application. Thank You.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-2xl">
              <FileText className="h-6 w-6 mr-3 text-primary" />
              Credit Application
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Applicant Information */}
              <div>
                <h3 className="text-lg font-semibold mb-4 text-primary">Applicant Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="firstName">First Name *</Label>
                    <Input
                      id="firstName"
                      value={formData.firstName}
                      onChange={(e) => handleInputChange("firstName", e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="middleName">Middle Name</Label>
                    <Input
                      id="middleName"
                      value={formData.middleName}
                      onChange={(e) => handleInputChange("middleName", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last Name *</Label>
                    <Input
                      id="lastName"
                      value={formData.lastName}
                      onChange={(e) => handleInputChange("lastName", e.target.value)}
                      required
                    />
                  </div>
                  <div className="md:col-span-3">
                    <Label htmlFor="address1">Address 1 *</Label>
                    <Input
                      id="address1"
                      value={formData.address1}
                      onChange={(e) => handleInputChange("address1", e.target.value)}
                      required
                    />
                  </div>
                  <div className="md:col-span-3">
                    <Label htmlFor="address2">Address 2</Label>
                    <Input
                      id="address2"
                      value={formData.address2}
                      onChange={(e) => handleInputChange("address2", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="city">City *</Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) => handleInputChange("city", e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="state">State *</Label>
                    <Select value={formData.state} onValueChange={(value) => handleInputChange("state", value)} required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                      <SelectContent>
                        {states.map(state => (
                          <SelectItem key={state} value={state}>{state}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="zip">Zip *</Label>
                    <Input
                      id="zip"
                      value={formData.zip}
                      onChange={(e) => handleInputChange("zip", e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="ssn">Social Security *</Label>
                    <Input
                      id="ssn"
                      value={formData.ssn}
                      onChange={(e) => handleInputChange("ssn", e.target.value)}
                      placeholder="XXX-XX-XXXX"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="dob">Date of Birth *</Label>
                    <Input
                      id="dob"
                      type="date"
                      value={formData.dob}
                      onChange={(e) => handleInputChange("dob", e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="dlNumber">Drivers License Number *</Label>
                    <Input
                      id="dlNumber"
                      value={formData.dlNumber}
                      onChange={(e) => handleInputChange("dlNumber", e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="dlState">Drivers License State *</Label>
                    <Select value={formData.dlState} onValueChange={(value) => handleInputChange("dlState", value)} required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                      <SelectContent>
                        {states.map(state => (
                          <SelectItem key={state} value={state}>{state}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="dlExp">Drivers License Exp *</Label>
                    <Input
                      id="dlExp"
                      type="date"
                      value={formData.dlExp}
                      onChange={(e) => handleInputChange("dlExp", e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="mobilePhone">Mobile Phone *</Label>
                    <Input
                      id="mobilePhone"
                      type="tel"
                      value={formData.mobilePhone}
                      onChange={(e) => handleInputChange("mobilePhone", e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="homePhone">Home Phone</Label>
                    <Input
                      id="homePhone"
                      type="tel"
                      value={formData.homePhone}
                      onChange={(e) => handleInputChange("homePhone", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange("email", e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label>Time at Residence - Years *</Label>
                    <Select value={formData.residenceYears} onValueChange={(value) => handleInputChange("residenceYears", value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[...Array(13)].map((_, i) => (
                          <SelectItem key={i} value={i.toString()}>
                            {i === 12 ? "12+ Years" : `${i} Years`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Time at Residence - Months *</Label>
                    <Select value={formData.residenceMonths} onValueChange={(value) => handleInputChange("residenceMonths", value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[...Array(12)].map((_, i) => (
                          <SelectItem key={i} value={i.toString()}>{i} Months</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="residenceType">Residence Type *</Label>
                    <Select value={formData.residenceType} onValueChange={(value) => handleInputChange("residenceType", value)} required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Rent">Rent</SelectItem>
                        <SelectItem value="Own">Own</SelectItem>
                        <SelectItem value="Living with Family">Living with Family</SelectItem>
                        <SelectItem value="Military Housing">Military Housing</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="rentMortgage">Rent/Mortgage</Label>
                    <Input
                      id="rentMortgage"
                      type="number"
                      value={formData.rentMortgage}
                      onChange={(e) => handleInputChange("rentMortgage", e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Employment Information */}
              <div>
                <h3 className="text-lg font-semibold mb-4 text-primary">Applicant Employment Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="employer">Employer *</Label>
                    <Input
                      id="employer"
                      value={formData.employer}
                      onChange={(e) => handleInputChange("employer", e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="employerType">Employer Type *</Label>
                    <Select value={formData.employerType} onValueChange={(value) => handleInputChange("employerType", value)} required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Full-Time">Full-Time</SelectItem>
                        <SelectItem value="Part-Time">Part-Time</SelectItem>
                        <SelectItem value="Temporary">Temporary</SelectItem>
                        <SelectItem value="Fixed Income">Fixed Income</SelectItem>
                        <SelectItem value="Self-Employed">Self-Employed</SelectItem>
                        <SelectItem value="Cash Income">Cash Income</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="monthlyIncome">Monthly Income *</Label>
                    <Input
                      id="monthlyIncome"
                      type="number"
                      value={formData.monthlyIncome}
                      onChange={(e) => handleInputChange("monthlyIncome", e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="occupation">Occupation *</Label>
                    <Input
                      id="occupation"
                      value={formData.occupation}
                      onChange={(e) => handleInputChange("occupation", e.target.value)}
                      required
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="employerAddress1">Address 1</Label>
                    <Input
                      id="employerAddress1"
                      value={formData.employerAddress1}
                      onChange={(e) => handleInputChange("employerAddress1", e.target.value)}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="employerAddress2">Address 2</Label>
                    <Input
                      id="employerAddress2"
                      value={formData.employerAddress2}
                      onChange={(e) => handleInputChange("employerAddress2", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="employerCity">City</Label>
                    <Input
                      id="employerCity"
                      value={formData.employerCity}
                      onChange={(e) => handleInputChange("employerCity", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="employerState">State</Label>
                    <Select value={formData.employerState} onValueChange={(value) => handleInputChange("employerState", value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                      <SelectContent>
                        {states.map(state => (
                          <SelectItem key={state} value={state}>{state}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="employerZip">Zip</Label>
                    <Input
                      id="employerZip"
                      value={formData.employerZip}
                      onChange={(e) => handleInputChange("employerZip", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="workPhone">Work Phone</Label>
                    <Input
                      id="workPhone"
                      type="tel"
                      value={formData.workPhone}
                      onChange={(e) => handleInputChange("workPhone", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Time on Job - Years</Label>
                    <Select value={formData.jobYears} onValueChange={(value) => handleInputChange("jobYears", value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[...Array(13)].map((_, i) => (
                          <SelectItem key={i} value={i.toString()}>
                            {i === 12 ? "12+ Years" : `${i} Years`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Time on Job - Months</Label>
                    <Select value={formData.jobMonths} onValueChange={(value) => handleInputChange("jobMonths", value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[...Array(12)].map((_, i) => (
                          <SelectItem key={i} value={i.toString()}>{i} Months</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Co-Buyer */}
              <div>
                <h3 className="text-lg font-semibold mb-4 text-primary">Co-Buyer</h3>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="hasCoBuyer"
                    checked={hasCoBuyer}
                    onCheckedChange={(checked) => setHasCoBuyer(checked as boolean)}
                  />
                  <Label htmlFor="hasCoBuyer">Do you have a co-buyer?</Label>
                </div>
              </div>

              {/* Vehicle Information */}
              <div>
                <h3 className="text-lg font-semibold mb-4 text-primary">Vehicle Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <Label htmlFor="vehicleToFinance">Vehicle To Finance</Label>
                    <Select 
                      value={formData.vehicleToFinance} 
                      onValueChange={handleVehicleSelect}
                      disabled={loadingVehicles}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={loadingVehicles ? "Loading inventory..." : "Select Vehicle from Inventory"} />
                      </SelectTrigger>
                      <SelectContent>
                        {inventoryVehicles.length > 0 ? (
                          inventoryVehicles.map((vehicle) => (
                            <SelectItem 
                              key={vehicle.id} 
                              value={`${vehicle.year} ${vehicle.make} ${vehicle.model} - VIN: ${vehicle.vin}`}
                            >
                              {vehicle.year} {vehicle.make} {vehicle.model}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="none" disabled>No vehicles available</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="stockNumber">Stock Number</Label>
                    <Input
                      id="stockNumber"
                      value={formData.stockNumber}
                      onChange={(e) => handleInputChange("stockNumber", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="year">Year</Label>
                    <Input
                      id="year"
                      value={formData.year}
                      onChange={(e) => handleInputChange("year", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="make">Make</Label>
                    <Input
                      id="make"
                      value={formData.make}
                      onChange={(e) => handleInputChange("make", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="model">Model</Label>
                    <Input
                      id="model"
                      value={formData.model}
                      onChange={(e) => handleInputChange("model", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="trim">Trim</Label>
                    <Input
                      id="trim"
                      value={formData.trim}
                      onChange={(e) => handleInputChange("trim", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="vin">VIN</Label>
                    <Input
                      id="vin"
                      value={formData.vin}
                      onChange={(e) => handleInputChange("vin", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="mileage">Mileage</Label>
                    <Input
                      id="mileage"
                      type="number"
                      value={formData.mileage}
                      onChange={(e) => handleInputChange("mileage", e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Bank Information - Checking */}
              <div>
                <h3 className="text-lg font-semibold mb-4 text-primary">Bank Information - Checking Account</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="checkingAccount">Checking Account</Label>
                    <Input
                      id="checkingAccount"
                      value={formData.checkingAccount}
                      onChange={(e) => handleInputChange("checkingAccount", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="checkingAccountNumber">Account Number *</Label>
                    <Input
                      id="checkingAccountNumber"
                      value={formData.checkingAccountNumber}
                      onChange={(e) => handleInputChange("checkingAccountNumber", e.target.value)}
                      required
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="checkingBankName">Bank Name *</Label>
                    <Input
                      id="checkingBankName"
                      value={formData.checkingBankName}
                      onChange={(e) => handleInputChange("checkingBankName", e.target.value)}
                      required
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="checkingBankAddress1">Address 1</Label>
                    <Input
                      id="checkingBankAddress1"
                      value={formData.checkingBankAddress1}
                      onChange={(e) => handleInputChange("checkingBankAddress1", e.target.value)}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="checkingBankAddress2">Address 2</Label>
                    <Input
                      id="checkingBankAddress2"
                      value={formData.checkingBankAddress2}
                      onChange={(e) => handleInputChange("checkingBankAddress2", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="checkingBankCity">City</Label>
                    <Input
                      id="checkingBankCity"
                      value={formData.checkingBankCity}
                      onChange={(e) => handleInputChange("checkingBankCity", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="checkingBankState">State</Label>
                    <Select value={formData.checkingBankState} onValueChange={(value) => handleInputChange("checkingBankState", value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                      <SelectContent>
                        {states.map(state => (
                          <SelectItem key={state} value={state}>{state}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="checkingBankZip">Zip</Label>
                    <Input
                      id="checkingBankZip"
                      value={formData.checkingBankZip}
                      onChange={(e) => handleInputChange("checkingBankZip", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="checkingBankPhone">Phone</Label>
                    <Input
                      id="checkingBankPhone"
                      type="tel"
                      value={formData.checkingBankPhone}
                      onChange={(e) => handleInputChange("checkingBankPhone", e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Bank Information - Savings */}
              <div>
                <h3 className="text-lg font-semibold mb-4 text-primary">Bank Information - Savings Account</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="savingsAccount">Savings Account</Label>
                    <Input
                      id="savingsAccount"
                      value={formData.savingsAccount}
                      onChange={(e) => handleInputChange("savingsAccount", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="savingsAccountNumber">Account Number *</Label>
                    <Input
                      id="savingsAccountNumber"
                      value={formData.savingsAccountNumber}
                      onChange={(e) => handleInputChange("savingsAccountNumber", e.target.value)}
                      required
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="savingsBankName">Bank Name *</Label>
                    <Input
                      id="savingsBankName"
                      value={formData.savingsBankName}
                      onChange={(e) => handleInputChange("savingsBankName", e.target.value)}
                      required
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="savingsBankAddress1">Address 1</Label>
                    <Input
                      id="savingsBankAddress1"
                      value={formData.savingsBankAddress1}
                      onChange={(e) => handleInputChange("savingsBankAddress1", e.target.value)}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="savingsBankAddress2">Address 2</Label>
                    <Input
                      id="savingsBankAddress2"
                      value={formData.savingsBankAddress2}
                      onChange={(e) => handleInputChange("savingsBankAddress2", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="savingsBankCity">City</Label>
                    <Input
                      id="savingsBankCity"
                      value={formData.savingsBankCity}
                      onChange={(e) => handleInputChange("savingsBankCity", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="savingsBankState">State</Label>
                    <Select value={formData.savingsBankState} onValueChange={(value) => handleInputChange("savingsBankState", value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                      <SelectContent>
                        {states.map(state => (
                          <SelectItem key={state} value={state}>{state}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="savingsBankZip">Zip</Label>
                    <Input
                      id="savingsBankZip"
                      value={formData.savingsBankZip}
                      onChange={(e) => handleInputChange("savingsBankZip", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="savingsBankPhone">Phone</Label>
                    <Input
                      id="savingsBankPhone"
                      type="tel"
                      value={formData.savingsBankPhone}
                      onChange={(e) => handleInputChange("savingsBankPhone", e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Financing Information */}
              <div>
                <h3 className="text-lg font-semibold mb-4 text-primary">Financing Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="loanTerm">Loan Term (Months)</Label>
                    <Input
                      id="loanTerm"
                      type="number"
                      value={formData.loanTerm}
                      onChange={(e) => handleInputChange("loanTerm", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="amountRequired">Amount Required</Label>
                    <Input
                      id="amountRequired"
                      type="number"
                      value={formData.amountRequired}
                      onChange={(e) => handleInputChange("amountRequired", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="downpayment">Downpayment</Label>
                    <Input
                      id="downpayment"
                      type="number"
                      value={formData.downpayment}
                      onChange={(e) => handleInputChange("downpayment", e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Additional Comments */}
              <div>
                <h3 className="text-lg font-semibold mb-4 text-primary">Additional Comments</h3>
                <Textarea
                  id="additionalComments"
                  value={formData.additionalComments}
                  onChange={(e) => handleInputChange("additionalComments", e.target.value)}
                  placeholder="Please include your bank name if you have a checking account..."
                  rows={4}
                />
              </div>

              {/* Acknowledgment and Consent */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-primary">ACKNOWLEDGMENT AND CONSENT</h3>
                <div className="p-4 bg-muted/30 rounded-lg text-sm space-y-2">
                  <p>
                    I certify that the above information is complete and accurate to the best of my knowledge. Creditors receiving this application will retain the application whether or not it is approved. Creditors may rely on this application in deciding whether to grant the requested credit. False statements may subject me to criminal penalties. I authorize the creditors to obtain credit reports about me on an ongoing basis during this credit transaction and to check my credit and employment history on an ongoing basis during the term of the credit transaction. If this application is approved, I authorize the creditor to give credit information about me to its affiliates.
                  </p>
                </div>
                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="consent"
                    checked={consentChecked}
                    onCheckedChange={(checked) => setConsentChecked(checked as boolean)}
                    required
                  />
                  <Label htmlFor="consent" className="text-sm leading-relaxed">
                    I acknowledge and consent to the terms stated above *
                  </Label>
                </div>
                
                <div className="p-4 bg-muted/30 rounded-lg text-sm space-y-2">
                  <p>
                    By checking this box I hereby consent to receive customer care text messages and/or phone calls from or on behalf of Felton Cash Cars or their employees to the mobile phone number I provided above. By opting in, I understand that message and data rates may apply. This acknowledgement constitutes my written consent to receive text messages to my cell phone and phone calls, including communications sent using an auto-dialer or pre-recorded message. You may withdraw your consent at any time by texting "STOP" or "HELP" for help. See our privacy policy at https://www.Feltoncashcars.com/privacy for more information.
                  </p>
                </div>
                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="textConsent"
                    checked={textConsentChecked}
                    onCheckedChange={(checked) => setTextConsentChecked(checked as boolean)}
                  />
                  <Label htmlFor="textConsent" className="text-sm leading-relaxed">
                    I consent to receive text messages and phone calls
                  </Label>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-6">
                <Button
                  type="submit"
                  variant="hero"
                  size="lg"
                  className="w-full text-lg"
                  disabled={isSubmitting || !consentChecked}
                >
                  {isSubmitting ? "Submitting Application..." : "Submit Application"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Financing