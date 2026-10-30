const searchForm = document.querySelector("#search-form");
const placeInput = document.querySelector("#place-input");
const searchResults = document.querySelector("#search-results");
const locationButton = document.querySelector("#location-button");
const statusMessage = document.querySelector("#status");
const weatherContent = document.querySelector("#weather");
const GEOCODING_API = "https://geocoding-api.open-meteo.com/v1/search";
const WEATHER_API = "https://api.met.no/weatherapi/locationforecast/2.0/compact";

const weatherDescriptions = {
  clearsky: ["Klart", "☀️"],
  fair: ["Lettskyet", "🌤️"],
  partlycloudy: ["Delvis skyet", "⛅"],
  cloudy: ["Skyet", "☁️"],
  fog: ["Tåke", "🌫️"],
  lightrain: ["Lett regn", "🌦️"],
  rain: ["Regn", "🌧️"],
  heavyrain: ["Kraftig regn", "🌧️"],
  lightrainshowers: ["Lette regnbyger", "🌦️"],
  rainshowers: ["Regnbyger", "🌧️"],
  heavyrainshowers: ["Kraftige regnbyger", "🌧️"],
  lightsleet: ["Lett sludd", "🌧️"],
  sleet: ["Sludd", "🌨️"],
  heavysleet: ["Kraftig sludd", "🌨️"],
  lightsleetshowers: ["Lette sluddbyger", "🌧️"],
  sleetshowers: ["Sluddbyger", "🌨️"],
  heavysleetshowers: ["Kraftige sluddbyger", "🌨️"],
  lightsnow: ["Lett snø", "🌨️"],
  snow: ["Snø", "❄️"],
  heavysnow: ["Kraftig snø", "❄️"],
  lightsnowshowers: ["Lette snøbyger", "🌨️"],
  snowshowers: ["Snøbyger", "❄️"],
  heavysnowshowers: ["Kraftige snøbyger", "❄️"],
  thunder: ["Torden", "⛈️"],
  lightrainandthunder: ["Lett regn og torden", "⛈️"],
  rainandthunder: ["Regn og torden", "⛈️"],
  heavyrainandthunder: ["Kraftig regn og torden", "⛈️"],
  lightsleetandthunder: ["Lett sludd og torden", "⛈️"],
  sleetandthunder: ["Sludd og torden", "⛈️"],
  heavysleetandthunder: ["Kraftig sludd og torden", "⛈️"],
  lightsnowandthunder: ["Lett snø og torden", "⛈️"],
  snowandthunder: ["Snø og torden", "⛈️"],
  heavysnowandthunder: ["Kraftig snø og torden", "⛈️"],
};

function setStatus(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.classList.toggle("error", isError);
  statusMessage.hidden = !message;
}

async function getJson(url) {
  const response = await fetch(url);
  const body = await response.text();
  let data;
  try {
    data = JSON.parse(body);
  } catch {
    const preview = body.slice(0, 160).replace(/\s+/g, " ").trim();
    throw new Error(
      `API-et svarte ikke med JSON (HTTP ${response.status}). Svar: ${preview || "tomt svar"}`,
    );
  }
  if (!response.ok) {
    throw new Error(data.error || "Noe gikk galt. Prøv igjen.");
  }
  return data;
}

function geocodingUrl(query) {
  const url = new URL(GEOCODING_API);
  url.search = new URLSearchParams({
    name: query,
    count: "6",
    language: "no",
    format: "json",
  });
  return url;
}

function weatherUrl(latitude, longitude) {
  const url = new URL(WEATHER_API);
  url.search = new URLSearchParams({
    lat: latitude,
    lon: longitude,
  });
  return url;
}

function conditionFor(symbol) {
  const key = symbol?.replace(/_(day|night|polartwilight)$/, "");
  return weatherDescriptions[key] || ["Ukjent vær", "🌡️"];
}

function formatDay(dateString) {
  const date = new Date(`${dateString}T12:00:00`);
  return new Intl.DateTimeFormat("no-NO", { weekday: "short" })
    .format(date)
    .replace(".", "");
}

