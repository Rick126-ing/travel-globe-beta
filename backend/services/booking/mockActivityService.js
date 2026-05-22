function normalizeCityName(city) {
  if (!city || typeof city !== "string") return "Destinazione";
  return city.trim();
}

function getActivityTemplatesForCity(cleanCity) {
  const cityKey = cleanCity.toLowerCase();

  if (cityKey.includes("parigi") || cityKey.includes("paris")) {
    return [
      {
        suffix: "001",
        category: "museum",
        title: "Louvre - biglietto ingresso",
        lat: 48.8606,
        lng: 2.3376,
        price: {
          amount: 44,
          currency: "EUR",
          label: "44 €",
        },
        duration: "2-3 ore",
        bookingUrl: "https://www.tiqets.com",
        notes: "Ingresso consigliato per visitare le opere principali del Louvre.",
      },
      {
        suffix: "002",
        category: "museum",
        title: "Musée d'Orsay - ingresso",
        lat: 48.86,
        lng: 2.3266,
        price: {
          amount: 32,
          currency: "EUR",
          label: "32 €",
        },
        duration: "2 ore",
        bookingUrl: "https://www.tiqets.com",
        notes: "Perfetto per arte impressionista e post-impressionista.",
      },
      {
        suffix: "003",
        category: "experience",
        title: "Crociera sulla Senna al tramonto",
        lat: 48.8584,
        lng: 2.2945,
        price: {
          amount: 36,
          currency: "EUR",
          label: "36 €",
        },
        duration: "1 ora",
        bookingUrl: "https://www.viator.com",
        notes: "Esperienza panoramica ideale per vedere Parigi dal fiume.",
      },
      {
        suffix: "004",
        category: "experience",
        title: "Tour serale a Montmartre",
        lat: 48.8867,
        lng: 2.3431,
        price: {
          amount: 42,
          currency: "EUR",
          label: "42 €",
        },
        duration: "2 ore",
        bookingUrl: "https://www.viator.com",
        notes: "Passeggiata tra vicoli, artisti, Sacré-Cœur e scorci panoramici.",
      },
    ];
  }

  if (cityKey.includes("roma") || cityKey.includes("rome")) {
    return [
      {
        suffix: "001",
        category: "museum",
        title: "Biglietto Colosseo e Foro Romano",
        lat: 41.8902,
        lng: 12.4922,
        price: {
          amount: 36,
          currency: "EUR",
          label: "36 €",
        },
        duration: "2-3 ore",
        bookingUrl: "https://www.tiqets.com",
        notes: "Biglietto consigliato per visitare l’area archeologica principale.",
      },
      {
        suffix: "002",
        category: "museum",
        title: "Musei Vaticani - ingresso prioritario",
        lat: 41.9065,
        lng: 12.4536,
        price: {
          amount: 50,
          currency: "EUR",
          label: "50 €",
        },
        duration: "3 ore",
        bookingUrl: "https://www.tiqets.com",
        notes: "Ideale al mattino per evitare le fasce più affollate.",
      },
      {
        suffix: "003",
        category: "park",
        title: "Passeggiata guidata a Villa Borghese",
        lat: 41.9142,
        lng: 12.4922,
        price: {
          amount: 18,
          currency: "EUR",
          label: "18 €",
        },
        duration: "1-2 ore",
        bookingUrl: "https://www.viator.com",
        notes: "Attività rilassante, perfetta per una mattinata tranquilla.",
      },
      {
        suffix: "004",
        category: "experience",
        title: "Tour serale a Trastevere",
        lat: 41.8894,
        lng: 12.4663,
        price: {
          amount: 42,
          currency: "EUR",
          label: "42 €",
        },
        duration: "2 ore",
        bookingUrl: "https://www.viator.com",
        notes: "Esperienza consigliata per la sera, tra vicoli, storia e cucina locale.",
      },
    ];
  }

  return [
    {
      suffix: "001",
      category: "museum",
      title: `Museo principale di ${cleanCity}`,
      lat: 41.9028,
      lng: 12.4964,
      price: {
        amount: 30,
        currency: "EUR",
        label: "30 €",
      },
      duration: "2 ore",
      bookingUrl: "https://www.tiqets.com",
      notes: "Esperienza culturale consigliata per scoprire la città.",
    },
    {
      suffix: "002",
      category: "experience",
      title: `Tour guidato del centro di ${cleanCity}`,
      lat: 41.9028,
      lng: 12.4964,
      price: {
        amount: 40,
        currency: "EUR",
        label: "40 €",
      },
      duration: "2 ore",
      bookingUrl: "https://www.viator.com",
      notes: "Tour introduttivo utile per orientarsi e vedere i punti principali.",
    },
  ];
}

async function searchMockActivities({
  city,
  country,
  date,
  travelers = 2,
  category = "all",
  budgetLevel = "medium",
}) {
  const cleanCity = normalizeCityName(city);
  const citySlug = cleanCity.toLowerCase().replace(/\s+/g, "_");

  const templates = getActivityTemplatesForCity(cleanCity);

  const activities = templates.map((item) => ({
    id: `activity_${citySlug}_${item.suffix}`,
    type: "activity",
    category: item.category,
    provider: "mock",
    title: item.title,
    city: cleanCity,
    country: country || "",
    lat: item.lat,
    lng: item.lng,
    price: item.price,
    duration: item.duration,
    availability: true,
    bookingUrl: item.bookingUrl,
    notes: item.notes,
    date: date || null,
    travelers,
    budgetLevel,
  }));

  if (!category || category === "all") {
    return activities;
  }

  return activities.filter((activity) => activity.category === category);
}

module.exports = {
  searchMockActivities,
};