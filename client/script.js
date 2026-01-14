//API-URL till backend (Express)
const API_URL = "http://localhost:3000/recipes";

//Priser för varje maträtt
//Texten måste matcha <select>-alternativen exakt
const MENU_PRICES = {
  "Spaghetti bolognese": 125,
  "Pasta carbonara": 129,
  Kycklinggryta: 119,
  "Köttbullar med potatis": 115,
  Lasagne: 125,
  Hamburgare: 135,
  Kebabtallrik: 129,
  "Pizza Margherita": 115,
  Sushi: 149,
  Tacos: 119,
  "Pad thai": 139,
  Ramen: 145,
  "Fried rice": 119,
  "Fish & chips": 139,
  Caesarsallad: 115,
  "Grillad lax": 159,
  Tomatsoppa: 89,
  Falafel: 109,
  "Vegetarisk chili": 109,
  Pannkakor: 95,
};

//Hämta formuläret och alla inputfält
//IDs måste stämma överens med index.html
const recipeForm = document.getElementById("recipeForm");
const nameEl = document.getElementById("name"); //select för maträtt
const priceEl = document.getElementById("price"); //pris per styck (readonly)
const servingsEl = document.getElementById("servings"); //antal
const totalPriceEl = document.getElementById("totalPrice"); //totalpris (readonly)
const editingIdEl = document.getElementById("editingId"); //dolt id vid redigering

// Knappar i gränssnittet
const btnResetForm = document.getElementById("btnResetForm"); //rensa formulär
const btnRefresh = document.getElementById("btnRefresh"); //hämta lista igen
const btnCancelEdit = document.getElementById("btnCancelEdit"); //avbryt redigering

// Platser där innehåll renderas dynamiskt
const listMount = document.getElementById("listMount"); //lista med maträtter
const feedbackMount = document.getElementById("feedbackMount"); //fallback-feedback

//Bootstrap feedback-modal
const feedbackText = document.getElementById("feedbackText");
const feedbackModalEl = document.getElementById("feedbackModal");

//Skapa en Bootstrap-modal om Bootstrap är laddat
let feedbackModal = null;
if (window.bootstrap && feedbackModalEl) {
  //focus:false → vi hanterar fokus manuellt
  feedbackModal = bootstrap.Modal.getOrCreateInstance(feedbackModalEl, {
    focus: false,
  });
}

//Fokus-hantering för accessibility
//Här sparas vilket element som hade fokus innan modalen öppnades
let lastFocusedBeforeFeedbackModal = null;

//När modalen visas: flytta fokus till en knapp i modalen
if (feedbackModalEl) {
  feedbackModalEl.addEventListener("shown.bs.modal", () => {
    const focusTarget =
      feedbackModalEl.querySelector(".btn-close") ||
      feedbackModalEl.querySelector('[data-bs-dismiss="modal"]');

    if (focusTarget instanceof HTMLElement) {
      focusTarget.focus();
    }
  });

  //När modalen stängs: flytta fokus tillbaka ut till formuläret
  feedbackModalEl.addEventListener("hide.bs.modal", () => {
    const active = document.activeElement;

    //Om fokus låg inne i modalen, ta bort det
    if (active instanceof HTMLElement && feedbackModalEl.contains(active)) {
      active.blur();
    }

    //Försök återställa fokus till tidigare element
    const el =
      (lastFocusedBeforeFeedbackModal &&
        document.contains(lastFocusedBeforeFeedbackModal) &&
        lastFocusedBeforeFeedbackModal) ||
      document.getElementById("name");

    if (el instanceof HTMLElement) {
      el.focus();
    }
  });
}

//När sidan laddas
window.addEventListener("load", () => {
  hookEvents(); //koppla alla event
  updateCalculatedFields(); //sätt startvärden
  fetchAndRender(); //hämta data från backend
});

//Koppla eventlyssnare
function hookEvents() {
  //När användaren väljer maträtt → uppdatera pris
  nameEl.addEventListener("change", updateCalculatedFields);

  //När antal ändras → uppdatera totalpris
  servingsEl.addEventListener("input", updateCalculatedFields);

  //Submit hanterar både CREATE och UPDATE
  recipeForm.addEventListener("submit", handleSubmit);

  //Manuell uppdatering av listan
  btnRefresh?.addEventListener("click", fetchAndRender);

  //Rensa formuläret helt
  btnResetForm?.addEventListener("click", () => {
    resetForm();
    showFeedback("Formuläret rensades.");
  });

  //Avbryt redigeringsläge
  btnCancelEdit?.addEventListener("click", () => {
    resetForm();
    showFeedback("Redigering avbröts.");
  });
}

//Visa feedback till användaren
function showFeedback(message, type = "info") {
  // Sätt text i modalen
  if (feedbackText) {
    feedbackText.textContent = message || "Klart!";
  }

  //Om modal finns → använd den
  if (feedbackModal) {
    // Spara fokus innan modalen öppnas
    const active = document.activeElement;
    lastFocusedBeforeFeedbackModal =
      active instanceof HTMLElement ? active : lastFocusedBeforeFeedbackModal;

    //Visa modalen
    feedbackModal.show();
    return;
  }

  //Fallback: visa alert direkt i sidan
  if (feedbackMount) {
    feedbackMount.innerHTML = `
      <div class="alert alert-${type === "error" ? "danger" : "primary"}">
        ${escapeHtml(message)}
      </div>
    `;
    setTimeout(() => (feedbackMount.innerHTML = ""), 2500);
  }
}

