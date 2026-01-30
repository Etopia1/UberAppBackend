const Booking = require('../models/Booking');
const Amadeus = require('amadeus');
const { sendOTP } = require('../services/emailService'); // Re-using existing service
const { otpTemplate } = require('../helpers/emailTemplate');

// Initialize Amadeus (Use environment variables)
const amadeus = new Amadeus({
    clientId: process.env.AMADEUS_CLIENT_ID,
    clientSecret: process.env.AMADEUS_CLIENT_SECRET
});

// Search Airport/City Locations (Autocomplete)
exports.searchLocations = async (req, res) => {
    try {
        const { keyword } = req.query;
        if (!keyword || keyword.length < 2) {
            return res.json({ results: [] });
        }

        console.log(`Searching Amadeus for location: ${keyword}`);

        const response = await amadeus.referenceData.locations.get({
            keyword: keyword,
            subType: Amadeus.location.any
        });

        const locations = response.data.map(loc => ({
            name: loc.name,
            detailedName: `${loc.address.cityName}, ${loc.address.countryName} (${loc.iataCode})`,
            iataCode: loc.iataCode,
            type: loc.subType
        }));

        res.json({ results: locations });

    } catch (error) {
        console.error('Location Search Error:', error);
        res.status(500).json({ message: 'Location search failed' });
    }
};

