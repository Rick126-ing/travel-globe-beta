function normalizeAirport(value, fallback) {
  if (!value || typeof value !== "string") return fallback;
  return value.trim().toUpperCase();
}

async function searchMockFlights({
  from,
  to,
  departureDate,
  returnDate,
  travelers = 2,
  cabin = "economy",
  budgetLevel = "medium",
}) {
  const fromCode = normalizeAirport(from, "FCO");
  const toCode = normalizeAirport(to, "CIA");

  return [
    {
      id: `flight_${fromCode}_${toCode}_001`,
      type: "flight",
      provider: "mock",
      airline: "ITA Airways",
      flightNumber: "AZ 204",
      from: fromCode,
      to: toCode,
      departureDate: departureDate || null,
      returnDate: returnDate || null,
      departureTime: "08:30",
      arrivalTime: "10:45",
      duration: "2h 15m",
      stops: 0,
      cabin,
      travelers,
      price: {
        amount: 178,
        currency: "EUR",
        label: "178 €",
      },
      availability: true,
      bookingUrl: "https://www.google.com/travel/flights",
      notes: "Volo diretto consigliato per partire presto e sfruttare la giornata.",
      budgetLevel,
    },
    {
      id: `flight_${fromCode}_${toCode}_002`,
      type: "flight",
      provider: "mock",
      airline: "Ryanair",
      flightNumber: "FR 1120",
      from: fromCode,
      to: toCode,
      departureDate: departureDate || null,
      returnDate: returnDate || null,
      departureTime: "13:15",
      arrivalTime: "15:35",
      duration: "2h 20m",
      stops: 0,
      cabin,
      travelers,
      price: {
        amount: 96,
        currency: "EUR",
        label: "96 €",
      },
      availability: true,
      bookingUrl: "https://www.google.com/travel/flights",
      notes: "Opzione più economica, utile se il budget è prioritario.",
      budgetLevel,
    },
    {
      id: `flight_${fromCode}_${toCode}_003`,
      type: "flight",
      provider: "mock",
      airline: "Vueling",
      flightNumber: "VY 6251",
      from: fromCode,
      to: toCode,
      departureDate: departureDate || null,
      returnDate: returnDate || null,
      departureTime: "18:40",
      arrivalTime: "21:00",
      duration: "2h 20m",
      stops: 0,
      cabin,
      travelers,
      price: {
        amount: 132,
        currency: "EUR",
        label: "132 €",
      },
      availability: true,
      bookingUrl: "https://www.google.com/travel/flights",
      notes: "Soluzione serale, comoda se si parte dopo lavoro o studio.",
      budgetLevel,
    },
  ];
}

module.exports = {
  searchMockFlights,
};