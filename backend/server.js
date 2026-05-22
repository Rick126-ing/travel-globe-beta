// backend/server.js
require("dotenv").config();

const { MongoClient, ObjectId } = require("mongodb");
const express = require("express");
const cors = require("cors");
const bookingRoutes = require("./routes/bookingRoutes");
const OpenAI = require("openai");
const { z } = require("zod");
const bcrypt = require("bcrypt");
const app = express();
const PORT = process.env.PORT || 4000;

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5000",
  "http://127.0.0.1:5500",
  "https://travel-globe-git-main-rick126-ings-projects.vercel.app",
  "https://travel-globe-7bjg.onrender.com"
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.warn("CORS bloccato per origin:", origin);
    return callback(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.options(/.*/, cors());

app.use(express.json());

app.use("/api/bookings", bookingRoutes);

if (!process.env.MONGODB_URI) {
  console.error("Manca MONGODB_URI nel file .env");
  process.exit(1);
}

console.log(
  "MONGODB_URI letta:",
  process.env.MONGODB_URI
    ?.replace(/\/\/([^:]+):([^@]+)@/, "//$1:***@")
);
const mongoClient = new MongoClient(process.env.MONGODB_URI);

let tripsCollection;
let usersCollection;
let imagesCollection;

const pexelsImageCache = new Map();
const PEXELS_CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24 ore

setInterval(() => {
  const now = Date.now();

  for (const [key, value] of pexelsImageCache.entries()) {
    if ((now - value.timestamp) >= PEXELS_CACHE_TTL_MS) {
      pexelsImageCache.delete(key);
    }
  }
}, 1000 * 60 * 30); // pulizia ogni 30 minuti
function normalizeImageQuery(query) {
  return String(query || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

async function searchPexelsImage(query) {
  if (!process.env.PEXELS_API_KEY) {
    console.warn("PEXELS_API_KEY mancante");
    return null;
  }

  const normalizedQuery = normalizeImageQuery(query);
const now = Date.now();

// 1. CACHE RAM
const cached = pexelsImageCache.get(normalizedQuery);
if (cached && (now - cached.timestamp) < PEXELS_CACHE_TTL_MS) {
  console.log("RAM cache HIT:", normalizedQuery);
  return cached.imageUrl;
}

// 2. CACHE DATABASE
const dbCached = await imagesCollection.findOne({ query: normalizedQuery });

if (dbCached) {
  console.log("DB cache HIT:", normalizedQuery);

  // rimetto anche in RAM
  pexelsImageCache.set(normalizedQuery, {
    imageUrl: dbCached.imageUrl,
    timestamp: now
  });

  return dbCached.imageUrl;
}

  try {
    console.log("Pexels cache MISS:", normalizedQuery);

    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=8&page=1`;

    const res = await fetch(url, {
      headers: {
        Authorization: process.env.PEXELS_API_KEY
      }
    });

    if (!res.ok) {
      console.error("Errore Pexels:", res.status);
      return null;
    }

    const data = await res.json();

    if (!data.photos || !data.photos.length) {
      return null;
    }

    const photos = data.photos || [];

    const randomIndex = Math.floor(Math.random() * Math.min(photos.length, 8));
    const selectedPhoto = photos[randomIndex];

    const imageUrl =
      selectedPhoto?.src?.large ||
      selectedPhoto?.src?.medium ||
      null;

    if (imageUrl) {
  // salva in RAM
  pexelsImageCache.set(normalizedQuery, {
    imageUrl,
    timestamp: now
  });

  // salva su MongoDB
  await imagesCollection.updateOne(
    { query: normalizedQuery },
    {
      $set: {
        query: normalizedQuery,
        imageUrl,
        updatedAt: new Date()
      }
    },
    { upsert: true }
  );

  console.log("Salvata in DB cache:", normalizedQuery);
}

    return imageUrl;
  } catch (error) {
    console.error("Errore searchPexelsImage:", error);
    return null;
  }
}

function buildItemImageQuery(item, day, countryName) {
  const city = item?.city || day?.city || "";
  const type = String(item?.type || "").toLowerCase();
  const name = item?.name || item?.title || "";
  const title = item?.title || item?.name || "";
  const label = name || title;

  if (type === "restaurant") {
  const restaurantName = name || title || "";
  return `${restaurantName} ${city} ${countryName} pastry cafe restaurant food`;
}

  if (type === "hotel") {
    return `${city} ${countryName} boutique hotel room travel`;
  }

  if (type === "transport") {
    return `${city} ${countryName} city street travel`;
  }

  if (type === "activity") {
    return `${label} ${city} ${countryName} travel experience landmark`;
  }

  if (type === "poi") {
    return `${label} ${city} ${countryName} famous landmark architecture`;
  }

  if (label) {
    return `${label} ${city} ${countryName} travel landmark`;
  }

  if (city) {
    return `${city} ${countryName} travel landmark`;
  }

  return `${countryName} travel`;
}
function buildDayImageQuery(day, countryName) {
  const city = day?.city || "";
  const tags = Array.isArray(day?.tags) ? day.tags.join(" ") : "";

  if (!Array.isArray(day?.items) || day.items.length === 0) {
    return `${city} ${countryName} travel`;
  }

  // 1. priorità: luoghi interessanti
  const priorityTypes = ["poi", "activity", "restaurant"];

  let bestItem = day.items.find(item =>
    priorityTypes.includes((item?.type || "").toLowerCase())
  );

  // 2. fallback: qualsiasi item con nome sensato
  if (!bestItem) {
    bestItem = day.items.find(item => item?.name || item?.title);
  }

  const mainPlace =
    bestItem?.name ||
    bestItem?.title ||
    "";

  // 3. costruzione query intelligente
  if (mainPlace && city) {
    return `${mainPlace} ${city} ${countryName}`;
  }

  if (city && tags) {
    return `${city} ${countryName} ${tags} travel`;
  }

  if (city) {
    return `${city} ${countryName} landmark`;
  }

  return `${countryName} travel`;
}
async function getUniqueDayImage(query, usedImages) {
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=5&page=1`;

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: process.env.PEXELS_API_KEY
      }
    });

    if (!res.ok) return null;

    const data = await res.json();
    if (!data.photos || !data.photos.length) return null;

    // trova la prima immagine NON già usata
    for (const photo of data.photos) {
      const img =
        photo?.src?.large ||
        photo?.src?.medium ||
        null;

      if (img && !usedImages.has(img)) {
        usedImages.add(img);
        return img;
      }
    }

    // fallback: usa la prima
    const fallback =
      data.photos[0]?.src?.large ||
      data.photos[0]?.src?.medium ||
      null;

    if (fallback) usedImages.add(fallback);

    return fallback;

  } catch (err) {
    console.error("Errore getUniqueDayImage:", err);
    return null;
  }
}

