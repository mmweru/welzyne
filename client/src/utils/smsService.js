import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

const client = twilio(accountSid, authToken);

export const sendSMS = async (to, body) => {
    try {
        const message = await client.messages.create({
            body: body,
            from: twilioPhoneNumber,
            to: to
        });
        console.log('SMS sent:', message.sid);
        return true;
    } catch (error) {
        console.error('Error sending SMS:', error);
        return false;
    }
};

// Specific message templates
export const sendBookingConfirmation = async (order) => {
    // Message for sender
    const senderMessage = `Dear ${order.customer}, your courier (#${order.id}) from ${order.pickupLocation} to ${order.destination} has been booked. Recipient: ${order.recipientName} (${order.recipientPhone}). Status: ${order.status}. Thank you for choosing us!`;

    // Message for recipient
    const recipientMessage = `Hello ${order.recipientName}, a package (#${order.id}) from ${order.customer} (${order.phone}) is on its way to you at ${order.destination}. Current status: ${order.status}.`;

    await sendSMS(order.phone, senderMessage);
    await sendSMS(order.recipientPhone, recipientMessage);
};

export const sendStatusUpdate = async (order) => {
    // Message for sender
    const senderMessage = `Update for courier #${order.id}: Your package to ${order.recipientName} is now "${order.status}".`;

    // Message for recipient
    const recipientMessage = `Update for package #${order.id} from ${order.customer}: Status changed to "${order.status}".`;

    await sendSMS(order.phone, senderMessage);
    await sendSMS(order.recipientPhone, recipientMessage);
};
