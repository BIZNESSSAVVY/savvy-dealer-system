import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '@/firebaseConfig';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';

// Your dealership info - CHANGE THESE!
const DEALERSHIP_NAME = 'Savvy Dealer System';
const GOOGLE_REVIEW_LINK = 'https://g.page/r/YOUR_GOOGLE_REVIEW_LINK/review';
const MANAGER_PHONE = '(302) 409-4992';

// Define types
interface VehicleData {
  id: string;
  customerName: string;
  customerPhone: string;
  year: number;
  make: string;
  model: string;
  feedbackSubmitted?: boolean;
  feedbackToken?: string;
}

const Feedback: React.FC = () => {
  const params = useParams<{ token?: string }>();
  const navigate = useNavigate();
  
  // Get token from URL params or query string
  const searchParams = new URLSearchParams(window.location.search);
  const token = params.token || searchParams.get('token');

  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [vehicleData, setVehicleData] = useState<VehicleData | null>(null);
  const [step, setStep] = useState<'sentiment' | 'feedback' | 'complete'>('sentiment');
  const [sentiment, setSentiment] = useState<'positive' | 'neutral' | 'negative' | ''>('');
  const [feedbackText, setFeedbackText] = useState<string>('');
  const [error, setError] = useState<string>('');

  // 1. VALIDATE TOKEN AND FETCH VEHICLE DATA
  useEffect(() => {
    async function validateToken() {
      if (!token) {
        setError('No feedback token provided');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        console.log('🔄 Validating token:', token);
        
        // Query sold_vehicles collection for matching feedbackToken
        const soldVehiclesRef = collection(db, 'sold_vehicles');
        const q = query(soldVehiclesRef, where('feedbackToken', '==', token));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
          // Try direct document ID as fallback
          try {
            const vehicleDoc = await getDoc(doc(db, 'sold_vehicles', token));
            if (vehicleDoc.exists()) {
              const data = vehicleDoc.data() as VehicleData;
              if (data.feedbackSubmitted) {
                setError('Feedback already submitted. Thank you!');
              } else {
                setVehicleData(data);
              }
            } else {
              setError('Invalid or expired feedback link');
            }
          } catch (fallbackError) {
            setError('Invalid feedback link. Please check the URL.');
          }
        } else {
          // Found by feedbackToken field
          const doc = querySnapshot.docs[0];
          const data = doc.data() as VehicleData;
          
          if (data.feedbackSubmitted) {
            setError('Feedback already submitted. Thank you!');
          } else {
            setVehicleData({ id: doc.id, ...data });
          }
        }

      } catch (error) {
        console.error('❌ Error validating token:', error);
        setError('Unable to load feedback form');
      } finally {
        setLoading(false);
      }
    }

    validateToken();
  }, [token]);

  // 2. HANDLE SENTIMENT SELECTION
  const handleSentimentSelect = (selectedSentiment: 'positive' | 'neutral' | 'negative') => {
    setSentiment(selectedSentiment);
    
    // Positive → Go directly to Google
    if (selectedSentiment === 'positive') {
      handlePositiveFeedback();
    } 
    // Neutral/Negative → Show feedback form
    else {
      setStep('feedback');
    }
  };

  // 3. POSITIVE FEEDBACK → REDIRECT TO GOOGLE
  const handlePositiveFeedback = async () => {
    try {
      setSubmitting(true);
      
      // Update Firestore record
      if (vehicleData && vehicleData.id) {
        const soldVehiclesRef = doc(db, 'sold_vehicles', vehicleData.id);
        await updateDoc(soldVehiclesRef, {
          feedbackSubmitted: true,
          feedbackSentiment: 'positive',
          feedbackSubmittedAt: new Date().toISOString(),
          status: 'google_redirected'
        });
      }

      // Redirect to Google Reviews
      window.location.href = GOOGLE_REVIEW_LINK;

    } catch (error) {
      console.error('❌ Error updating positive feedback:', error);
      alert('Unable to save feedback. Please try again.');
    }
  };

  // 4. NEUTRAL/NEGATIVE FEEDBACK → SAVE AND SHOW APOLOGY
  const handleSubmitFeedback = async () => {
    if (!feedbackText.trim()) {
      alert('Please share your experience to help us improve');
      return;
    }

    try {
      setSubmitting(true);

      // Update Firestore record
      if (vehicleData && vehicleData.id) {
        const soldVehiclesRef = doc(db, 'sold_vehicles', vehicleData.id);
        await updateDoc(soldVehiclesRef, {
          feedbackSubmitted: true,
          feedbackSentiment: sentiment,
          feedbackText: feedbackText,
          feedbackSubmittedAt: new Date().toISOString(),
          status: 'needs_followup',
          managerAlert: true,
          alertTime: new Date().toISOString()
        });
      }

      // Move to completion step
      setStep('complete');

    } catch (error) {
      console.error('❌ Error submitting feedback:', error);
      alert('Unable to submit feedback. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // 5. RENDER LOADING/ERROR STATES
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg w-full max-w-md">
          <div className="p-6">
            <div className="flex flex-col items-center justify-center space-y-4 py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <p className="text-lg font-medium">Loading feedback form...</p>
              <p className="text-sm text-gray-500">Validating your link</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg w-full max-w-md">
          <div className="border-b p-6">
            <h2 className="text-2xl font-bold flex items-center gap-2 text-red-600">
              <span className="text-2xl">⚠️</span> Unable to Load Form
            </h2>
          </div>
          <div className="p-6">
            <p className="text-gray-600">{error}</p>
            <button 
              onClick={() => navigate('/')}
              className="w-full mt-4 bg-blue-600 text-white px-4 py-2 rounded font-medium hover:bg-blue-700 transition"
            >
              Return to Homepage
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 6. MAIN RENDER
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-lg">
        <div className="border-b p-6 text-center">
          <h2 className="text-2xl font-bold">
            {step === 'sentiment' ? 'How was your experience?' : 
             step === 'feedback' ? 'Help us improve' :
             'Thank you for your feedback'}
          </h2>
          <p className="text-gray-600 mt-2">
            {step === 'sentiment' && vehicleData && 
              `with your ${vehicleData.year} ${vehicleData.make} ${vehicleData.model} from ${DEALERSHIP_NAME}`}
            {step === 'feedback' && 
              'Please share details so we can make it right'}
            {step === 'complete' && 
              'We appreciate your honesty and will address your concerns'}
          </p>
        </div>

        <div className="p-6">
          {/* STEP 1: SENTIMENT SELECTION */}
          {step === 'sentiment' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* VERY HAPPY */}
                <button
                  onClick={() => handleSentimentSelect('positive')}
                  className="flex flex-col items-center justify-between rounded-lg border-2 border-gray-200 p-4 hover:border-green-500 hover:bg-green-50 transition cursor-pointer"
                >
                  <span className="text-4xl">👍</span>
                  <span className="font-semibold mt-2">Very Happy</span>
                  <span className="text-sm text-gray-500 text-center mt-2">
                    Share your 5-star experience on Google
                  </span>
                </button>

                {/* NEUTRAL */}
                <button
                  onClick={() => handleSentimentSelect('neutral')}
                  className="flex flex-col items-center justify-between rounded-lg border-2 border-gray-200 p-4 hover:border-yellow-500 hover:bg-yellow-50 transition cursor-pointer"
                >
                  <span className="text-4xl">😐</span>
                  <span className="font-semibold mt-2">Neutral / Okay</span>
                  <span className="text-sm text-gray-500 text-center mt-2">
                    Share private feedback to help us improve
                  </span>
                </button>

                {/* BAD EXPERIENCE */}
                <button
                  onClick={() => handleSentimentSelect('negative')}
                  className="flex flex-col items-center justify-between rounded-lg border-2 border-gray-200 p-4 hover:border-red-500 hover:bg-red-50 transition cursor-pointer"
                >
                  <span className="text-4xl">👎</span>
                  <span className="font-semibold mt-2">Needs Improvement</span>
                  <span className="text-sm text-gray-500 text-center mt-2">
                    Tell us what went wrong (manager will contact you)
                  </span>
                </button>
              </div>

              <div className="text-center text-sm text-gray-500">
                <p>Your honest feedback helps us serve you better</p>
              </div>
            </div>
          )}

          {/* STEP 2: FEEDBACK FORM (Neutral/Negative) */}
          {step === 'feedback' && (
            <div className="space-y-6">
              <div className={`p-4 rounded border ${sentiment === 'negative' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-yellow-50 border-yellow-200 text-yellow-800'}`}>
                <div className="flex items-start gap-3">
                  <span className="text-2xl">⚠️</span>
                  <div>
                    <p className="font-medium">
                      {sentiment === 'negative' ? 'We sincerely apologize' : 'Thanks for being honest'}
                    </p>
                    <p className="text-sm mt-1">
                      {sentiment === 'negative' 
                        ? 'Please share what happened. Our manager will contact you within 24 hours.'
                        : 'What could we have done better? We value your input.'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Your experience:
                </label>
                <textarea
                  placeholder={
                    sentiment === 'negative' 
                      ? "What went wrong? We want to make this right..."
                      : "What could we improve? Your suggestions help us..."
                  }
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  disabled={submitting}
                  className="w-full border rounded p-3 min-h-[150px]"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep('sentiment')}
                  disabled={submitting}
                  className="flex-1 border border-gray-300 text-gray-700 px-4 py-2 rounded font-medium hover:bg-gray-50 transition disabled:opacity-50"
                >
                  Back
                </button>
                <button
                  onClick={handleSubmitFeedback}
                  disabled={submitting || !feedbackText.trim()}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded font-medium hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {submitting ? 'Submitting...' : 'Submit Feedback'}
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: COMPLETION (Neutral/Negative) */}
          {step === 'complete' && (
            <div className="space-y-6 text-center">
              <div className="flex justify-center">
                <span className="text-6xl">✅</span>
              </div>

              <div className="space-y-3">
                <h3 className="text-xl font-semibold">Thank You for Your Feedback</h3>
                
                {sentiment === 'negative' ? (
                  <>
                    <div className="p-4 bg-red-50 rounded border border-red-200 text-left">
                      <p className="font-medium text-red-800">⚠️ Manager Alert Sent</p>
                      <p className="text-sm text-red-700 mt-1">
                        Our manager <strong>{DEALERSHIP_NAME}</strong> has been notified and will contact you at{' '}
                        <strong>{vehicleData?.customerPhone || 'your provided number'}</strong> within 24 hours.
                      </p>
                    </div>
                    <p className="text-gray-600">
                      We take your concerns seriously and will work to resolve this immediately.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="p-4 bg-green-50 rounded border border-green-200 text-left">
                      <p className="font-medium text-green-800">📝 Feedback Received</p>
                      <p className="text-sm text-green-700 mt-1">
                        Your suggestions have been forwarded to our management team for review.
                        We'll use your input to improve our service.
                      </p>
                    </div>
                    <p className="text-gray-600">
                      Your honest feedback helps us serve our customers better.
                    </p>
                  </>
                )}

                <div className="pt-4">
                  <button
                    onClick={() => navigate('/')}
                    className="w-full bg-blue-600 text-white px-4 py-2 rounded font-medium hover:bg-blue-700 transition"
                  >
                    Return to {DEALERSHIP_NAME} Website
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="px-6 pb-6 pt-4 border-t text-center">
          <p className="text-xs text-gray-500">
            {step !== 'complete' && 'Your feedback is confidential and only shared with our management team.'}
            {DEALERSHIP_NAME} • {MANAGER_PHONE}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Feedback;