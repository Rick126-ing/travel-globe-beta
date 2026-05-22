function normalizeCityName(city) {
  if (!city || typeof city !== "string") return "Destinazione";
  return city.trim();
}

async function searchMockHotels({
  city,
  country,
  checkIn,
  checkOut,
  adults = 2,
  budgetLevel = "medium",
}) {
  const cleanCity = normalizeCityName(city);
  const citySlug = cleanCity.toLowerCase().replace(/\s+/g, "_");

  return [
    {
      id: `hotel_${citySlug}_001`,
      type: "hotel",
      provider: "mock",
      title: `Hotel Centrale ${cleanCity}`,
      city: cleanCity,
      country: country || "",
      lat: 41.9028,
      lng: 12.4964,
      price: {
        amount: 145,
        currency: "EUR",
        label: "145 €/notte",
      },
      rating: 8.7,
      image: "",
      availability: true,
      bookingUrl: "https://www.booking.com",
      notes: "Hotel centrale, comodo per visitare le principali attrazioni.",
      checkIn: checkIn || null,
      checkOut: checkOut || null,
      adults,
      budgetLevel,
    },
    {
      id: `hotel_${citySlug}_002`,
      type: "hotel",
      provider: "mock",
      title: `Boutique Hotel ${cleanCity}`,
      city: cleanCity,
      country: country || "",
      lat: 41.8955,
      lng: 12.4823,
      price: {
        amount: 210,
        currency: "EUR",
        label: "210 €/notte",
      },
      rating: 9.1,
      image: "",
      availability: true,
      bookingUrl: "https://www.booking.com",
      notes: "Soluzione più elegante, consigliata per coppie o soggiorni brevi.",
      checkIn: checkIn || null,
      checkOut: checkOut || null,
      adults,
      budgetLevel,
    },
    {
      id: `hotel_${citySlug}_003`,
      type: "hotel",
      provider: "mock",
      title: `Smart Stay ${cleanCity}`,
      city: cleanCity,
      country: country || "",
      lat: 41.9109,
      lng: 12.5018,
      price: {
        amount: 95,
        currency: "EUR",
        label: "95 €/notte",
      },
      rating: 8.1,
      image: "",
      availability: true,
      bookingUrl: "https://www.booking.com",
      notes: "Opzione più economica, buona per viaggiatori con budget contenuto.",
      checkIn: checkIn || null,
      checkOut: checkOut || null,
      adults,
      budgetLevel,
    },
  ];
}

module.exports = {
  searchMockHotels,
};