// Viva La Spurs - Main JS
// NOTE: Replace this with your own BallDontLie API key.
const API_KEY = "36c123e4-1d22-4f1a-b444-011d38c62afe";
const BASE_URL = "https://api.balldontlie.io/v1";
const SPURS_ID = 27;

// Default to the same season as your working apiTest file:
// BallDontLie uses the season *start* year, so 2022 = 2022–2023
const ACTIVE_SEASON = 2022;
let currentSeason = ACTIVE_SEASON;

// Global state
let allGames = [];
let currentFilter = "all"; // "all" | "wins"
let favorites = [];
const FAVORITES_KEY = "viva_spurs_favorites";

let triviaQuestions = [];
let currentQuestionIndex = 0;
let triviaScore = 0;
let questionLocked = false;

// Init
document.addEventListener("DOMContentLoaded", () => {
  initSmoothScroll();
  initScrollSpy();
  initTimeline();
  initFavorites();
  initTriviaQuestions();
  initTriviaUI();
  initSeasonSelect();

  fetchTeamInfo();
  fetchRecentGames();
});

/* -----------------------------
   TEAM INFO
----------------------------- */
async function fetchTeamInfo() {
  const blurb = document.getElementById("team-blurb");
  try {
    const res = await fetch(`${BASE_URL}/teams/${SPURS_ID}`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });

    if (!res.ok) throw new Error("Team fetch failed");

    const json = await res.json();
    const team = json.data;

    blurb.textContent = `${team.full_name} • ${team.conference} Conference, ${team.division} Division — based in ${team.city}.`;
  } catch (err) {
    console.error(err);
    blurb.textContent =
      "Unable to load team info right now. Refresh to try again.";
  }
}

/* -----------------------------
   RECENT GAMES
----------------------------- */
async function fetchRecentGames(season = currentSeason) {
  const gamesContainer = document.getElementById("games-container");
  const seasonLabel = document.getElementById("season-label");

  currentSeason = season;
  seasonLabel.textContent = `Season ${season}–${season + 1}`;

  gamesContainer.innerHTML = `<p class="loading-text">Loading recent games…</p>`;

  try {
    const url = `${BASE_URL}/games?team_ids[]=${SPURS_ID}&seasons[]=${season}&per_page=100`;
    console.log("Fetching games URL:", url);

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });

    if (!res.ok) throw new Error("Failed to fetch games");

    const data = await res.json();
    let games = data.data;

    if (!Array.isArray(games) || games.length === 0) {
      gamesContainer.innerHTML =
        '<p class="loading-text">No games available for this season.</p>';
      return;
    }

    // Match apiTest.html: sort by date DESC, then take the most recent 10
    games.sort((a, b) => new Date(b.date) - new Date(a.date));
    games = games.slice(0, 10);

    // Map to richer structure for the UI
    allGames = games.map((game) => {
      const home = `${game.home_team.city} ${game.home_team.name}`;
      const away = `${game.visitor_team.city} ${game.visitor_team.name}`;

      const homeScore = game.home_team_score;
      const awayScore = game.visitor_team_score;

      const spursAtHome = game.home_team.id === SPURS_ID;
      const spursScore = spursAtHome ? homeScore : awayScore;
      const oppScore = spursAtHome ? awayScore : homeScore;
      const isWin = spursScore > oppScore;
      const dateObj = new Date(game.date);
      const displayDate = dateObj.toISOString().slice(0, 10);

      const opponentName = spursAtHome ? away : home;

      return {
        id: game.id,
        raw: game,
        isWin,
        date: displayDate,
        home,
        away,
        homeScore,
        awayScore,
        spursAtHome,
        spursScore,
        oppScore,
        opponentName,
      };
    });

    initFilterButtons();
    renderGames();
    renderFavorites();
  } catch (err) {
    console.error(err);
    gamesContainer.innerHTML =
      '<p class="loading-text">Error loading games. Please try again later.</p>';
  }
}