async function connectMongo() {
  console.log("Sto tentando connessione MongoDB...");

  try {
    await mongoClient.connect();
    console.log("Connessione MongoDB OK");

    const db = mongoClient.db("travel_globe");
    tripsCollection = db.collection("trips");
    usersCollection = db.collection("users");
    imagesCollection = db.collection("imagesCache");

    console.log("Collection pronta");
  } catch (error) {
    console.error("Errore connessione MongoDB:", error);
    process.exit(1);
  }
}

const IS_DEV = process.env.NODE_ENV !== "production";

if (!process.env.OPENAI_API_KEY) {
  console.error("Manca OPENAI_API_KEY nel file .env");
  process.exit(1);
}

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.use(express.json({ limit: "1mb" }));

const ALLOWED_PLACE_TYPES = ["poi", "restaurant", "activity", "transport", "hotel"];
const ALLOWED_UI_LANGUAGES = ["it", "en", "es", "fr", "de"];

// ===== Schema Zod =====
const PlaceTypeSchema = z.enum(ALLOWED_PLACE_TYPES);

const BasePlaceSchema = z.object({
  name: z.string().optional(),
  title: z.string().optional(),
  type: PlaceTypeSchema.optional(),
  day: z.number().int().positive().optional(),
  city: z.string().min(1).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  estimatedCost: z.number().nonnegative().optional(),
  pricePerNight: z.number().nonnegative().optional(),
  notes: z.string().optional(),
  time: z.string().optional(),
});

const PlaceSchema = BasePlaceSchema.extend({
  name: z.string().min(1),
});

const DayItemSchema = BasePlaceSchema.refine(
  (val) => Boolean(val.name || val.title),
  {
    message: "Ogni item deve avere almeno 'name' oppure 'title'.",
  }
);

const DayPlanSchema = z.object({
  day: z.number().int().positive(),
  city: z.string().optional(),
  tags: z.array(z.string()).default([]),
  items: z.array(DayItemSchema).min(1),
});

const TripSchema = z.object({
  tripTitle: z.string().min(1),
  country: z.object({
    name: z.string().min(1),
    iso3: z.string().length(3).optional(),
    language: z.string().min(1).optional(),
  }),
  summary: z.object({
    days: z.number().int().positive(),
    people: z.number().int().positive().optional(),
    budget: z.object({
      amount: z.number().nonnegative().optional(),
      currency: z.string().optional(),
    }).optional(),
    style: z.string().optional(),
  }),
  hotels: z.array(PlaceSchema).default([]),
  places: z.array(PlaceSchema).default([]),
  dailyPlan: z.array(DayPlanSchema).min(1),
  totalEstimatedCost: z.object({
    amount: z.number().nonnegative().optional(),
    currency: z.string().optional(),
  }).optional(),
});

