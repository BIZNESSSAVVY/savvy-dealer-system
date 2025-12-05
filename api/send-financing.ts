// api/send-financing.js
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const formData = req.body;

  const clicksUsername = process.env.CLICKSEND_USERNAME;
  const clicksApiKey = process.env.CLICKSEND_API_KEY;
  const notificationPhone = process.env.NOTIFICATION_PHONE;
  const notificationEmail = process.env.NOTIFICATION_EMAIL;

  if (!clicksUsername || !clicksApiKey || !notificationPhone) {
    return res.status(500).json({ error: "Missing environment variables" });
  }

  try {
    const authString = Buffer.from(`${clicksUsername}:${clicksApiKey}`).toString('base64');
    const fullName = `${formData.firstName || ''}${formData.middleName ? ' ' + formData.middleName : ''} ${formData.lastName || ''}`.trim();

    // SMS Payload (keeping it short for SMS)
    const smsPayload = {
      messages: [
        {
          from: "+18448815243",
          to: notificationPhone,
          body: `New Financing Application\n\n` +
                `Name: ${fullName || 'N/A'}\n` +
                `Email: ${formData.email || 'N/A'}\n` +
                `Phone: ${formData.mobilePhone || 'N/A'}\n` +
                `Vehicle: ${formData.vehicleToFinance || 'N/A'}\n` +
                `Amount Required: ${formData.amountRequired || 'N/A'}\n` +
                `Downpayment: ${formData.downpayment || 'N/A'}\n\n` +
                `Additional Comments: ${formData.additionalComments || 'None'}`
        }
      ]
    };

    // Email Payload with HTML formatting
    const emailHtml = `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; background-color: #f4f4f4; }
    .container { background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    h1 { color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; margin-bottom: 20px; }
    h2 { color: #34495e; background-color: #ecf0f1; padding: 10px 15px; margin-top: 25px; margin-bottom: 15px; border-left: 4px solid #3498db; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    td { padding: 10px; border-bottom: 1px solid #e0e0e0; }
    td:first-child { font-weight: bold; color: #555; width: 40%; }
    td:last-child { color: #333; }
    .highlight { background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107; }
    .timestamp { text-align: right; color: #7f8c8d; font-size: 14px; margin-top: 30px; padding-top: 20px; border-top: 2px solid #ecf0f1; }
    .consent-yes { color: #27ae60; font-weight: bold; }
    .consent-no { color: #e74c3c; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <h1>NEW CREDIT APPLICATION</h1>

    <h2>Applicant Information</h2>
    <table>
      <tr><td>First Name</td><td>${formData.firstName || 'N/A'}</td></tr>
      <tr><td>Middle Name</td><td>${formData.middleName || 'N/A'}</td></tr>
      <tr><td>Last Name</td><td>${formData.lastName || 'N/A'}</td></tr>
      <tr><td>Address 1</td><td>${formData.address1 || 'N/A'}</td></tr>
      <tr><td>Address 2</td><td>${formData.address2 || 'N/A'}</td></tr>
      <tr><td>City</td><td>${formData.city || 'N/A'}</td></tr>
      <tr><td>State</td><td>${formData.state || 'N/A'}</td></tr>
      <tr><td>Zip</td><td>${formData.zip || 'N/A'}</td></tr>
      <tr><td>Social Security</td><td>${formData.ssn || 'N/A'}</td></tr>
      <tr><td>Date of Birth</td><td>${formData.dob || 'N/A'}</td></tr>
      <tr><td>Driver's License Number</td><td>${formData.dlNumber || 'N/A'}</td></tr>
      <tr><td>Driver's License State</td><td>${formData.dlState || 'N/A'}</td></tr>
      <tr><td>Driver's License Expiration</td><td>${formData.dlExp || 'N/A'}</td></tr>
      <tr><td>Mobile Phone</td><td>${formData.mobilePhone || 'N/A'}</td></tr>
      <tr><td>Home Phone</td><td>${formData.homePhone || 'N/A'}</td></tr>
      <tr><td>Email</td><td>${formData.email || 'N/A'}</td></tr>
      <tr><td>Time at Residence</td><td>${formData.residenceYears || '0'} Years, ${formData.residenceMonths || '0'} Months</td></tr>
      <tr><td>Residence Type</td><td>${formData.residenceType || 'N/A'}</td></tr>
      <tr><td>Rent/Mortgage</td><td>${formData.rentMortgage || 'N/A'}</td></tr>
    </table>

    <h2>Employment Information</h2>
    <table>
      <tr><td>Employer</td><td>${formData.employer || 'N/A'}</td></tr>
      <tr><td>Employer Type</td><td>${formData.employerType || 'N/A'}</td></tr>
      <tr><td>Monthly Income</td><td>${formData.monthlyIncome || 'N/A'}</td></tr>
      <tr><td>Occupation</td><td>${formData.occupation || 'N/A'}</td></tr>
      <tr><td>Employer Address 1</td><td>${formData.employerAddress1 || 'N/A'}</td></tr>
      <tr><td>Employer Address 2</td><td>${formData.employerAddress2 || 'N/A'}</td></tr>
      <tr><td>Employer City</td><td>${formData.employerCity || 'N/A'}</td></tr>
      <tr><td>Employer State</td><td>${formData.employerState || 'N/A'}</td></tr>
      <tr><td>Employer Zip</td><td>${formData.employerZip || 'N/A'}</td></tr>
      <tr><td>Work Phone</td><td>${formData.workPhone || 'N/A'}</td></tr>
      <tr><td>Time on Job</td><td>${formData.jobYears || '0'} Years, ${formData.jobMonths || '0'} Months</td></tr>
    </table>

    <h2>Co-Buyer</h2>
    <table>
      <tr><td>Has Co-Buyer</td><td><strong>${formData.hasCoBuyer ? 'Yes' : 'No'}</strong></td></tr>
    </table>

    <h2>Vehicle Information</h2>
    <table>
      <tr><td>Vehicle To Finance</td><td><strong>${formData.vehicleToFinance || 'N/A'}</strong></td></tr>
      <tr><td>Stock Number</td><td>${formData.stockNumber || 'N/A'}</td></tr>
      <tr><td>Year</td><td>${formData.year || 'N/A'}</td></tr>
      <tr><td>Make</td><td>${formData.make || 'N/A'}</td></tr>
      <tr><td>Model</td><td>${formData.model || 'N/A'}</td></tr>
      <tr><td>Trim</td><td>${formData.trim || 'N/A'}</td></tr>
      <tr><td>VIN</td><td>${formData.vin || 'N/A'}</td></tr>
      <tr><td>Mileage</td><td>${formData.mileage || 'N/A'}</td></tr>
    </table>

    <h2>Bank Information - Checking Account</h2>
    <table>
      <tr><td>Checking Account</td><td>${formData.checkingAccount || 'N/A'}</td></tr>
      <tr><td>Account Number</td><td>${formData.checkingAccountNumber || 'N/A'}</td></tr>
      <tr><td>Bank Name</td><td>${formData.checkingBankName || 'N/A'}</td></tr>
      <tr><td>Address 1</td><td>${formData.checkingBankAddress1 || 'N/A'}</td></tr>
      <tr><td>Address 2</td><td>${formData.checkingBankAddress2 || 'N/A'}</td></tr>
      <tr><td>City</td><td>${formData.checkingBankCity || 'N/A'}</td></tr>
      <tr><td>State</td><td>${formData.checkingBankState || 'N/A'}</td></tr>
      <tr><td>Zip</td><td>${formData.checkingBankZip || 'N/A'}</td></tr>
      <tr><td>Phone</td><td>${formData.checkingBankPhone || 'N/A'}</td></tr>
    </table>

    <h2>Bank Information - Savings Account</h2>
    <table>
      <tr><td>Savings Account</td><td>${formData.savingsAccount || 'N/A'}</td></tr>
      <tr><td>Account Number</td><td>${formData.savingsAccountNumber || 'N/A'}</td></tr>
      <tr><td>Bank Name</td><td>${formData.savingsBankName || 'N/A'}</td></tr>
      <tr><td>Address 1</td><td>${formData.savingsBankAddress1 || 'N/A'}</td></tr>
      <tr><td>Address 2</td><td>${formData.savingsBankAddress2 || 'N/A'}</td></tr>
      <tr><td>City</td><td>${formData.savingsBankCity || 'N/A'}</td></tr>
      <tr><td>State</td><td>${formData.savingsBankState || 'N/A'}</td></tr>
      <tr><td>Zip</td><td>${formData.savingsBankZip || 'N/A'}</td></tr>
      <tr><td>Phone</td><td>${formData.savingsBankPhone || 'N/A'}</td></tr>
    </table>

    <h2>Financing Information</h2>
    <table>
      <tr><td>Loan Term (Months)</td><td><strong>${formData.loanTerm || 'N/A'}</strong></td></tr>
      <tr><td>Amount Required</td><td><strong>${formData.amountRequired || 'N/A'}</strong></td></tr>
      <tr><td>Downpayment</td><td><strong>${formData.downpayment || 'N/A'}</strong></td></tr>
    </table>

    ${formData.additionalComments ? `
    <div class="highlight">
      <h2 style="margin-top: 0; background: none; padding: 0; border: none;">Additional Comments</h2>
      <p style="margin: 10px 0 0 0;">${formData.additionalComments}</p>
    </div>
    ` : ''}

    <h2>Consent</h2>
    <table>
      <tr><td>Credit Check Consent</td><td class="${formData.consentAcknowledged ? 'consent-yes' : 'consent-no'}">${formData.consentAcknowledged ? 'Yes' : 'No'}</td></tr>
      <tr><td>Text/Phone Consent</td><td class="${formData.textConsentAcknowledged ? 'consent-yes' : 'consent-no'}">${formData.textConsentAcknowledged ? 'Yes' : 'No'}</td></tr>
    </table>

    <div class="timestamp">
      <strong>Submitted:</strong> ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })}
    </div>
  </div>
</body>
</html>`;

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
      subject: `New Financing Application - ${fullName}`,
      body: emailHtml
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