//Pris- och totalprislogik
//Hämta pris för vald maträtt
function getPriceForMenu(name) {
  return MENU_PRICES[name] ?? 0;
}

//Uppdatera pris och totalpris automatiskt
function updateCalculatedFields() {
  const price = getPriceForMenu(nameEl.value); //pris per styck
  const servings = Number(servingsEl.value || 0);
  const total = price * servings;

  priceEl.value = price || "";
  totalPriceEl.value = price && servings ? total : "";
}

// Prisnivå → används för färg i CSS
function getTierFromTotal(total) {
  if (!total || total <= 0) return "unknown"; //ingen data
  if (total > 1500) return "expensive"; //röd
  if (total <= 500) return "ok"; //blå
  return "cheap"; //grön
}

//Formulär-hantering
//Återställ formuläret till startläge
function resetForm() {
  recipeForm.reset();
  editingIdEl.value = "";
  priceEl.value = "";
  totalPriceEl.value = "";
  btnCancelEdit?.classList.add("d-none");
}

//Visa/dölj redigeringsläge
function setEditMode(on) {
  if (!btnCancelEdit) return;
  on
    ? btnCancelEdit.classList.remove("d-none")
    : btnCancelEdit.classList.add("d-none");
}

//READ: hämta alla resurser
async function fetchAndRender() {
  try {
    const r = await fetch(API_URL); //GET /recipes
    if (!r.ok) throw new Error();
    const items = await r.json();
    renderList(items); //rendera i DOM
  } catch {
    showFeedback("Kunde inte hämta data från servern.", "error");
  }
}

//Rendera listan dynamiskt
function renderList(items) {
  if (!Array.isArray(items)) items = [];

  if (items.length === 0) {
    listMount.innerHTML = `<p class="text-secondary">Inga maträtter ännu.</p>`;
    return;
  }

  let html = `<div class="row g-3 recipe-grid">`;

  items.forEach((r) => {
    const name = r.name;
    const price = Number(r.price);
    const servings = Number(r.servings);
    const total = price * servings;

    const tier = getTierFromTotal(total);

    html += `
      <div class="col">
        <div class="card recipe-card recipe-card-square recipe-card-clickable shadow-strong"
             data-price-tier="${tier}"
             onclick="setCurrentRecipe(${r.id})">
          <div class="card-body d-flex flex-column">
            <div class="d-flex gap-2 align-items-start">
              <div class="recipe-left">
                <div class="recipe-title">${escapeHtml(name)}</div>
                <div class="recipe-meta text-secondary">
                  Pris ${price} kr • Antal ${servings} • Total ${total} kr
                </div>
                <div class="recipe-hint text-secondary mt-2">
                  Klicka på kortet för att redigera.
                </div>
              </div>

              <div class="recipe-actions">
                <div class="btn-group btn-group-sm" role="group">
                  <button type="button"
                          class="btn btn-outline-secondary"
                          onclick="event.stopPropagation(); setCurrentRecipe(${
                            r.id
                          })">
                    Ändra
                  </button>
                  <button type="button"
                          class="btn btn-outline-danger"
                          onclick="event.stopPropagation(); deleteRecipe(${
                            r.id
                          })">
                    Ta bort
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  });

  html += `</div>`;
  listMount.innerHTML = html;
}

//EAD ONE: fyll formuläret för redigering
async function setCurrentRecipe(id) {
  try {
    const r = await fetch(`${API_URL}/${id}`);
    if (!r.ok) throw new Error();
    const item = await r.json();

    editingIdEl.value = item.id;
    nameEl.value = item.name;
    priceEl.value = getPriceForMenu(item.name) || item.price;
    servingsEl.value = item.servings;

    updateCalculatedFields();
    setEditMode(true);
    showFeedback("Formuläret fylldes för redigering.");
  } catch {
    showFeedback("Kunde inte hämta vald maträtt.", "error");
  }
}

//DELETE: ta bort resurs
async function deleteRecipe(id) {
  try {
    const r = await fetch(`${API_URL}/${id}`, { method: "DELETE" });
    if (!r.ok) throw new Error();

    showFeedback("Maträtten togs bort.");
    if (String(editingIdEl.value) === String(id)) resetForm();
    fetchAndRender();
  } catch {
    showFeedback("Kunde inte ta bort maträtten.", "error");
  }
}

//CREATE / UPDATE: spara formulär
async function handleSubmit(e) {
  e.preventDefault();

  const name = nameEl.value;
  const price = getPriceForMenu(name);
  const servings = Number(servingsEl.value);

  //Enkel validering
  if (!name || !servings || !price) {
    showFeedback("Kontrollera formuläret.", "error");
    return;
  }

  const id = editingIdEl.value ? Number(editingIdEl.value) : null;

  const payload = { name, price, servings };
  if (id) payload.id = id;

  const method = id ? "PUT" : "POST";

  try {
    const r = await fetch(API_URL, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!r.ok) throw new Error();

    showFeedback(id ? "Maträtten uppdaterades." : "Maträtten skapades.");
    resetForm();
    fetchAndRender();
  } catch {
    showFeedback("Kunde inte spara.", "error");
  }
}

//Hjälpfunktion: skydda mot XSS
function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

//Gör funktionerna globala(används i onclick i renderad HTML)
window.setCurrentRecipe = setCurrentRecipe;
window.deleteRecipe = deleteRecipe;

/*
Hjälpmedel vi använde:
Vi tog hjälp av kursmaterialet, MDN Web Docs, Stack Overflow, och ibland AI för att förklara felmeddelanden och debugging. Trots felmeddelanden och hinder så känner vi att vi har lärt oss och förstår koden.
*/