// ===== Demo fallback =====
function demoTrip() {
  return {
    tripTitle: "7 giorni tra Roma e Napoli",
    country: {
      name: "Italia",
      iso3: "ITA",
      language: "Italiano",
    },
    summary: {
      days: 7,
      people: 2,
      budget: { amount: 1600, currency: "EUR" },
      style: "cultura+food+natura",
    },
    hotels: [
      {
        name: "Hotel Centro Roma",
        type: "hotel",
        city: "Roma",
        lat: 41.903,
        lng: 12.496,
        pricePerNight: 140,
        day: 1,
        notes: "Posizione centrale",
      },
      {
        name: "Boutique Hotel Napoli",
        type: "hotel",
        city: "Napoli",
        lat: 40.852,
        lng: 14.268,
        pricePerNight: 120,
        day: 4,
        notes: "Vista sul golfo",
      },
    ],
    places: [
      {
        name: "Colosseo",
        type: "poi",
        day: 1,
        city: "Roma",
        lat: 41.8902,
        lng: 12.4922,
        estimatedCost: 18,
        notes: "Prenota online",
      },
      {
        name: "Pompei",
        type: "poi",
        day: 5,
        city: "Pompei",
        lat: 40.7497,
        lng: 14.4869,
        estimatedCost: 19,
        notes: "Arriva presto",
      },
    ],
    dailyPlan: [
      {
        day: 1,
        city: "Roma",
        tags: ["cultura", "iconico"],
        items: [
          {
            time: "10:00",
            title: "Colosseo",
            name: "Colosseo",
            type: "poi",
            day: 1,
            city: "Roma",
            lat: 41.8902,
            lng: 12.4922,
            estimatedCost: 18,
            notes: "Ingresso con audioguida consigliato",
          },
        ],
      },
      {
        day: 2,
        city: "Roma",
        tags: ["food", "passeggiata"],
        items: [
          {
            time: "12:30",
            title: "Pranzo tipico romano",
            name: "Pranzo tipico romano",
            type: "restaurant",
            day: 2,
            city: "Roma",
            estimatedCost: 30,
            notes: "Prova cacio e pepe o carbonara",
          },
        ],
      },
      {
        day: 3,
        city: "Roma",
        tags: ["arte", "musei"],
        items: [
          {
            time: "09:30",
            title: "Musei Vaticani",
            name: "Musei Vaticani",
            type: "activity",
            day: 3,
            city: "Roma",
            lat: 41.9065,
            lng: 12.4536,
            estimatedCost: 25,
            notes: "Prenotazione consigliata",
          },
        ],
      },
      {
        day: 4,
        city: "Napoli",
        tags: ["transfer", "food"],
        items: [
          {
            time: "09:00",
            title: "Treno Roma - Napoli",
            name: "Treno Roma - Napoli",
            type: "transport",
            day: 4,
            city: "Napoli",
            estimatedCost: 35,
            notes: "Alta velocità consigliata",
          },
        ],
      },
      {
        day: 5,
        city: "Pompei",
        tags: ["storia", "archeologia"],
        items: [
          {
            time: "10:00",
            title: "Scavi di Pompei",
            name: "Scavi di Pompei",
            type: "poi",
            day: 5,
            city: "Pompei",
            lat: 40.7497,
            lng: 14.4869,
            estimatedCost: 19,
            notes: "Porta acqua e cappello",
          },
        ],
      },
      {
        day: 6,
        city: "Napoli",
        tags: ["centro storico", "food"],
        items: [
          {
            time: "11:00",
            title: "Passeggiata nel centro storico",
            name: "Passeggiata nel centro storico",
            type: "activity",
            day: 6,
            city: "Napoli",
            lat: 40.8518,
            lng: 14.2576,
            estimatedCost: 0,
            notes: "Perfetta per vedere il cuore della città",
          },
        ],
      },
      {
        day: 7,
        city: "Napoli",
        tags: ["relax", "panorama"],
        items: [
          {
            time: "17:00",
            title: "Lungomare di Napoli",
            name: "Lungomare di Napoli",
            type: "poi",
            day: 7,
            city: "Napoli",
            lat: 40.8308,
            lng: 14.2222,
            estimatedCost: 0,
            notes: "Ideale al tramonto",
          },
        ],
      },
    ],
    totalEstimatedCost: {
      amount: 1580,
      currency: "EUR",
    },
  };
}

// ===== Utility =====
function extractJsonObject(text) {
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("Nessun oggetto JSON trovato nella risposta del modello.");
  }
  return text.slice(firstBrace, lastBrace + 1);
}

function sanitizeIso3(value) {
  if (typeof value !== "string") return undefined;
  const clean = value.trim().toUpperCase();
  return clean.length === 3 ? clean : undefined;
}

function sanitizeType(type, fallback = "poi") {
  if (typeof type !== "string") return fallback;
  const clean = type.trim().toLowerCase();
  return ALLOWED_PLACE_TYPES.includes(clean) ? clean : fallback;
}

function sanitizeNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function sanitizeCoordinate(value, kind) {
  const num = sanitizeNumber(value);
  if (num === undefined) return undefined;
  if (kind === "lat" && num >= -90 && num <= 90) return num;
  if (kind === "lng" && num >= -180 && num <= 180) return num;
  return undefined;
}

function sanitizeUiLanguage(value) {
  if (typeof value !== "string") return "it";
  const clean = value.trim().toLowerCase();
  return ALLOWED_UI_LANGUAGES.includes(clean) ? clean : "it";
}