function renderForecast(timeseries) {
  const daily = new Map();
  for (const entry of timeseries) {
    const date = entry.time.slice(0, 10);
    const details = entry.data.instant.details;
    const hour = Number(entry.time.slice(11, 13));
    const symbol = entry.data.next_6_hours?.summary?.symbol_code
      || entry.data.next_1_hours?.summary?.symbol_code;
    if (!daily.has(date)) {
      daily.set(date, {
        low: details.air_temperature,
        high: details.air_temperature,
        symbol,
        rain: 0,
        symbolHour: -1,
      });
    }
    const day = daily.get(date);
    day.low = Math.min(day.low, details.air_temperature);
    day.high = Math.max(day.high, details.air_temperature);
    if (symbol && (hour >= 12 && day.symbolHour < 12 || day.symbolHour === -1)) {
      day.symbol = symbol;
      day.symbolHour = hour;
    }
    day.rain = Math.max(
      day.rain,
      entry.data.next_6_hours?.details?.precipitation_amount ?? 0,
      entry.data.next_1_hours?.details?.precipitation_amount ?? 0,
    );
  }

  const days = [...daily.entries()].slice(0, 5);
  document.querySelector("#forecast").replaceChildren(
    ...days.map(([date, day], index) => {
      const card = document.createElement("article");
      card.className = "forecast-day";
      const [description, icon] = conditionFor(day.symbol);
      card.setAttribute("aria-label", `${index === 0 ? "I dag" : formatDay(date)}: ${description}`);
      const name = document.createElement("span");
      name.className = "day-name";
      name.textContent = index === 0 ? "I dag" : formatDay(date);
      const weatherIcon = document.createElement("span");
      weatherIcon.className = "day-icon";
      weatherIcon.setAttribute("aria-hidden", "true");
      weatherIcon.textContent = icon;
      const temperatures = document.createElement("div");
      temperatures.className = "day-temperatures";
      const high = document.createElement("span");
      high.textContent = `${Math.round(day.high)}°`;
      const low = document.createElement("span");
      low.className = "low";
      low.textContent = `${Math.round(day.low)}°`;
      temperatures.append(high, low);
      const rain = document.createElement("span");
      rain.className = "day-rain";
      rain.textContent = day.rain > 0 ? `↓ ${day.rain.toLocaleString("no-NO")} mm` : description;
      card.append(name, weatherIcon, temperatures, rain);
      return card;
    }),
  );
}

async function loadWeather(place) {
  searchResults.hidden = true;
  weatherContent.hidden = true;
  setStatus(`Henter værvarsel for ${place.name}…`);
  try {
    const data = await getJson(weatherUrl(place.latitude, place.longitude));
    const now = data.properties.timeseries[0];
    if (!now) {
      throw new Error("Yr hadde ingen værdata for dette stedet.");
    }
    const details = now.data.instant.details;
    const nextHour = now.data.next_1_hours;
    const [description, icon] = conditionFor(nextHour?.summary?.symbol_code);
    document.querySelector("#place-name").textContent = [place.name, place.admin1]
      .filter(Boolean)
      .join(", ");
    document.querySelector("#updated-at").textContent = `Oppdatert ${new Intl.DateTimeFormat("no-NO", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(now.time))}`;
    document.querySelector("#current-icon").textContent = icon;
    document.querySelector("#temperature").textContent = Math.round(details.air_temperature);
    document.querySelector("#condition").textContent = description;
    document.querySelector("#wind").textContent = `${details.wind_speed.toLocaleString("no-NO")} m/s`;
    document.querySelector("#humidity").textContent = `${Math.round(details.relative_humidity)} %`;
    document.querySelector("#precipitation").textContent =
      `${nextHour?.details?.precipitation_amount ?? 0} mm`;
    renderForecast(data.properties.timeseries);
    weatherContent.hidden = false;
    setStatus("");
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function searchPlaces(query) {
  setStatus("Søker etter sted…");
  searchResults.hidden = true;
  try {
    const data = await getJson(geocodingUrl(query));
    const places = data.results || [];
    if (places.length === 0) {
      setStatus("Fant ingen steder. Prøv et annet søk.", true);
      return;
    }
    searchResults.replaceChildren(
      ...places.map((place) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "result-option";
        button.setAttribute("role", "option");
        button.append(document.createTextNode(place.name));
        const location = document.createElement("small");
        location.textContent = [place.admin1, place.country].filter(Boolean).join(", ");
        button.append(location);
        button.addEventListener("click", () => loadWeather(place));
        return button;
      }),
    );
    searchResults.hidden = false;
    setStatus("");
  } catch (error) {
    setStatus(error.message, true);
  }
}

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const query = placeInput.value.trim();
  if (query.length < 2) {
    setStatus("Skriv minst to bokstaver for å søke.", true);
    return;
  }
  searchPlaces(query);
});

locationButton.addEventListener("click", () => {
  if (!navigator.geolocation) {
    setStatus("Nettleseren din støtter ikke posisjonstjenester.", true);
    return;
  }
  setStatus("Finner posisjonen din…");
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => loadWeather({
      name: "Min posisjon",
      latitude: coords.latitude,
      longitude: coords.longitude,
    }),
    () => setStatus("Fikk ikke tilgang til posisjonen. Søk etter et sted i stedet.", true),
    { timeout: 10000 },
  );
});

document.addEventListener("click", (event) => {
  if (!event.target.closest(".search-panel")) {
    searchResults.hidden = true;
  }
});

searchForm.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    searchResults.hidden = true;
  }
});

searchPlaces("Oslo");
