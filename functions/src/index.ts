import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import axios from 'axios';

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

interface SoldVehicle {
    customerName: string;
    customerPhone: string;
    year: number;
    make: string;
    model: string;
    requestFeedback?: boolean;
    feedbackSent?: boolean;
    dateSold?: string;
    [key: string]: unknown;
}

interface ClickSendResponse {
    response_code: string;
    [key: string]: unknown;
}

interface ManagerAlertRequest {
    customerName: string;
    customerPhone: string;
    vehicle: string;
    feedback: string;
}

const WEBSITE_URL = 'https://savvy-dealer-system.vercel.app';

// ================ CONFIGURATION ================
const CLICKSEND_URL = 'https://rest.clicksend.com/v3/sms/send';
const DEALERSHIP_NAME = 'Savvy Dealer System';
const FEEDBACK_BASE_URL = 'https://savvy-dealer-system.vercel.app/feedback';

// Get ClickSend credentials from environment variables
const CLICKSEND_USERNAME = process.env.CLICKSEND_USERNAME || '';
const CLICKSEND_API_KEY = process.env.CLICKSEND_API_KEY || '';
const CLICKSEND_MANAGER_PHONE = process.env.CLICKSEND_MANAGER_PHONE || '+13024094992';

// ================ FACEBOOK FEED ================
export const facebookFeed = onRequest(async (req, res) => {
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

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Feed error:', errorMessage);
        res.status(500).send('Error generating feed');
    }
});

// ================ DAILY FEEDBACK REQUESTS ================
export const sendDailyFeedbackRequests = onSchedule({
    schedule: '0 10 * * *',
    timeZone: 'America/New_York',
}, async () => {
    console.log('Starting daily feedback request check...');
    
    try {
        if (!CLICKSEND_USERNAME || !CLICKSEND_API_KEY) {
            console.error('Missing ClickSend credentials');
            return;
        }

        const soldVehiclesRef = admin.firestore().collection('sold_vehicles');
        const snapshot = await soldVehiclesRef
            .where('requestFeedback', '==', true)
            .where('feedbackSent', '!=', true)
            .get();

        console.log(`Found ${snapshot.size} vehicles ready for feedback`);

        let successCount = 0;
        let failCount = 0;

        for (const doc of snapshot.docs) {
            try {
                const vehicle = doc.data() as SoldVehicle;
                
                const feedbackToken = Math.random().toString(36).substring(2, 15);
                const feedbackLink = `${FEEDBACK_BASE_URL}?token=${feedbackToken}`;
                
                const message = `Hi ${vehicle.customerName}, thanks for your ${vehicle.year} ${vehicle.make} ${vehicle.model} from ${DEALERSHIP_NAME}! We'd love your feedback: ${feedbackLink}`;
                
                const smsSent = await sendClickSendSMS(vehicle.customerPhone, message);

                if (smsSent) {
                    await doc.ref.update({
                        feedbackSent: true,
                        feedbackToken: feedbackToken,
                        feedbackSentAt: new Date().toISOString(),
                        feedbackLink: feedbackLink,
                        smsStatus: 'sent'
                    });
                    console.log(`SMS sent to ${vehicle.customerName}`);
                    successCount++;
                } else {
                    await doc.ref.update({ smsStatus: 'failed' });
                    console.log(`Failed to send to ${vehicle.customerName}`);
                    failCount++;
                }

            } catch (error: unknown) {
                console.error(`Error processing vehicle ${doc.id}:`, error);
                failCount++;
            }
        }

        console.log(`Daily feedback job: ${successCount} sent, ${failCount} failed`);

    } catch (error: unknown) {
        console.error('Critical error in daily feedback job:', error);
    }
});

