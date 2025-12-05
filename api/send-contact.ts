// api/send-contact.js
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { name, email, phone, message, subject, preferredContact } = req.body;

  const clicksUsername = process.env.CLICKSEND_USERNAME;
  const clicksApiKey = process.env.CLICKSEND_API_KEY;
  const notificationPhone = process.env.NOTIFICATION_PHONE;
  const notificationEmail = process.env.NOTIFICATION_EMAIL; // Updated to use environment variable

  if (!clicksUsername || !clicksApiKey || !notificationPhone) {
    return res.status(500).json({ error: "Missing environment variables" });
  }

  try {
    const authString = Buffer.from(`${clicksUsername}:${clicksApiKey}`).toString('base64');

    // SMS Payload
    const smsPayload = {
      messages: [
        {
          from: "+18448815243",
          to: notificationPhone,
          body: `New Contact Form\n\n` +
                `Name: ${name || 'N/A'}\n` +
                `Email: ${email || 'N/A'}\n` +
                `Phone: ${phone || 'N/A'}\n` +
                `Subject: ${subject || 'N/A'}\n` +
                `Preferred: ${preferredContact || 'N/A'}\n\n` +
                `Message: ${message || 'N/A'}`
        }
      ]
    };

    // Email Payload with verified email_address_id
    const emailPayload = {
      from: {
        email_address_id: 32138,
        name: "Cece Auto"
      },
      to: [
        {
          email: notificationEmail,
          name: "Cece Auto"
        }
      ],
      subject: `New Contact Form - ${subject || 'General Inquiry'}`,
      body: `NEW CONTACT FORM SUBMISSION\n` +
            `================================\n\n` +
            `Name: ${name || 'N/A'}\n` +
            `Email: ${email || 'N/A'}\n` +
            `Phone: ${phone || 'N/A'}\n` +
            `Subject: ${subject || 'N/A'}\n` +
            `Preferred Contact: ${preferredContact || 'N/A'}\n\n` +
            `MESSAGE:\n` +
            `--------\n` +
            `${message || 'No message'}\n\n` +
            `================================\n` +
            `Submitted: ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })}`
    };

    console.log("ClickSend SMS Payload:", JSON.stringify(smsPayload, null, 2));
    console.log("ClickSend Email Payload:", JSON.stringify(emailPayload, null, 2));

    // Send SMS
    const smsResponse = await fetch("https://rest.clicksend.com/v3/sms/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${authString}`
      },
      body: JSON.stringify(smsPayload)
    });

    const smsData = await smsResponse.json();

    // Send Email
    const emailResponse = await fetch("https://rest.clicksend.com/v3/email/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${authString}`
      },
      body: JSON.stringify(emailPayload)
    });

    const emailData = await emailResponse.json();

    const responseDetails = {
      sms: {
        status: smsResponse.status,
        body: smsData
      },
      email: {
        status: emailResponse.status,
        body: emailData
      }
    };

    console.log("ClickSend Response:", JSON.stringify(responseDetails, null, 2));

    const smsSuccess = smsResponse.ok;
    const emailSuccess = emailResponse.ok;

    if (!smsSuccess || !emailSuccess) {
      return res.status(500).json({
        error: "Failed to send notification",
        smsSuccess,
        emailSuccess,
        responseDetails
      });
    }

    return res.status(200).json({
      success: true,
      message: "SMS and Email sent successfully",
      smsSuccess,
      emailSuccess,
      responseDetails
    });

  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({
      error: "Failed to send notification",
      details: error.message
    });
  }
}