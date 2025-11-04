// ─────────────────────────────────────────────
// app.js — MVP Finder (Local JSON + Decade Toggle)
// ─────────────────────────────────────────────

const sportButtons = document.querySelectorAll(".pill");
const yearInput = document.getElementById("year");
const findBtn = document.getElementById("findBtn");
const clearBtn = document.getElementById("clearBtn");
const decadeBtn = document.getElementById("decadeBtn");

const resultBody = document.getElementById("resultBody");
const errorBanner = document.getElementById("errorBanner");
const decadeList = document.getElementById("decadeList");
const decadeTbody = document.getElementById("decadeTbody");

let selectedSport = null;
let showingDecade = false;
let dataCache = { nba: [], nfl: [], mlb: [] };

// ─────────────────────────────────────────────
// Load JSON data for all sports; I used to live fetch from stat websites, but they oftentimes timed out.
// Instead I downloaded the data and serve it locally from the data/ folder as a JSON file, to make sure it's always available.
// ─────────────────────────────────────────────
async function loadData() {
  try {
    const [nba, nfl, mlb] = await Promise.all([
      fetch("data/nba_mvp.json").then((res) => res.json()),
      fetch("data/nfl_mvp.json").then((res) => res.json()),
      fetch("data/mlb_mvp.json").then((res) => res.json()),
    ]);

    dataCache = { nba, nfl, mlb };
    console.log("✅ Loaded local MVP data for all sports");
  } catch (err) {
    console.error("❌ Error loading MVP data", err);
    showError("Could not load MVP data. Please check your data folder.");
  }
}

// ─────────────────────────────────────────────
// UI Helpers
// ─────────────────────────────────────────────
function showError(msg) {
  errorBanner.textContent = msg;
  errorBanner.style.display = "block";
  setTimeout(() => (errorBanner.style.display = "none"), 3000);
}

function clearResults() {
  resultBody.textContent = "Select a sport and enter your birth year to uncover your MVP.";
  decadeList.style.display = "none";
  showingDecade = false;
  yearInput.value = "";
  sportButtons.forEach((b) => b.setAttribute("aria-pressed", "false"));
  selectedSport = null;
}

// ─────────────────────────────────────────────
// Handle sport selection
// ─────────────────────────────────────────────
sportButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    sportButtons.forEach((b) => b.setAttribute("aria-pressed", "false"));
    btn.setAttribute("aria-pressed", "true");
    selectedSport = btn.getAttribute("data-sport").toLowerCase();
  });
});

// ─────────────────────────────────────────────
// Find MVP for entered year
// ─────────────────────────────────────────────
function findMVP() {
  const year = parseInt(yearInput.value);
  if (!selectedSport) return showError("Please select a sport first!");
  if (!year) return showError("Please enter a valid year.");

  const sportData = dataCache[selectedSport];
  const entry = sportData.find((item) => item.year === year);

  if (entry) {
    // MVP heading and sentence
    resultBody.innerHTML = `
      <h2>The MVP${entry.mvp.length > 1 ? "s" : ""} of ${year} in the ${selectedSport.toUpperCase()} ${
        entry.mvp.length > 1 ? "were:" : "was:"
      }</h2>
      <div class="chips">
        ${entry.mvp.map((name) => `<span class="chip">${name}</span>`).join("")}
      </div>
    `;
  } else {
    resultBody.innerHTML = `<p class="error">No MVP found for ${year}.</p>`;
  }
}

// ─────────────────────────────────────────────
// Toggle decade view
// ─────────────────────────────────────────────
function toggleDecadeView() {
  if (!selectedSport) return showError("Please select a sport first!");

  showingDecade = !showingDecade;
  if (showingDecade) {
    const sportData = dataCache[selectedSport];
    const year = parseInt(yearInput.value);
    const decadeStart = Math.floor(year / 10) * 10;

    const decadeData = sportData.filter(
      (entry) => entry.year >= decadeStart && entry.year < decadeStart + 10
    );

    if (decadeData.length === 0) {
      showError("No data for that decade.");
      return;
    }

    const rows = decadeData
      .map(
        (entry) => `<tr><td>${entry.year}</td><td>${entry.mvp.join(", ")}</td></tr>`
      )
      .join("");

    decadeTbody.innerHTML = rows;
    decadeList.style.display = "block";
  } else {
    decadeList.style.display = "none";
  }
}

// ─────────────────────────────────────────────
// Event listeners
// ─────────────────────────────────────────────
findBtn.addEventListener("click", findMVP);
clearBtn.addEventListener("click", clearResults);
decadeBtn.addEventListener("click", toggleDecadeView);

// ─────────────────────────────────────────────
// Initialize
// ─────────────────────────────────────────────
loadData();