function getUiLanguageName(uiLang) {
  const map = {
    it: "italiano",
    en: "inglese",
    es: "spagnolo",
    fr: "francese",
    de: "tedesco",
  };
  return map[uiLang] || "italiano";
}

function getDefaultCurrencyByCountry(countryName, iso3) {
  const isoKey = String(iso3 || "").trim().toUpperCase();
  const nameKey = String(countryName || "").trim().toUpperCase();

  const isoMap = {
    ITA: "EUR",
    FRA: "EUR",
    ESP: "EUR",
    PRT: "EUR",
    DEU: "EUR",
    NLD: "EUR",
    BEL: "EUR",
    AUT: "EUR",
    GRC: "EUR",
    IRL: "EUR",
    FIN: "EUR",
    USA: "USD",
    CAN: "CAD",
    GBR: "GBP",
    JPN: "JPY",
    CHN: "CNY",
    AUS: "AUD",
    CHE: "CHF",
    BRA: "BRL",
    MEX: "MXN",
    TUR: "TRY",
    EGY: "EGP",
    THA: "THB",
    IND: "INR",
    ARE: "AED",
    MAR: "MAD",
    ZAF: "ZAR",
    ARG: "ARS",
    KOR: "KRW",
    SGP: "SGD"
  };

  if (isoMap[isoKey]) return isoMap[isoKey];

  const nameMap = {
    "ITALIA": "EUR",
    "ITALY": "EUR",
    "FRANCIA": "EUR",
    "FRANCE": "EUR",
    "SPAGNA": "EUR",
    "SPAIN": "EUR",
    "PORTOGALLO": "EUR",
    "PORTUGAL": "EUR",
    "GERMANIA": "EUR",
    "GERMANY": "EUR",
    "OLANDA": "EUR",
    "NETHERLANDS": "EUR",
    "BELGIO": "EUR",
    "BELGIUM": "EUR",
    "AUSTRIA": "EUR",
    "GRECIA": "EUR",
    "GREECE": "EUR",
    "IRLANDA": "EUR",
    "IRELAND": "EUR",
    "FINLANDIA": "EUR",
    "FINLAND": "EUR",
    "STATI UNITI": "USD",
    "USA": "USD",
    "UNITED STATES": "USD",
    "CANADA": "CAD",
    "REGNO UNITO": "GBP",
    "UNITED KINGDOM": "GBP",
    "UK": "GBP",
    "GRAN BRETAGNA": "GBP",
    "GIAPPONE": "JPY",
    "JAPAN": "JPY",
    "CINA": "CNY",
    "CHINA": "CNY",
    "AUSTRALIA": "AUD",
    "SVIZZERA": "CHF",
    "SWITZERLAND": "CHF",
    "BRASILE": "BRL",
    "BRAZIL": "BRL",
    "MESSICO": "MXN",
    "MEXICO": "MXN",
    "TURCHIA": "TRY",
    "TURKEY": "TRY",
    "EGITTO": "EGP",
    "EGYPT": "EGP",
    "THAILANDIA": "THB",
    "THAILAND": "THB",
    "INDIA": "INR",
    "EMIRATI ARABI UNITI": "AED",
    "UNITED ARAB EMIRATES": "AED",
    "MAROCCO": "MAD",
    "MOROCCO": "MAD",
    "SUDAFRICA": "ZAR",
    "SOUTH AFRICA": "ZAR",
    "ARGENTINA": "ARS",
    "COREA DEL SUD": "KRW",
    "SOUTH KOREA": "KRW",
    "SINGAPORE": "SGD"
  };

  return nameMap[nameKey] || "EUR";
}

