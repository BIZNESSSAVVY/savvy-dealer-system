// src/components/VehicleCard.tsx

import { Image, Gauge, Calendar, Fuel, Car, Plus, Maximize } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";

// Import the centralized Vehicle interface from the types folder
import { Vehicle } from "@/types/vehicle";

interface VehicleCardProps {
  vehicle: Vehicle;
  onViewDetails: (id: string) => void;
  onScheduleTest: (id: string) => void;
}

const formatPrice = (price: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(price);
};

const formatMileage = (mileage: number) => {
  return new Intl.NumberFormat("en-US").format(mileage);
};

const VehicleCard = ({ vehicle, onViewDetails, onScheduleTest }: VehicleCardProps) => {

  // Ensure 'images' is an array, defaulting to empty array if undefined or null
  const images = vehicle.images ?? []; 
  const imageUrls = images.length > 0 ? images : ["/placeholder-car.jpg"];

  return (
    <Card className="flex flex-col overflow-hidden transition-all duration-300 hover:shadow-xl">
      <CardHeader className="p-0 relative">
        <Carousel className="w-full" opts={{ loop: true }}>
          <CarouselContent>
            {imageUrls.map((url, index) => (
              <CarouselItem key={index}>
                <div className="relative aspect-[3/2] w-full bg-gray-100">
                  <img
                    src={url}
                    alt={`${vehicle.make} ${vehicle.model} image ${index + 1}`}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    onError={(e) => {
                      e.currentTarget.src = "/placeholder-car.jpg";
                    }}
                  />
                  {/* Image counter - only show if there are actual images */}
                  {images.length > 0 && (
                    <Badge className="absolute bottom-2 right-2 bg-black/60 text-white hover:bg-black/70">
                      <Image className="h-3 w-3 mr-1" />
                      {index + 1} / {images.length}
                    </Badge>
                  )}
                  
                  {/* 🎯 Stock Number Badge - Top Left */}
                  {vehicle.stockNumber && (
                    <Badge className="absolute top-2 left-2 bg-white/95 text-foreground font-mono text-xs border border-gray-200 hover:bg-white">
                      #{vehicle.stockNumber}
                    </Badge>
                  )}
                  
                  {/* New/Featured Badges - Top Right (moved slightly to accommodate stock number) */}
                  {(vehicle.isNew || vehicle.isFeatured) && (
                    <Badge className={`absolute top-2 right-2 ${vehicle.isNew ? 'bg-primary' : 'bg-yellow-500'} hover:opacity-90`}>
                      {vehicle.isNew ? 'New Arrival' : 'Featured'}
                    </Badge>
                  )}
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          {imageUrls.length > 1 && (
            <>
              <CarouselPrevious className="left-2" />
              <CarouselNext className="right-2" />
            </>
          )}
        </Carousel>
      </CardHeader>

      <CardContent className="p-4 flex-grow">
        <CardTitle className="text-xl font-bold mb-1 line-clamp-2 min-h-[56px]">
          {vehicle.year} {vehicle.make} {vehicle.model}
        </CardTitle>
        <p className="text-2xl font-extrabold text-primary mb-3">
          {formatPrice(vehicle.price)}
        </p>

        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-muted-foreground">
          <div className="flex items-center">
            <Gauge className="h-4 w-4 mr-2 text-primary" />
            <span>{formatMileage(vehicle.mileage)} mi</span>
          </div>
          <div className="flex items-center">
            <Fuel className="h-4 w-4 mr-2 text-primary" />
            <span>{vehicle.fuelType}</span>
          </div>
          <div className="flex items-center">
            <Car className="h-4 w-4 mr-2 text-primary" />
            <span>{vehicle.transmission}</span>
          </div>
          <div className="flex items-center">
            <Calendar className="h-4 w-4 mr-2 text-primary" />
            <span>{vehicle.year}</span>
          </div>
        </div>
      </CardContent>

      <CardFooter className="p-4 pt-0 flex justify-between gap-2">
        <Button 
          className="flex-1 bg-automotive-gold hover:bg-automotive-gold/90 text-primary font-semibold shadow-lg hover:shadow-xl transition-all duration-300" 
          onClick={() => onViewDetails(vehicle.id)}
        >
          <Maximize className="h-4 w-4 mr-2" />
          View Details
        </Button>
        <Button 
          className="flex-1" 
          onClick={() => onScheduleTest(vehicle.id)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Schedule Test
        </Button>
      </CardFooter>
    </Card>
  );
};

export default VehicleCard;

// Re-export the Vehicle type
export type { Vehicle };