// Airline Helpers
const airlineMap = {
    'TP': { name: 'TAP Air Portugal', logo: 'https://img.icons8.com/color/48/tap-air-portugal.png' },
    'B6': { name: 'JetBlue', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/JetBlue_Airways_Logo.svg/1024px-JetBlue_Airways_Logo.svg.png' },
    'FI': { name: 'Icelandair', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Icelandair_logo.svg/2560px-Icelandair_logo.svg.png' },
    'BA': { name: 'British Airways', logo: 'https://img.icons8.com/color/48/british-airways.png' },
    'AA': { name: 'American Airlines', logo: 'https://img.icons8.com/color/48/american-airlines.png' },
    'DL': { name: 'Delta Airlines', logo: 'https://img.icons8.com/color/48/delta-airlines.png' },
    'EK': { name: 'Emirates', logo: 'https://img.icons8.com/color/48/emirates.png' },
    'LH': { name: 'Lufthansa', logo: 'https://img.icons8.com/color/48/lufthansa.png' },
    'AF': { name: 'Air France', logo: 'https://img.icons8.com/color/48/air-france.png' },
    'UA': { name: 'United Airlines', logo: 'https://img.icons8.com/color/48/united-airlines.png' }
};

const getAirlineInfo = (code) => {
    return airlineMap[code] || { name: code, logo: 'https://img.icons8.com/color/48/airplane-take-off.png' };
};

// Search Flights
exports.searchFlights = async (req, res) => {
    try {
        console.log('Incoming Flight Search Request:', req.body);
        const { origin, destination, date } = req.body;

        const fOrigin = origin.trim().toUpperCase();
        const fDest = destination.trim().toUpperCase();
        const fDate = date ? date.trim() : new Date().toISOString().split('T')[0];

        console.log(`Calling Amadeus with User inputs: ${fOrigin} -> ${fDest} on ${fDate}`);

        // Call Amadeus API
        const response = await amadeus.shopping.flightOffersSearch.get({
            originLocationCode: fOrigin,
            destinationLocationCode: fDest,
            departureDate: fDate,
            adults: '1',
            max: 20
        });

        // Transform Data for Frontend
        const flights = response.data.map((offer) => {
            const segment = offer.itineraries[0].segments[0];
            const carrierCode = segment.carrierCode;
            const airlineInfo = getAirlineInfo(carrierCode);

            return {
                id: offer.id,
                airline: airlineInfo.name,
                flightNumber: `${segment.carrierCode}${segment.number}`,
                departure: {
                    time: segment.departure.at.split('T')[1].substring(0, 5),
                    airport: segment.departure.iataCode
                },
                arrival: {
                    time: segment.arrival.at.split('T')[1].substring(0, 5),
                    airport: segment.arrival.iataCode
                },
                price: `${offer.price.currency} ${offer.price.total}`,
                duration: offer.itineraries[0].duration.replace('PT', '').toLowerCase(),
                logo: airlineInfo.logo,
                rawOffer: offer // Required for Real Booking
            };
        });

        if (!flights || flights.length === 0) {
            return res.status(404).json({ message: 'No flights found for this route.' });
        }

        res.json({ message: 'Flights found', results: flights });

    } catch (error) {
        const errorMessage = error.response ? JSON.stringify(error.response.body) : error.message;
        console.error('Amadeus Search Error:', errorMessage);
        res.status(500).json({ message: 'Flight search failed. Please check inputs or try again later.' });
    }
};

// Book Flight (Real Amadeus Booking)
exports.bookFlight = async (req, res) => {
    try {
        const { userId, flightDetails, passengers } = req.body;
        const offer = flightDetails.rawOffer;

        if (!offer) {
            return res.status(400).json({ message: 'Missing flight offer data for booking' });
        }

        console.log('Starting Real Amadeus Booking Flow...');

        // 1. Confirm Pricing & Availability
        let pricedOffer;
        try {
            const pricingResponse = await amadeus.shopping.flightOffers.pricing.post({
                data: {
                    type: 'flight-offers-pricing',
                    flightOffers: [offer]
                }
            });
            pricedOffer = pricingResponse.data.flightOffers[0];
            console.log('Price Confirmed:', pricedOffer.price.total);
        } catch (priceError) {
            console.error('Pricing Error:', priceError.response ? JSON.stringify(priceError.response.result) : priceError.message);

            // Handle Price Discrepancy specifically
            if (priceError.response?.result?.errors?.some(e => e.code === 37200 || e.title === 'PRICE DISCREPANCY')) {
                return res.status(409).json({
                    message: 'Flight price has changed. Please search again.',
                    code: 'PRICE_DISCREPANCY'
                });
            }
            throw priceError;
        }

        // 2. Create Flight Utility Order (Book Ticket)
        const travelerDetails = {
            id: '1',
            dateOfBirth: '1990-01-01',
            name: { firstName: 'JOLA', lastName: 'ETOPIA' },
            gender: 'MALE',
            contact: {
                emailAddress: 'jolaetopia81@gmail.com',
                phones: [{ deviceType: 'MOBILE', countryCallingCode: '1', number: '5555555555' }]
            },
            documents: [{
                documentType: 'PASSPORT',
                birthPlace: 'New York',
                issuanceLocation: 'New York',
                issuanceDate: '2015-04-14',
                number: '00000000',
                expiryDate: '2030-04-14',
                issuanceCountry: 'US',
                validityCountry: 'US',
                nationality: 'US',
                holder: true
            }]
        };

        const orderResponse = await amadeus.booking.flightOrders.post(
            JSON.stringify({
                data: {
                    type: 'flight-order',
                    flightOffers: [pricedOffer],
                    travelers: [travelerDetails]
                }
            })
        );
        const orderData = orderResponse.data;
        const pnr = orderData.associatedRecords?.[0]?.reference || orderData.id;
        console.log('Real Booking Success! PNR:', pnr);

        // 3. Save to Database
        const newBooking = new Booking({
            user: userId,
            flightId: orderData.id,
            pnr: pnr,
            airline: flightDetails.airline,
            flightNumber: flightDetails.flightNumber,
            origin: flightDetails.departure.airport,
            destination: flightDetails.arrival.airport,
            price: parseFloat(pricedOffer.price.total),
            currency: pricedOffer.price.currency,
            passengers: passengers || 1,
            status: 'confirmed',
            rawBookingData: orderData
        });

        const savedBooking = await newBooking.save();

        // 4. Send Confirmation Email
        const userEmail = req.body.email || 'jolaetopia81@gmail.com';

        const emailContent = `
            <h2>Booking Confirmed! ✈️</h2>
            <p>Your flight to <strong>${flightDetails.arrival.airport}</strong> is confirmed.</p>
            <p><strong>PNR:</strong> ${pnr}</p>
            <p><strong>Airline:</strong> ${flightDetails.airline}</p>
            <p><strong>Flight:</strong> ${flightDetails.flightNumber}</p>
            <p><strong>Departure:</strong> ${flightDetails.departure.time}</p>
            <p>Safe travels!</p>
        `;

        await sendOTP(userEmail, pnr, emailContent, 'Flight Confirmation - Driven App');

        // 5. Real-Time Notification
        const io = req.app.get('io');
        if (io) {
            io.emit('notification', {
                title: 'Ticket Issued! 🎟️',
                message: `Booking Confirmed. Ref: ${savedBooking.pnr}. Check your email.`,
                type: 'ride_suggestion',
                data: {
                    bookingId: savedBooking._id,
                    pickup: flightDetails.arrival.airport,
                    time: flightDetails.arrival.time,
                    destinationCoords: flightDetails.arrival.coords
                }
            });
        }

        res.status(201).json({
            message: 'Real Flight Booking Confirmed',
            booking: savedBooking,
            pnr: savedBooking.pnr
        });

    } catch (error) {
        console.error('Booking Error:', error.response ? JSON.stringify(error.response.result) : error);

        if (error.response?.result?.errors?.some(e => e.code === 37200 || e.title === 'PRICE DISCREPANCY')) {
            return res.status(409).json({
                message: 'Flight price has changed. Please search again.',
                code: 'PRICE_DISCREPANCY'
            });
        }

        res.status(500).json({
            message: 'Booking Failed',
            details: error.response?.result?.errors || error.message
        });
    }
};

// Simulate Flight Landing & Trigger Ride
exports.simulateFlightLanding = async (req, res) => {
    try {
        const { bookingId } = req.params;

        // 1. Find Booking
        const booking = await Booking.findById(bookingId).populate('user');
        if (!booking) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        if (!booking.user) {
            console.error('Ride Creation Failed: Booking has no associated user');
            return res.status(400).json({ message: 'Booking has no invalid user, cannot auto-book ride.' });
        }

        // 2. Update Status to 'landed'
        booking.flightStatus = 'landed';
        await booking.save();

        let autoRide = null;

        // 3. Trigger Auto-Ride if enabled
        if (booking.autoBookRide) {
            const Ride = require('../models/Ride');
            console.log('Attempting to auto-book ride for Booking:', booking._id);

            const pickupLat = booking.destinationCoords?.latitude || 40.7128;
            const pickupLng = booking.destinationCoords?.longitude || -74.0060;

            const rideUserId = booking.user._id || booking.user;

            if (!rideUserId) {
                console.error('CRITICAL: Cannot book ride, user ID is null.');
            } else {
                const newRide = new Ride({
                    user: rideUserId,
                    pickup: {
                        address: `${booking.destination || 'Airport'}`,
                        latitude: pickupLat,
                        longitude: pickupLng
                    },
                    dropoff: {
                        address: 'Saved Home',
                        latitude: 40.7306,
                        longitude: -73.9352
                    },
                    fare: 45.0, // Standard airport flat rate
                    status: 'searching'
                });

                autoRide = await newRide.save();
                console.log('Ride auto-booked successfully:', autoRide._id);
            }
        }

        // 4. Notify User via Socket
        const io = req.app.get('io');
        if (io) {
            const userIdStr = booking.user._id ? booking.user._id.toString() : booking.user.toString();
            io.to(`user_${userIdStr}`).emit('flight_landed', {
                message: '🛬 Your flight has landed!',
                bookingId: booking._id,
                autoRide: autoRide
            });
        }

        res.json({
            message: 'Flight landing simulated successfully',
            flightStatus: 'landed',
            autoRide: autoRide
        });

    } catch (error) {
        console.error('Simulate Landing Error:', error);
        res.status(500).json({ message: error.message });
    }
};