/* -----------------------------
   SEASON SELECT
----------------------------- */
function initSeasonSelect() {
  const select = document.getElementById("season-select");
  if (!select) return;

  // You can adjust this range however you like
  const seasons = [
    ACTIVE_SEASON,
    ACTIVE_SEASON - 1,
    ACTIVE_SEASON - 2,
    ACTIVE_SEASON - 3,
  ];

  seasons.forEach((year) => {
    const option = document.createElement("option");
    option.value = year;
    option.textContent = `${year}–${year + 1}`;
    if (year === currentSeason) {
      option.selected = true;
    }
    select.appendChild(option);
  });

  select.addEventListener("change", () => {
    const newSeason = Number(select.value);
    fetchRecentGames(newSeason);
  });
}

function initFilterButtons() {
  const chips = document.querySelectorAll(".filter-toggle .btn.chip");
  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      const filter = chip.getAttribute("data-filter");
      if (!filter || filter === currentFilter) return;
      currentFilter = filter;

      chips.forEach((c) => c.classList.remove("chip-active"));
      chip.classList.add("chip-active");

      renderGames();
    });
  });
}

function renderGames() {
  const gamesContainer = document.getElementById("games-container");
  if (!allGames.length) {
    gamesContainer.innerHTML =
      '<p class="loading-text">No games loaded yet.</p>';
    return;
  }

  let gamesToShow = allGames;
  if (currentFilter === "wins") {
    gamesToShow = allGames.filter((g) => g.isWin);
  }

  if (!gamesToShow.length) {
    gamesContainer.innerHTML =
      '<p class="loading-text">No games match this filter.</p>';
    return;
  }

  gamesContainer.innerHTML = gamesToShow
    .map((game) => {
      const resultText = game.isWin ? "W" : "L";
      const resultClass = game.isWin ? "status-win" : "status-loss";
      const locationLabel = game.spursAtHome ? "Home" : "Away";
      const favored = favorites.includes(game.id);

      return `
        <article class="game-card ${
          game.isWin ? "win-card" : "loss-card"
        }" data-game-id="${game.id}">
          <div class="game-card-header">
            <span class="game-date">${game.date}</span>
            <span class="game-result ${resultClass}">${resultText}</span>
          </div>
          <div class="game-opponent">${game.opponentName}</div>
          <div class="game-scoreline">
            Spurs ${game.spursScore} – ${
        game.oppScore
      } <span>(${locationLabel})</span>
          </div>

          <div class="game-footer">
            <button
              class="game-favorite-btn ${
                favored ? "favorited" : ""
              }" data-game-id="${game.id}" type="button"
            >
              <span>${favored ? "★ Favorited" : "☆ Favorite"}</span>
            </button>
            <span>Click card for details</span>
          </div>

          <div class="game-details">
            <p>
              Full matchup: ${game.away} @ ${game.home}
            </p>
            <p>
              Final score: ${game.home} ${game.homeScore} – ${game.away} ${
        game.awayScore
      }
            </p>
          </div>
        </article>
      `;
    })
    .join("");

  // Attach event listeners (delegation)
  gamesContainer.addEventListener("click", handleGameCardClick, {
    once: true,
  });
}

function handleGameCardClick(event) {
  const favoriteBtn = event.target.closest(".game-favorite-btn");
  if (favoriteBtn) {
    event.stopPropagation();
    const gameId = Number(favoriteBtn.getAttribute("data-game-id"));
    toggleFavorite(gameId);
    renderGames();
    renderFavorites();
    return;
  }

  const card = event.target.closest(".game-card");
  if (!card) return;

  card.classList.toggle("expanded");
}

/* -----------------------------
   FAVORITES (LOCAL STORAGE)
----------------------------- */
function initFavorites() {
  try {
    const stored = localStorage.getItem(FAVORITES_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        favorites = parsed;
      }
    }
  } catch (err) {
    console.error("Error reading favorites from localStorage", err);
  }
  renderFavorites();
}

function toggleFavorite(gameId) {
  if (favorites.includes(gameId)) {
    favorites = favorites.filter((id) => id !== gameId);
  } else {
    favorites.push(gameId);
  }
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  } catch (err) {
    console.error("Error saving favorites", err);
  }
}