// ================ TEST FEEDBACK FUNCTION ================
export const testFeedback = onRequest(async (req, res) => {
    try {
        console.log('Test feedback function triggered');
        
        if (!CLICKSEND_USERNAME || !CLICKSEND_API_KEY) {
            res.status(500).send('ClickSend credentials not configured');
            return;
        }

        const soldVehiclesRef = admin.firestore().collection('sold_vehicles');
        const snapshot = await soldVehiclesRef
            .where('requestFeedback', '==', true)
            .where('feedbackSent', '!=', true)
            .limit(1)
            .get();

        if (snapshot.empty) {
            res.status(404).send('No pending feedback requests found');
            return;
        }

        const doc = snapshot.docs[0];
        const vehicle = doc.data() as SoldVehicle;
        
        const feedbackToken = Math.random().toString(36).substring(2, 15);
        const feedbackLink = `${FEEDBACK_BASE_URL}?token=${feedbackToken}`;
        
        const message = `TEST from ${DEALERSHIP_NAME}: Hi ${vehicle.customerName}, thanks for your ${vehicle.year} ${vehicle.make} ${vehicle.model}! Share your experience: ${feedbackLink}`;
        
        const smsSent = await sendClickSendSMS(vehicle.customerPhone, message);

        if (smsSent) {
            await doc.ref.update({
                feedbackSent: true,
                feedbackToken: feedbackToken,
                feedbackSentAt: new Date().toISOString(),
                feedbackLink: feedbackLink,
                smsStatus: 'test_sent'
            });
            res.send(`TEST SMS sent to ${vehicle.customerName} for ${vehicle.make} ${vehicle.model}`);
        } else {
            res.status(500).send('Failed to send test SMS');
        }

    } catch (error: unknown) {
        console.error('Test error:', error);
        res.status(500).send('Test failed');
    }
});

// ================ SEND MANAGER ALERT ================
export const sendManagerAlert = onRequest(async (req, res) => {
    try {
        if (req.method !== 'POST') {
            res.status(405).send('Method not allowed');
            return;
        }

        const requestBody = req.body as ManagerAlertRequest;
        const { customerName, customerPhone, vehicle, feedback } = requestBody;
        
        if (!CLICKSEND_USERNAME || !CLICKSEND_API_KEY) {
            res.status(500).send('ClickSend credentials not configured');
            return;
        }

        const managerMessage = `NEGATIVE FEEDBACK ALERT: ${customerName} (${customerPhone}) for ${vehicle}. Feedback: "${feedback.substring(0, 150)}..."`;
        
        const smsSent = await sendClickSendSMS(CLICKSEND_MANAGER_PHONE, managerMessage);

        if (smsSent) {
            const alertsRef = admin.firestore().collection('manager_alerts');
            await alertsRef.add({
                type: 'negative_feedback',
                customerName,
                customerPhone,
                vehicle,
                feedback,
                createdAt: new Date().toISOString(),
                status: 'unread',
                priority: 'high',
                smsSent: true
            });

            res.status(200).json({ success: true, message: 'Manager alerted via SMS' });
        } else {
            res.status(500).json({ success: false, message: 'Failed to send manager alert' });
        }

    } catch (error: unknown) {
        console.error('Manager alert error:', error);
        res.status(500).send('Error sending manager alert');
    }
});

// ================ HELPER FUNCTIONS ================
async function sendClickSendSMS(toNumber: string, message: string): Promise<boolean> {
    try {
        if (!CLICKSEND_USERNAME || !CLICKSEND_API_KEY) {
            console.error('Missing ClickSend credentials');
            return false;
        }

        const cleanNumber = toNumber.replace(/\D/g, '');
        if (!cleanNumber || cleanNumber.length < 10) {
            console.error(`Invalid phone number: ${toNumber}`);
            return false;
        }

        const response = await axios.post<ClickSendResponse>(
            CLICKSEND_URL,
            {
                messages: [{
                    source: 'php',
                    body: message,
                    to: cleanNumber
                }]
            },
            {
                auth: {
                    username: CLICKSEND_USERNAME,
                    password: CLICKSEND_API_KEY
                },
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );

        return response.data.response_code === 'SUCCESS';

    } catch (error: unknown) {
        console.error('ClickSend API Error:', error);
        return false;
    }
}

// ================ FACEBOOK FEED HELPER FUNCTIONS ================
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
            <component name="addr1">102 USA BLVD</component>
            <component name="city">USA</component>
            <component name="region">US</component>
            <component name="postal_code">12345</component>
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
    
    const validStyles = [
        'CONVERTIBLE', 'COUPE', 'CROSSOVER', 'HATCHBACK', 
        'MINIBUS', 'MINIVAN', 'PICKUP', 'SEDAN', 'SUV', 
        'TRUCK', 'VAN', 'WAGON', 'OTHER'
    ];
    
    if (validStyles.includes(s)) return s;
    
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