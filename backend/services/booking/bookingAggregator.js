const { searchMockHotels } = require("./mockHotelService");
const { searchMockActivities } = require("./mockActivityService");
const { searchMockFlights } = require("./mockFlightService");

async function searchHotels(params) {
  const hotels = await searchMockHotels(params);

  return hotels.map((hotel) => ({
    id: hotel.id,
    type: hotel.type || "hotel",
    provider: hotel.provider || "mock",
    title: hotel.title,
    city: hotel.city,
    country: hotel.country || "",
    lat: hotel.lat,
    lng: hotel.lng,
    price: hotel.price,
    rating: hotel.rating || null,
    image: hotel.image || "",
    availability: hotel.availability !== false,
    bookingUrl: hotel.bookingUrl,
    notes: hotel.notes || "",
    checkIn: hotel.checkIn || null,
    checkOut: hotel.checkOut || null,
    adults: hotel.adults || 2,
    budgetLevel: hotel.budgetLevel || "medium",
  }));
}

async function searchActivities(params) {
  const activities = await searchMockActivities(params);

  return activities.map((activity) => ({
    id: activity.id,
    type: activity.type || "activity",
    category: activity.category || "experience",
    provider: activity.provider || "mock",
    title: activity.title,
    city: activity.city,
    country: activity.country || "",
    lat: activity.lat,
    lng: activity.lng,
    price: activity.price,
    duration: activity.duration || "",
    availability: activity.availability !== false,
    bookingUrl: activity.bookingUrl,
    notes: activity.notes || "",
    date: activity.date || null,
    travelers: activity.travelers || 2,
    budgetLevel: activity.budgetLevel || "medium",
  }));
}

async function searchFlights(params) {
  const flights = await searchMockFlights(params);

  return flights.map((flight) => ({
    id: flight.id,
    type: flight.type || "flight",
    provider: flight.provider || "mock",
    airline: flight.airline || "",
    flightNumber: flight.flightNumber || "",
    from: flight.from,
    to: flight.to,
    departureDate: flight.departureDate || null,
    returnDate: flight.returnDate || null,
    departureTime: flight.departureTime || "",
    arrivalTime: flight.arrivalTime || "",
    duration: flight.duration || "",
    stops: Number.isFinite(flight.stops) ? flight.stops : 0,
    cabin: flight.cabin || "economy",
    travelers: flight.travelers || 2,
    price: flight.price,
    availability: flight.availability !== false,
    bookingUrl: flight.bookingUrl,
    notes: flight.notes || "",
    budgetLevel: flight.budgetLevel || "medium",
  }));
}

async function enrichTripWithBookings(trip, bookingIntent = {}) {
  const bookingOptions = {
    hotels: [],
    flights: [],
    activities: [],
  };

  if (bookingIntent.needsHotels) {
    bookingOptions.hotels = await searchHotels({
      city:
        bookingIntent.city ||
        trip.destination ||
        trip.city ||
        trip.title ||
        "Destinazione",
      country: bookingIntent.country || trip.country || "",
      checkIn: bookingIntent?.dates?.start || null,
      checkOut: bookingIntent?.dates?.end || null,
      adults: bookingIntent.travelers || 2,
      budgetLevel: bookingIntent.budgetLevel || "medium",
    });
  }

  if (bookingIntent.needsActivities) {
  bookingOptions.activities = await searchActivities({
    city:
      bookingIntent.city ||
      trip.destination ||
      trip.city ||
      trip.title ||
      "Destinazione",
    country: bookingIntent.country || trip.country || "",
    date: bookingIntent?.dates?.start || null,
    travelers: bookingIntent.travelers || 2,
    category: bookingIntent.category || "all",
    budgetLevel: bookingIntent.budgetLevel || "medium",
  });
}

if (bookingIntent.needsFlights) {
  bookingOptions.flights = await searchFlights({
    from: bookingIntent.from || bookingIntent.origin || "FCO",
    to: bookingIntent.to || bookingIntent.destinationAirport || "CIA",
    departureDate: bookingIntent?.dates?.start || null,
    returnDate: bookingIntent?.dates?.end || null,
    travelers: bookingIntent.travelers || 2,
    cabin: bookingIntent.cabin || "economy",
    budgetLevel: bookingIntent.budgetLevel || "medium",
  });
}

  return {
    ...trip,
    bookingOptions,
  };
}

module.exports = {
  searchHotels,
  searchActivities,
  searchFlights,
  enrichTripWithBookings,
};