const { Expo } = require('expo-server-sdk');
const expo = new Expo();

const sendPushNotification = async (pushToken, title, body, data = {}) => {
    if (!Expo.isExpoPushToken(pushToken)) {
        console.error(`Push token ${pushToken} is not a valid Expo push token`);
        return;
    }

    const messages = [{
        to: pushToken,
        sound: 'default',
        title: title,
        body: body,
        data: data,
        priority: 'high',
    }];

    try {
        let ticketChunk = await expo.sendPushNotificationsAsync(messages);
        // console.log('Notification sent:', ticketChunk);
    } catch (error) {
        console.error('Error sending push notification:', error);
    }
};

const sendMulticastNotification = async (pushTokens, title, body, data = {}) => {
    let validTokens = pushTokens.filter(t => Expo.isExpoPushToken(t));
    let messages = validTokens.map(token => ({
        to: token,
        sound: 'default',
        title,
        body,
        data,
        priority: 'high'
    }));

    if (messages.length === 0) return;

    try {
        let chunks = expo.chunkPushNotifications(messages);
        for (let chunk of chunks) {
            await expo.sendPushNotificationsAsync(chunk);
        }
    } catch (error) {
        console.error('Error sending multicast:', error);
    }
};

module.exports = { sendPushNotification, sendMulticastNotification };
