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

interface SendReviewRequest {
    customerName: string;
    customerPhone: string;
    vehicleYear: number;
    vehicleMake: string;
    vehicleModel: string;
    soldVehicleId: string;
}

const WEBSITE_URL = 'https://savvy-dealer-system.vercel.app';
const CLICKSEND_URL = 'https://rest.clicksend.com/v3/sms/send';
const DEALERSHIP_NAME = 'Savvy Dealer System';
const FEEDBACK_BASE_URL = 'https://savvy-dealer-system.vercel.app/feedback';

const CLICKSEND_USERNAME = process.env.CLICKSEND_USERNAME || '';
const CLICKSEND_API_KEY = process.env.CLICKSEND_API_KEY || '';
const CLICKSEND_MANAGER_PHONE = process.env.CLICKSEND_MANAGER_PHONE || '+13024094992';

// ================ SEND REVIEW LINK (CALLED IMMEDIATELY) ================
export const sendReviewLink = onRequest({ cors: true }, async (req, res) => {
    try {
        if (req.method !== 'POST') {
            res.status(405).json({ success: false, message: 'Method not allowed' });
            return;
        }

        const body = req.body as SendReviewRequest;
        const { customerName, customerPhone, vehicleYear, vehicleMake, vehicleModel, soldVehicleId } = body;

        if (!customerName || !customerPhone || !vehicleYear || !vehicleMake || !vehicleModel || !soldVehicleId) {
            res.status(400).json({ success: false, message: 'Missing required fields' });
            return;
        }

        if (!CLICKSEND_USERNAME || !CLICKSEND_API_KEY) {
            console.error('Missing ClickSend credentials');
            res.status(500).json({ success: false, message: 'SMS service not configured' });
            return;
        }

        // Validate phone number
        const cleanNumber = customerPhone.replace(/\D/g, '');
        if (cleanNumber.length < 10) {
            res.status(400).json({ success: false, message: 'Invalid phone number' });
            return;
        }

        // Generate unique feedback token
        const feedbackToken = `${soldVehicleId}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const feedbackLink = `${FEEDBACK_BASE_URL}?token=${feedbackToken}`;

        const message = `Hi ${customerName}, thank you for your recent purchase of the ${vehicleYear} ${vehicleMake} ${vehicleModel} from ${DEALERSHIP_NAME}. We value your feedback: ${feedbackLink}`;

        console.log(`Sending review link to ${customerPhone}`);
        const smsSent = await sendClickSendSMS(customerPhone, message);

        if (smsSent) {
            // Update sold vehicle record
            await admin.firestore().collection('sold_vehicles').doc(soldVehicleId).update({
                feedbackToken: feedbackToken,
                feedbackLink: feedbackLink,
                feedbackSent: true,
                feedbackSentAt: admin.firestore.FieldValue.serverTimestamp(),
                smsStatus: 'sent'
            });

            console.log(`✓ Review link sent successfully to ${customerPhone}`);
            res.status(200).json({ 
                success: true, 
                message: 'Review link sent successfully',
                feedbackLink: feedbackLink
            });
        } else {
            // Update with failure status
            await admin.firestore().collection('sold_vehicles').doc(soldVehicleId).update({
                smsStatus: 'failed',
                lastAttempt: admin.firestore.FieldValue.serverTimestamp()
            });

            console.error(`✗ Failed to send review link to ${customerPhone}`);
            res.status(500).json({ success: false, message: 'Failed to send SMS' });
        }

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Error sending review link:', errorMessage);
        res.status(500).json({ success: false, message: 'Error sending review link', error: errorMessage });
    }
});

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

// ================ TEST FEEDBACK FUNCTION ================
export const testFeedback = onRequest({ cors: true }, async (req, res) => {
    try {
        console.log('Test feedback function triggered');

        if (!CLICKSEND_USERNAME || !CLICKSEND_API_KEY) {
            res.status(500).json({ success: false, message: 'ClickSend credentials not configured' });
            return;
        }

        const testPhone = process.env.TEST_PHONE || CLICKSEND_MANAGER_PHONE;
        const feedbackToken = `test_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const feedbackLink = `${FEEDBACK_BASE_URL}?token=${feedbackToken}`;

        const message = `TEST from ${DEALERSHIP_NAME}: Hi Test Customer, thanks for your 2024 Test Make Test Model! Share your experience: ${feedbackLink}`;

        console.log(`Sending test SMS to ${testPhone}`);
        const smsSent = await sendClickSendSMS(testPhone, message);

        if (smsSent) {
            res.status(200).json({
                success: true,
                message: `Test SMS sent to ${testPhone}`,
                content: message,
                link: feedbackLink
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Failed to send test SMS'
            });
        }

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Test error:', errorMessage);
        res.status(500).json({
            success: false,
            message: 'Test failed',
            error: errorMessage
        });
    }
});

// ================ SEND MANAGER ALERT ================
export const sendManagerAlert = onRequest({ cors: true }, async (req, res) => {
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

        console.log(`Sending manager alert: ${managerMessage}`);
        const smsSent = await sendClickSendSMS(CLICKSEND_MANAGER_PHONE, managerMessage);

        if (smsSent) {
            const alertsRef = admin.firestore().collection('manager_alerts');
            await alertsRef.add({
                type: 'negative_feedback',
                customerName,
                customerPhone,
                vehicle,
                feedback,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                status: 'unread',
                priority: 'high',
                smsSent: true
            });

            res.status(200).json({ success: true, message: 'Manager alerted via SMS' });
        } else {
            res.status(500).json({ success: false, message: 'Failed to send manager alert' });
        }

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Manager alert error:', errorMessage);
        res.status(500).json({ success: false, message: 'Error sending manager alert', error: errorMessage });
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
        if (cleanNumber.length < 10) {
            console.error(`Invalid phone number: ${toNumber}`);
            return false;
        }

        // Format as E.164
        const formattedNumber = cleanNumber.startsWith('1') ? `+${cleanNumber}` : `+1${cleanNumber}`;

        console.log(`Attempting ClickSend SMS to ${formattedNumber}`);
        console.log(`Message: ${message.substring(0, 50)}...`);

        const response = await axios.post<ClickSendResponse>(
            CLICKSEND_URL,
            {
                messages: [{
                    source: 'firebase',
                    body: message,
                    to: formattedNumber
                }]
            },
            {
                auth: {
                    username: CLICKSEND_USERNAME,
                    password: CLICKSEND_API_KEY
                },
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 15000
            }
        );

        console.log(`ClickSend Response:`, JSON.stringify(response.data, null, 2));

        const success = response.data.response_code === 'SUCCESS';
        if (success) {
            console.log(`✓ SMS sent successfully to ${formattedNumber}`);
        } else {
            console.error(`✗ ClickSend returned non-success: ${response.data.response_code}`);
        }

        return success;

    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            console.error('ClickSend API Error:', {
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: JSON.stringify(error.response?.data, null, 2),
                message: error.message
            });
        } else {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('ClickSend Error:', errorMessage);
        }
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