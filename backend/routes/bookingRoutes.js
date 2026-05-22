const express = require("express");
const router = express.Router();

const {
  searchHotels,
  searchActivities,
  searchFlights,
} = require("../services/booking/bookingAggregator");

router.get("/hotels", async (req, res) => {
  try {
    const { city, country, checkIn, checkOut, adults, budgetLevel } = req.query;

    if (!city) {
      return res.status(400).json({
        success: false,
        error: "Parametro city mancante.",
      });
    }

    const hotels = await searchHotels({
      city,
      country,
      checkIn,
      checkOut,
      adults: adults ? Number(adults) : 2,
      budgetLevel: budgetLevel || "medium",
    });

    return res.json({
      success: true,
      count: hotels.length,
      hotels,
    });
  } catch (error) {
    console.error("Errore ricerca hotel:", error);

    return res.status(500).json({
      success: false,
      error: "Errore durante la ricerca hotel.",
    });
  }
});

router.get("/activities", async (req, res) => {
  try {
    const {
      city,
      country,
      date,
      travelers,
      category,
      budgetLevel,
    } = req.query;

    if (!city) {
      return res.status(400).json({
        success: false,
        error: "Parametro city mancante.",
      });
    }

    const activities = await searchActivities({
      city,
      country,
      date,
      travelers: travelers ? Number(travelers) : 2,
      category: category || "all",
      budgetLevel: budgetLevel || "medium",
    });

    return res.json({
      success: true,
      count: activities.length,
      activities,
    });
  } catch (error) {
    console.error("Errore ricerca attività:", error);

    return res.status(500).json({
      success: false,
      error: "Errore durante la ricerca attività.",
    });
  }
});

router.get("/flights", async (req, res) => {
  try {
    const {
      from,
      to,
      departureDate,
      returnDate,
      travelers,
      cabin,
      budgetLevel,
    } = req.query;

    const flights = await searchFlights({
      from: from || "FCO",
      to: to || "CIA",
      departureDate,
      returnDate,
      travelers: travelers ? Number(travelers) : 2,
      cabin: cabin || "economy",
      budgetLevel: budgetLevel || "medium",
    });

    return res.json({
      success: true,
      count: flights.length,
      flights,
    });
  } catch (error) {
    console.error("Errore ricerca voli:", error);

    return res.status(500).json({
      success: false,
      error: "Errore durante la ricerca voli.",
    });
  }
});

module.exports = router;