function renderFavorites() {
  const container = document.getElementById("favorites-list");
  if (!container) return;

  if (!favorites.length) {
    container.innerHTML =
      '<p class="hint-text">No favorite games yet — add some from the Recent Games section.</p>';
    return;
  }

  if (!allGames.length) {
    container.innerHTML =
      '<p class="hint-text">Favorites saved! They will appear once games load.</p>';
    return;
  }

  const favoriteGames = allGames.filter((g) => favorites.includes(g.id));
  if (!favoriteGames.length) {
    container.innerHTML =
      '<p class="hint-text">Your saved favorites are from a different season, so none match the current results.</p>';
    return;
  }

  container.innerHTML = favoriteGames
    .map((game) => {
      const resultText = game.isWin ? "W" : "L";
      const resultClass = game.isWin ? "status-win" : "status-loss";
      return `
        <div class="favorite-pill">
          <span class="${resultClass}">${resultText}</span>
          <span>${game.date}</span>
          <span>vs ${game.opponentName}</span>
        </div>
      `;
    })
    .join("");
}

/* -----------------------------
   TIMELINE INTERACTIONS
----------------------------- */
function initTimeline() {
  const items = document.querySelectorAll(".timeline-item");
  items.forEach((item) => {
    const header = item.querySelector(".timeline-item-header");
    if (!header) return;
    header.addEventListener("click", () => {
      const isOpen = item.classList.contains("open");
      items.forEach((i) => i.classList.remove("open"));
      if (!isOpen) {
        item.classList.add("open");
      }
    });
  });
}

/* -----------------------------
   SMOOTH SCROLL + NAV HIGHLIGHT
----------------------------- */
function initSmoothScroll() {
  const buttons = document.querySelectorAll("[data-scroll-target]");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetSelector = btn.getAttribute("data-scroll-target");
      if (!targetSelector) return;
      const target = document.querySelector(targetSelector);
      if (!target) return;
      target.scrollIntoView({ behavior: "smooth" });
    });
  });

  const navLinks = document.querySelectorAll('.site-nav a[href^="#"]');
  navLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      const href = link.getAttribute("href");
      const id = href && href.startsWith("#") ? href.slice(1) : null;
      if (!id) return;
      const target = document.getElementById(id);
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: "smooth" });
    });
  });
}

function initScrollSpy() {
  const sections = document.querySelectorAll("main section.panel");
  const navLinks = document.querySelectorAll(".site-nav a");

  if (!sections.length || !navLinks.length) return;

  window.addEventListener("scroll", () => {
    let currentId = "";

    sections.forEach((section) => {
      const rect = section.getBoundingClientRect();
      if (rect.top <= 140 && rect.bottom >= 140) {
        currentId = section.id;
      }
    });

    navLinks.forEach((link) => {
      const href = link.getAttribute("href");
      const id = href && href.startsWith("#") ? href.slice(1) : "";
      if (id === currentId) {
        link.classList.add("active");
      } else {
        link.classList.remove("active");
      }
    });
  });
}

/* -----------------------------
   TRIVIA
----------------------------- */
function initTriviaQuestions() {
  triviaQuestions = [
    {
      question: "Which legendary Spur is nicknamed 'The Iceman'?",
      options: [
        "Tim Duncan",
        "George Gervin",
        "David Robinson",
        "Kawhi Leonard",
      ],
      answerIndex: 1,
      explanation:
        "George Gervin was known as 'The Iceman' for his smooth scoring style.",
    },
    {
      question: "How many championships did Tim Duncan win with the Spurs?",
      options: ["2", "3", "4", "5"],
      answerIndex: 3,
      explanation: "Tim Duncan led the Spurs to 5 NBA championships.",
    },
    {
      question: "Which trio defined the Spurs dynasty era?",
      options: [
        "Duncan, Manu, Parker",
        "Duncan, Robinson, Gervin",
        "Kawhi, Manu, Robinson",
        "Parker, Kawhi, Gervin",
      ],
      answerIndex: 0,
      explanation:
        "Tim Duncan, Manu Ginóbili, and Tony Parker formed the core of the Spurs dynasty.",
    },
    {
      question: "Victor Wembanyama was drafted by the Spurs in which year?",
      options: ["2021", "2022", "2023", "2024"],
      answerIndex: 2,
      explanation:
        "Wemby was selected 1st overall by the Spurs in the 2023 NBA Draft.",
    },
    {
      question:
        "Who is the long-time head coach associated with the Spurs' culture?",
      options: [
        "Phil Jackson",
        "Gregg Popovich",
        "Erik Spoelstra",
        "Steve Kerr",
      ],
      answerIndex: 1,
      explanation:
        "Gregg Popovich is the legendary head coach behind the Spurs’ culture and success.",
    },
  ];
}

