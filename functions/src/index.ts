import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

interface Vehicle {
    id: string;
    make: string;
    model: string;
    year: number;
    price: number;
    mileage: number;
    vin: string;
    description: string;
    images: string[];
    stockNumber?: string;
    exteriorColor?: string;
    interiorColor?: string;
    transmission?: string;
    fuelType?: string;
    isNew?: boolean;
    bodyStyle?: string;
}

const WEBSITE_URL = 'https://ceceauto.com';

export const facebookFeed = functions.https.onRequest(async (req, res) => {
    try {
        const snapshot = await admin.firestore().collection('vehicles').get();
        const vehicles: Vehicle[] = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as Vehicle));

        const xml = generateFacebookFeed(vehicles);

        res.set('Content-Type', 'application/xml');
        res.set('Cache-Control', 'public, max-age=3600');
        res.status(200).send(xml);

    } catch (error) {
        console.error('Feed error:', error);
        res.status(500).send('Error generating feed');
    }
});

function generateFacebookFeed(vehicles: Vehicle[]): string {
    const listings = vehicles.map(v => {
        const mainImage = v.images?.[0] || '';
        const additionalImages = (v.images || []).slice(1, 10)
            .map(img => `        <image>
            <url>${escapeXml(img)}</url>
            <tag>Additional</tag>
        </image>`)
            .join('\n');

        const condition = v.isNew ? 'NEW' : 'USED';
        const bodyStyle = mapBodyStyle(v.bodyStyle);
        const description = v.description?.trim() || `${condition === 'NEW' ? 'Brand new' : 'Excellent condition'} ${v.year} ${v.make} ${v.model}. Contact Savvy Dealer System Sales for details.`;
        const vehicleId = v.stockNumber || v.id;

        return `    <listing>
        <vehicle_id>${escapeXml(vehicleId)}</vehicle_id>
        <vin>${escapeXml(v.vin || '')}</vin>
        <availability>AVAILABLE</availability>
        <make>${escapeXml(v.make)}</make>
        <model>${escapeXml(v.model)}</model>
        <year>${v.year}</year>
        <mileage>
            <value>${v.mileage}</value>
            <unit>MI</unit>
        </mileage>
        <price>${v.price} USD</price>
        <state_of_vehicle>${condition}</state_of_vehicle>
        <body_style>${bodyStyle}</body_style>
        <title>${escapeXml(`${v.year} ${v.make} ${v.model}`)}</title>
        <description>${escapeXml(description)}</description>
        <url>${escapeXml(`${WEBSITE_URL}/inventory/${v.id}`)}</url>
        <image>
            <url>${escapeXml(mainImage)}</url>
            <tag>Main</tag>
        </image>
${additionalImages}
        <exterior_color>${escapeXml(v.exteriorColor || 'Not Specified')}</exterior_color>
        <interior_color>${escapeXml(v.interiorColor || 'Not Specified')}</interior_color>
        <transmission>${escapeXml(v.transmission || 'Automatic')}</transmission>
        <fuel_type>${mapFuel(v.fuelType)}</fuel_type>
        <drivetrain>${mapDrivetrain(v.transmission)}</drivetrain>
        <address format="simple">
            <component name="addr1">102 Lombard</component>
            <component name="city">Felton</component>
            <component name="region">DE</component>
            <component name="postal_code">19943</component>
            <component name="country">US</component>
        </address>
        <dealer_name>Savvy Dealer System Sales</dealer_name>
        <dealer_phone>(302) 409-4992</dealer_phone>
    </listing>`;
    }).join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<listings>
    <title>Savvy Dealer System Sales - Vehicle Inventory</title>
    <link rel="self" href="${WEBSITE_URL}"/>
${listings}
</listings>`;
}

function escapeXml(str: string): string {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function mapFuel(fuel?: string): string {
    if (!fuel) return 'GASOLINE';
    const f = fuel.toLowerCase();
    if (f.includes('electric')) return 'ELECTRIC';
    if (f.includes('diesel')) return 'DIESEL';
    if (f.includes('hybrid')) return 'HYBRID';
    if (f.includes('flex')) return 'FLEX';
    return 'GASOLINE';
}

function mapBodyStyle(style?: string): string {
    if (!style) return 'OTHER';
    const s = style.toUpperCase().trim();
    
    // Valid Facebook values
    const validStyles = [
        'CONVERTIBLE', 'COUPE', 'CROSSOVER', 'HATCHBACK', 
        'MINIBUS', 'MINIVAN', 'PICKUP', 'SEDAN', 'SUV', 
        'TRUCK', 'VAN', 'WAGON', 'OTHER'
    ];
    
    if (validStyles.includes(s)) return s;
    
    // Map common variations
    if (s.includes('SPORT') && s.includes('UTILITY')) return 'SUV';
    if (s.includes('MPV') || s.includes('MULTIPURPOSE')) return 'MINIVAN';
    
    return 'OTHER';
}

function mapDrivetrain(transmission?: string): string {
    if (!transmission) return 'FWD';
    const t = transmission.toUpperCase();
    
    if (t.includes('4WD') || t.includes('4X4')) return '4WD';
    if (t.includes('AWD')) return 'AWD';
    if (t.includes('RWD')) return 'RWD';
    
    return 'FWD';
}