function getDefaultLanguageByCountry(countryName, iso3) {
  const isoKey = String(iso3 || "").trim().toUpperCase();
  const nameKey = String(countryName || "").trim().toUpperCase();

  const isoMap = {
    ITA: "Italiano",
    FRA: "Francese",
    ESP: "Spagnolo",
    PRT: "Portoghese",
    DEU: "Tedesco",
    NLD: "Olandese",
    BEL: "Francese e Olandese",
    AUT: "Tedesco",
    GRC: "Greco",
    IRL: "Inglese",
    FIN: "Finlandese",
    USA: "Inglese",
    CAN: "Inglese e Francese",
    GBR: "Inglese",
    JPN: "Giapponese",
    CHN: "Cinese mandarino",
    AUS: "Inglese",
    CHE: "Tedesco, Francese e Italiano",
    BRA: "Portoghese",
    MEX: "Spagnolo",
    TUR: "Turco",
    EGY: "Arabo",
    THA: "Thailandese",
    IND: "Hindi e Inglese",
    ARE: "Arabo",
    MAR: "Arabo e Francese",
    ZAF: "Inglese",
    ARG: "Spagnolo",
    KOR: "Coreano",
    SGP: "Inglese"
  };

  if (isoMap[isoKey]) return isoMap[isoKey];

  const nameMap = {
    "ITALIA": "Italiano",
    "ITALY": "Italiano",
    "FRANCIA": "Francese",
    "FRANCE": "Francese",
    "SPAGNA": "Spagnolo",
    "SPAIN": "Spagnolo",
    "PORTOGALLO": "Portoghese",
    "PORTUGAL": "Portoghese",
    "GERMANIA": "Tedesco",
    "GERMANY": "Tedesco",
    "OLANDA": "Olandese",
    "NETHERLANDS": "Olandese",
    "BELGIO": "Francese e Olandese",
    "BELGIUM": "Francese e Olandese",
    "AUSTRIA": "Tedesco",
    "GRECIA": "Greco",
    "GREECE": "Greco",
    "IRLANDA": "Inglese",
    "IRELAND": "Inglese",
    "FINLANDIA": "Finlandese",
    "FINLAND": "Finlandese",
    "STATI UNITI": "Inglese",
    "USA": "Inglese",
    "UNITED STATES": "Inglese",
    "CANADA": "Inglese e Francese",
    "REGNO UNITO": "Inglese",
    "UNITED KINGDOM": "Inglese",
    "UK": "Inglese",
    "GRAN BRETAGNA": "Inglese",
    "GIAPPONE": "Giapponese",
    "JAPAN": "Giapponese",
    "CINA": "Cinese mandarino",
    "CHINA": "Cinese mandarino",
    "AUSTRALIA": "Inglese",
    "SVIZZERA": "Tedesco, Francese e Italiano",
    "SWITZERLAND": "Tedesco, Francese e Italiano",
    "BRASILE": "Portoghese",
    "BRAZIL": "Portoghese",
    "MESSICO": "Spagnolo",
    "MEXICO": "Spagnolo",
    "TURCHIA": "Turco",
    "TURKEY": "Turco",
    "EGITTO": "Arabo",
    "EGYPT": "Arabo",
    "THAILANDIA": "Thailandese",
    "THAILAND": "Thailandese",
    "INDIA": "Hindi e Inglese",
    "EMIRATI ARABI UNITI": "Arabo",
    "UNITED ARAB EMIRATES": "Arabo",
    "MAROCCO": "Arabo e Francese",
    "MOROCCO": "Arabo e Francese",
    "SUDAFRICA": "Inglese",
    "SOUTH AFRICA": "Inglese",
    "ARGENTINA": "Spagnolo",
    "COREA DEL SUD": "Coreano",
    "SOUTH KOREA": "Coreano",
    "SINGAPORE": "Inglese"
  };

  return nameMap[nameKey] || "Lingua locale";
}

