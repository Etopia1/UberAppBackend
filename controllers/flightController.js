const Booking = require('../models/Booking');
const Amadeus = require('amadeus');

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

        try {
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

        } catch (apiError) {
            console.warn('Amadeus Location Search Failed (using mock fallback):', apiError.response ? apiError.response.body : apiError.message);
            // Fallback Mock Data for testing without API keys
            const mockLocations = [
                { name: 'John F. Kennedy Intl', detailedName: 'New York, USA (JFK)', iataCode: 'JFK' },
                { name: 'Heathrow', detailedName: 'London, UK (LHR)', iataCode: 'LHR' },
                { name: 'Los Angeles Intl', detailedName: 'Los Angeles, USA (LAX)', iataCode: 'LAX' },
                { name: 'Dubai Intl', detailedName: 'Dubai, UAE (DXB)', iataCode: 'DXB' },
                { name: 'Paris Charles de Gaulle', detailedName: 'Paris, France (CDG)', iataCode: 'CDG' }
            ].filter(l => l.detailedName.toLowerCase().includes(keyword.toLowerCase()));

            res.json({ results: mockLocations });
        }

    } catch (error) {
        console.error('Location Search Error:', error);
        res.status(500).json({ message: 'Location search failed' });
    }
};

// Search Flights
exports.searchFlights = async (req, res) => {
    try {
        console.log('Incoming Flight Search Request:', req.body);
        const { origin, destination, date } = req.body;

        // --- HARDCODED INPUT REMOVED (Restoring User Input) ---
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
            max: 5
        });

        // Transform Data for Frontend
        const flights = response.data.map((offer) => {
            const segment = offer.itineraries[0].segments[0];
            return {
                id: offer.id,
                airline: segment.carrierCode,
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
                logo: 'https://img.icons8.com/color/48/airplane-take-off.png' // Placeholder
            };
        });

        // If API returns 0 results (common in test environment), trigger fallback
        if (!flights || flights.length === 0) {
            throw new Error('No API results found (triggering fallback)');
        }

        res.json({ message: 'Flights found', results: flights });

    } catch (error) {
        const errorMessage = error.response ? JSON.stringify(error.response.body) : error.message;
        console.error('Amadeus Search Error:', errorMessage);

        // Fallback Mock Data (Restored for Stability per user "use like mock input")
        res.status(200).json({
            message: 'Showing sample flights (API constrained or Failed)',
            results: [
                { id: 'MOCK_1', airline: 'BA', flightNumber: 'BA101', departure: { time: '10:00', airport: 'LON' }, arrival: { time: '14:00', airport: 'NYC' }, price: 'USD 450', duration: '7h', logo: 'https://img.icons8.com/color/48/airplane-take-off.png' }
            ]
        });
    }
};

// Book Flight & Auto-Suggest Ride
exports.bookFlight = async (req, res) => {
    try {
        const { userId, flightId, flightDetails, passengers } = req.body;

        // 1. Save Booking to DB
        const newBooking = new Booking({
            user: userId,
            flightId,
            airline: flightDetails?.airline || 'Unknown',
            flightNumber: flightDetails?.flightNumber || 'FL000',
            origin: flightDetails?.origin || 'UNK',
            destination: flightDetails?.destination || 'UNK',
            price: parseFloat(flightDetails?.price?.split(' ')[1]) || 0,
            passengers: passengers || 1,
            status: 'confirmed'
        });

        const savedBooking = await newBooking.save();

        // 2. Smart Logic: Calculate Landing Time & Suggest Ride
        const arrivalTime = flightDetails?.arrival?.time || 'Unknown';
        const destination = flightDetails?.destination || 'Destination';

        // 3. Real-Time Notification via Socket.IO
        const io = req.app.get('io');
        if (io) {
            // Emit to specific user if mapped, or broadcast for MVP demo
            // In production, map userId -> socketId
            io.emit('notification', {
                title: 'Flight Booked! ✈️',
                message: `You land at ${arrivalTime}. We can have a ride waiting for you at ${destination}.`,
                type: 'ride_suggestion',
                data: {
                    bookingId: savedBooking._id,
                    pickup: destination, // Airport code
                    time: arrivalTime
                }
            });
        }

        res.status(201).json({
            message: 'Flight booked successfully',
            booking: savedBooking,
            suggestion: `Ride suggestion sent for ${arrivalTime}`
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
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
            console.log('Booking User Field:', booking.user);

            const pickupLat = booking.destinationCoords?.latitude || 40.7128;
            const pickupLng = booking.destinationCoords?.longitude || -74.0060;

            // Resolve User ID safely
            let rideUserId = null;
            if (booking.user && booking.user._id) {
                rideUserId = booking.user._id;
            } else if (booking.user) {
                rideUserId = booking.user;
            }

            console.log('Resolved Ride User ID:', rideUserId);

            if (!rideUserId) {
                console.error('CRITICAL: Cannot book ride, user ID is null.');
                // Don't crash, just skip ride booking
            } else {
                // Create a new ride from the airport
                const newRide = new Ride({
                    user: rideUserId,
                    pickup: {
                        address: `${booking.destination || 'Airport'}`,
                        latitude: pickupLat,
                        longitude: pickupLng
                    },
                    dropoff: {
                        address: 'Saved Home', // In a real app, this would be user's home address
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