function initTriviaUI() {
  const nextBtn = document.getElementById("quiz-next");
  const optionsContainer = document.getElementById("quiz-options");

  if (!nextBtn || !optionsContainer) return;

  nextBtn.addEventListener("click", handleNextQuestion);
  optionsContainer.addEventListener("click", handleOptionClick);

  currentQuestionIndex = 0;
  triviaScore = 0;
  questionLocked = false;

  renderTriviaQuestion();
}

function renderTriviaQuestion() {
  const q = triviaQuestions[currentQuestionIndex];
  const qEl = document.getElementById("quiz-question");
  const optionsEl = document.getElementById("quiz-options");
  const feedbackEl = document.getElementById("quiz-feedback");
  const progressEl = document.getElementById("quiz-progress");
  const scoreEl = document.getElementById("quiz-score");
  const nextBtn = document.getElementById("quiz-next");

  if (!qEl || !optionsEl || !feedbackEl || !progressEl || !scoreEl || !nextBtn)
    return;

  qEl.textContent = q.question;
  optionsEl.innerHTML = q.options
    .map(
      (opt, i) =>
        `<button class="quiz-option-btn" type="button" data-index="${i}">${opt}</button>`
    )
    .join("");

  feedbackEl.textContent = "";
  progressEl.textContent = `Question ${currentQuestionIndex + 1} of ${
    triviaQuestions.length
  }`;
  scoreEl.textContent = `Score: ${triviaScore}/${triviaQuestions.length}`;

  nextBtn.disabled = true;
  questionLocked = false;
}

function handleOptionClick(event) {
  const btn = event.target.closest(".quiz-option-btn");
  if (!btn || questionLocked) return;

  const selectedIndex = Number(btn.getAttribute("data-index"));
  const q = triviaQuestions[currentQuestionIndex];

  const optionsEl = document.getElementById("quiz-options");
  const feedbackEl = document.getElementById("quiz-feedback");
  const nextBtn = document.getElementById("quiz-next");

  if (!optionsEl || !feedbackEl || !nextBtn) return;

  const optionButtons = optionsEl.querySelectorAll(".quiz-option-btn");

  optionButtons.forEach((button, idx) => {
    if (idx === q.answerIndex) {
      button.classList.add("correct");
    }
    if (idx === selectedIndex && idx !== q.answerIndex) {
      button.classList.add("incorrect");
    }
  });

  if (selectedIndex === q.answerIndex) {
    triviaScore += 1;
    feedbackEl.textContent = "Correct! " + q.explanation;
  } else {
    feedbackEl.textContent = "Not quite. " + q.explanation;
  }

  questionLocked = true;
  nextBtn.disabled = false;

  const scoreEl = document.getElementById("quiz-score");
  if (scoreEl) {
    scoreEl.textContent = `Score: ${triviaScore}/${triviaQuestions.length}`;
  }
}

function handleNextQuestion() {
  if (!questionLocked) return;

  currentQuestionIndex += 1;
  if (currentQuestionIndex >= triviaQuestions.length) {
    showTriviaSummary();
  } else {
    renderTriviaQuestion();
  }
}

function showTriviaSummary() {
  const qEl = document.getElementById("quiz-question");
  const optionsEl = document.getElementById("quiz-options");
  const feedbackEl = document.getElementById("quiz-feedback");
  const progressEl = document.getElementById("quiz-progress");
  const scoreEl = document.getElementById("quiz-score");
  const nextBtn = document.getElementById("quiz-next");

  if (!qEl || !optionsEl || !feedbackEl || !progressEl || !scoreEl || !nextBtn)
    return;

  qEl.textContent = "Nice work, Spurs fan!";
  optionsEl.innerHTML = "";
  feedbackEl.textContent =
    triviaScore === triviaQuestions.length
      ? "Perfect score — you bleed silver and black."
      : "You did great! Run it back to chase that perfect Spurs trivia score.";
  progressEl.textContent = "Quiz Complete";
  scoreEl.textContent = `Final Score: ${triviaScore}/${triviaQuestions.length}`;

  nextBtn.disabled = true;
}