function normalizeTrip(trip) {
  if (!trip || typeof trip !== "object") return trip;

  const normalizePlace = (item, fallbackName, forcedType) => {
    const type = forcedType || sanitizeType(item?.type, "poi");
    return {
      ...item,
      name: item?.name || item?.title || fallbackName,
      title: item?.title || item?.name || fallbackName,
      type,
      day: sanitizeNumber(item?.day),
      city:
        typeof item?.city === "string" && item.city.trim()
          ? item.city.trim()
          : undefined,
      lat: sanitizeCoordinate(item?.lat, "lat"),
      lng: sanitizeCoordinate(item?.lng, "lng"),
      estimatedCost: sanitizeNumber(item?.estimatedCost),
      pricePerNight: sanitizeNumber(item?.pricePerNight),
      notes:
        typeof item?.notes === "string" && item.notes.trim()
          ? item.notes.trim()
          : undefined,
      time:
        typeof item?.time === "string" && item.time.trim()
          ? item.time.trim()
          : undefined,
    };
  };

  trip.tripTitle =
    typeof trip.tripTitle === "string" && trip.tripTitle.trim()
      ? trip.tripTitle.trim()
      : "Itinerario personalizzato";

  const cleanCountryName =
    typeof trip.country?.name === "string" && trip.country.name.trim()
      ? trip.country.name.trim()
      : "Destinazione";

  const cleanIso3 = sanitizeIso3(trip.country?.iso3);
  const fallbackCurrency = getDefaultCurrencyByCountry(cleanCountryName, cleanIso3);
  const fallbackLanguage = getDefaultLanguageByCountry(cleanCountryName, cleanIso3);

  trip.country = {
    name: cleanCountryName,
    iso3: cleanIso3,
    language:
      typeof trip.country?.language === "string" && trip.country.language.trim()
        ? trip.country.language.trim()
        : fallbackLanguage,
  };

  const rawBudgetCurrency =
    typeof trip.summary?.budget?.currency === "string"
      ? trip.summary.budget.currency.trim().toUpperCase()
      : "";

  trip.summary = {
    days: Math.max(1, Math.floor(sanitizeNumber(trip.summary?.days) || 1)),
    people: Math.max(1, Math.floor(sanitizeNumber(trip.summary?.people) || 2)),
    budget: {
      amount: sanitizeNumber(trip.summary?.budget?.amount),
      currency: rawBudgetCurrency || fallbackCurrency,
    },
    style:
      typeof trip.summary?.style === "string" && trip.summary.style.trim()
        ? trip.summary.style.trim()
        : "custom",
  };

  if (Array.isArray(trip.hotels)) {
    trip.hotels = trip.hotels.map((item) =>
      normalizePlace(item, "Hotel", "hotel")
    );
  } else {
    trip.hotels = [];
  }

  if (Array.isArray(trip.places)) {
    trip.places = trip.places.map((item) =>
      normalizePlace(item, "Luogo", sanitizeType(item?.type, "poi"))
    );
  } else {
    trip.places = [];
  }

  if (Array.isArray(trip.dailyPlan)) {
    trip.dailyPlan = trip.dailyPlan.map((day, idx) => {
      const dayNumber = Math.max(
        1,
        Math.floor(sanitizeNumber(day?.day) || idx + 1)
      );

      const items = Array.isArray(day?.items)
        ? day.items.map((item) => ({
            ...normalizePlace(item, "Attività", sanitizeType(item?.type, "poi")),
            day: Math.max(1, Math.floor(sanitizeNumber(item?.day) || dayNumber)),
          }))
        : [];

      return {
        day: dayNumber,
        city:
          typeof day?.city === "string" && day.city.trim()
            ? day.city.trim()
            : undefined,
        tags: Array.isArray(day?.tags)
          ? day.tags.filter((tag) => typeof tag === "string" && tag.trim())
          : [],
        items,
      };
    });

    trip.dailyPlan = trip.dailyPlan
      .filter((day) => Array.isArray(day.items) && day.items.length > 0)
      .sort((a, b) => a.day - b.day);
  } else {
    trip.dailyPlan = [];
  }

  trip.dailyPlan = trip.dailyPlan.map((day, idx) => {
    const newDay = idx + 1;
    return {
      ...day,
      day: newDay,
      items: day.items.map((item) => ({
        ...item,
        day: newDay,
      })),
    };
  });

  if (trip.dailyPlan.length > 0) {
    trip.summary.days = trip.dailyPlan.length;
  }

  trip.totalEstimatedCost = {
    amount: sanitizeNumber(trip.totalEstimatedCost?.amount),
    currency:
      typeof trip.totalEstimatedCost?.currency === "string" &&
      trip.totalEstimatedCost.currency.trim()
        ? trip.totalEstimatedCost.currency.trim().toUpperCase()
        : trip.summary?.budget?.currency || fallbackCurrency,
  };

  return trip;
}

// ===== Prompt =====
function buildPlannerPrompt(userMessage, context = {}) {
  const selectedCountryText = context && context.selectedCountry
    ? "Paese già selezionato nel frontend: " + JSON.stringify(context.selectedCountry)
    : "Nessun paese selezionato nel frontend.";

  const requestedUiLanguage = sanitizeUiLanguage(context && context.ui ? context.ui.language : undefined);
  const uiLanguageName = getUiLanguageName(requestedUiLanguage);

  const hasCurrentTrip = !!(context && context.currentTrip);
  const currentTripText = hasCurrentTrip
    ? JSON.stringify(context.currentTrip, null, 2)
    : "Nessun viaggio esistente.";

  const modeText = hasCurrentTrip
    ? "MODIFICA_VIAGGIO_ESISTENTE"
    : "CREA_NUOVO_VIAGGIO";

  const schemaExample = {
    tripTitle: "string",
    country: {
      name: "string",
      iso3: "string",
      language: "string"
    },
    summary: {
      days: 3,
      people: 2,
      budget: {
        amount: 1000,
        currency: "EUR"
      },
      style: "string"
    },
    hotels: [
      {
        name: "string",
        city: "string",
        lat: 0,
        lng: 0,
        pricePerNight: 0,
        notes: "string"
      }
    ],
    places: [
      {
        name: "string",
        type: "poi",
        city: "string",
        lat: 0,
        lng: 0,
        estimatedCost: 0,
        notes: "string"
      }
    ],
    dailyPlan: [
      {
        day: 1,
        city: "string",
        tags: ["string"],
        items: [
          {
            time: "09:00",
            title: "string",
            name: "string",
            type: "poi",
            city: "string",
            lat: 0,
            lng: 0,
            estimatedCost: 0,
            notes: "string"
          }
        ]
      }
    ],
    totalEstimatedCost: {
      amount: 1000,
      currency: "EUR"
    }
  };

  return [
    "Sei un travel planner professionale.",
    "",
    "IMPORTANTE SULLA LINGUA:",
    "- Rispondi SEMPRE nella stessa lingua della richiesta utente.",
    "- Se la lingua della richiesta utente non è chiara, usa " + uiLanguageName + ".",
    "- Mantieni la stessa lingua in tutto il JSON: tripTitle, style, city, tags, title, name, notes.",
    "",
    "Devi restituire SOLO JSON valido.",
    "Nessun markdown.",
    "Nessun testo fuori dal JSON.",
    "Nessun commento.",
    "Nessuna spiegazione.",
    "",
    "CONTESTO DAL FRONTEND:",
    selectedCountryText,
    "",
    "MODALITA:",
    modeText,
    "",
    "VIAGGIO ESISTENTE:",
    currentTripText,
    "",
    "RICHIESTA UTENTE:",
    String(userMessage || ""),
    "",
    "REGOLE GENERALI:",
    "- Genera o modifica un itinerario realistico, coerente e utile rispetto alla richiesta utente.",
    "- Se esiste un viaggio esistente, modifica quel viaggio invece di crearne uno nuovo.",
    "- Non cambiare destinazione se l'utente non lo chiede chiaramente.",
    "- Non cambiare numero di giorni se l'utente non lo chiede chiaramente.",
    "- Non cambiare budget se l'utente non lo chiede chiaramente.",
    "- Se modifichi il viaggio, restituisci comunque il JSON completo, non solo le parti cambiate.",
    "- Mantieni la struttura JSON indicata nello schema.",
    "- Usa coordinate lat/lng solo se abbastanza affidabili.",
    "- Ogni giorno deve avere almeno un item.",
    "- dailyPlan deve avere esattamente un elemento per ogni giorno.",
    "- I giorni devono essere consecutivi: 1, 2, 3, ...",
    "- Usa solo questi type: poi, restaurant, activity, transport, hotel.",
    "- summary.people deve essere un numero; se non inferibile usa 2.",
    "- summary.days deve essere un numero.",
    "- summary.budget.amount deve essere un numero.",
    "- summary.budget.currency deve essere la valuta ufficiale del paese.",
    "- totalEstimatedCost.amount deve essere un numero.",
    "",
    "REGOLE SPECIFICHE PER MODIFICA:",
    "- Se l'utente dice di aggiungere ristoranti economici, aggiungi o sostituisci item di tipo restaurant.",
    "- Se l'utente dice di rendere un giorno più rilassante, riduci il numero di tappe e inserisci attività più leggere.",
    "- Se l'utente dice di togliere musei, rimuovi o sostituisci i musei.",
    "- Conserva le coordinate già presenti quando sono ancora coerenti.",
    "- Aggiorna totalEstimatedCost se i costi cambiano.",
    "",
    "SCHEMA JSON OBBLIGATORIO:",
    JSON.stringify(schemaExample, null, 2),
    "",
    "Restituisci SOLO JSON valido.",
    "Non aggiungere testo prima o dopo."
  ].join("\n");
}

// ===== Routes =====
app.post("/api/plan", async (req, res) => {
  const { userMessage, context } = req.body || {};
  
  console.log("USER MESSAGE:", userMessage);
  console.log("MODE:", context?.mode);
  console.log("CURRENT TRIP PRESENTE:", !!context?.currentTrip);
  console.log("CURRENT TRIP TITLE:", context?.currentTrip?.tripTitle);

  if (!userMessage || typeof userMessage !== "string") {
    return res.status(400).json({
      error: "userMessage mancante o non valido.",
    });
  }

  const t0 = Date.now();
  let tOpenAI = 0;
  let tParse = 0;
  let tImages = 0;

  try {
    console.time("openai");

    const prompt = buildPlannerPrompt(userMessage, context);

    const response = await client.responses.create({
      model: "gpt-5.4",
      input: prompt,
    });

    tOpenAI = Date.now();
    console.timeEnd("openai");

    console.time("parse");

    const rawText = response.output_text || "";
    const jsonText = extractJsonObject(rawText);
    const parsedJson = JSON.parse(jsonText);
    const normalizedJson = normalizeTrip(parsedJson);
    const trip = TripSchema.parse(normalizedJson);

    tParse = Date.now();
    console.timeEnd("parse");

    console.time("images");

    try {
      const countryName = trip?.country?.name || "";
      const mainCity = trip?.dailyPlan?.[0]?.city || "";

      const coverQuery = mainCity
        ? `${mainCity} ${countryName} travel`
        : `${countryName} travel`;

      console.log("PEXELS key presente:", !!process.env.PEXELS_API_KEY);
      console.log("Cover query:", coverQuery);

      trip.coverImage = await searchPexelsImage(coverQuery);
      console.log("Cover image trovata:", trip.coverImage);

      if (Array.isArray(trip.dailyPlan)) {
        const usedImages = new Set();

        if (trip.coverImage) {
          usedImages.add(trip.coverImage);
        }

        for (const day of trip.dailyPlan) {
          const dayQuery = buildDayImageQuery(day, countryName);

          let dayImage = await searchPexelsImage(`${dayQuery} landmark travel photography`);

          if (!dayImage) {
            dayImage = await searchPexelsImage(`${day.city || countryName} landmark travel`);
          }

          if (dayImage && !usedImages.has(dayImage)) {
            day.imageUrl = dayImage;
            usedImages.add(dayImage);
          } else {
            day.imageUrl = dayImage || trip.coverImage || null;
          }

          if (Array.isArray(day.items)) {
            for (const item of day.items) {
              const itemQuery = buildItemImageQuery(item, day, countryName);

              let itemImage = await searchPexelsImage(itemQuery);

              if (!itemImage) {
                itemImage = await searchPexelsImage(
                  `${day.city || countryName} ${countryName} travel photography`
                );
              }

              if (!itemImage) {
                itemImage = day.imageUrl || trip.coverImage || null;
              }

              if (itemImage && !usedImages.has(itemImage)) {
                item.imageUrl = itemImage;
                usedImages.add(itemImage);
              } else {
                item.imageUrl = day.imageUrl || trip.coverImage || itemImage || null;
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("Errore arricchimento immagini viaggio:", error);
    }

    tImages = Date.now();
    console.timeEnd("images");

    console.log("PERFORMANCE /api/plan:", {
      openaiMs: tOpenAI - t0,
      parseMs: tParse - tOpenAI,
      imagesMs: tImages - tParse,
      totalMs: tImages - t0
    });

    return res.json(trip);
  } catch (error) {
    console.error("Errore /api/plan:", error);

    if (IS_DEV) {
      console.warn("Uso demoTrip() come fallback in ambiente development.");
      return res.json(demoTrip());
    }

    return res.status(500).json({
      error: "Impossibile generare il viaggio in questo momento.",
    });
  }
});

app.post("/api/saveTrip", async (req, res) => {
  const { userId, trip } = req.body || {};

  if (!userId || typeof userId !== "string") {
    return res.status(400).json({ error: "userId mancante o non valido." });
  }

  if (!trip || typeof trip !== "object") {
    return res.status(400).json({ error: "trip mancante o non valido." });
  }

  try {
    const savedTrip = {
      userId,
      tripTitle: trip.tripTitle || "Viaggio salvato",
      country: trip.country || {},
      summary: trip.summary || {},
      dailyPlan: Array.isArray(trip.dailyPlan) ? trip.dailyPlan : [],
      hotels: Array.isArray(trip.hotels) ? trip.hotels : [],
      places: Array.isArray(trip.places) ? trip.places : [],
      totalEstimatedCost: trip.totalEstimatedCost || {},
      createdAt: new Date(),
      trip
    };

    const result = await tripsCollection.insertOne(savedTrip);

    return res.json({
      ok: true,
      message: "Viaggio salvato correttamente.",
      tripId: result.insertedId
    });
  } catch (error) {
    console.error("Errore /api/saveTrip:", error);
    return res.status(500).json({ error: "Errore durante il salvataggio del viaggio." });
  }
});

app.get("/api/trips", async (req, res) => {
  const userId = req.query.userId;

  if (!userId || typeof userId !== "string") {
    return res.status(400).json({ error: "userId mancante o non valido." });
  }

  try {
    const userTrips = await tripsCollection
      .find({ userId })
      .sort({ createdAt: -1 })
      .toArray();

    return res.json({
      ok: true,
      trips: userTrips
    });
  } catch (error) {
    console.error("Errore /api/trips:", error);
    return res.status(500).json({ error: "Errore durante il recupero dei viaggi." });
  }
});

app.delete("/api/trips/:id", async (req, res) => {
  const tripId = req.params.id;
  const userId = req.query.userId;

  if (!tripId) {
    return res.status(400).json({ error: "tripId mancante." });
  }

  if (!userId || typeof userId !== "string") {
    return res.status(400).json({ error: "userId mancante o non valido." });
  }

  try {
    const result = await tripsCollection.deleteOne({
      _id: new ObjectId(tripId),
      userId
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Viaggio non trovato o non autorizzato." });
    }

    return res.json({
      ok: true,
      message: "Viaggio eliminato correttamente."
    });
  } catch (error) {
    console.error("Errore DELETE /api/trips/:id:", error);
    return res.status(500).json({ error: "Errore durante l'eliminazione del viaggio." });
  }
});

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.post("/api/register", async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: "Email e password richieste." });
  }

  try {
    const existing = await usersCollection.findOne({ email });

    if (existing) {
      return res.status(400).json({ error: "Utente già esistente." });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = {
      email,
      password: hashedPassword,
      createdAt: new Date().toISOString()
    };

    const result = await usersCollection.insertOne(user);

    return res.json({
      ok: true,
      userId: result.insertedId.toString(),
      email
    });

  } catch (err) {
    console.error("Errore register:", err);
    return res.status(500).json({ error: "Errore registrazione." });
  }
});

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: "Email e password richieste." });
  }

  try {
    const user = await usersCollection.findOne({ email });

    if (!user) {
  return res.status(401).json({ error: "Credenziali non valide." });
}

const isMatch = await bcrypt.compare(password, user.password);

if (!isMatch) {
  return res.status(401).json({ error: "Credenziali non valide." });
}

    return res.json({
      ok: true,
      userId: user._id.toString(),
      email: user.email
    });

  } catch (err) {
    console.error("Errore login:", err);
    return res.status(500).json({ error: "Errore login." });
  }
});

async function startServer() {
  await connectMongo();

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`API in ascolto su http://0.0.0.0:${PORT}`);
  });
}

startServer();