// Importerar Express (webbserver-ramverk för Node.js)
const express = require("express");

// Importerar SQLite3 och aktiverar verbose-läge (ger tydligare fel)
const sqlite3 = require("sqlite3").verbose();

// Skapar Express-servern
const server = express();

// Öppnar (eller skapar) SQLite-databasen
const db = new sqlite3.Database("./gik339.db");

// Middleware
server
  // Gör så att servern kan läsa JSON från request body
  .use(express.json())

  // Gör så att servern kan läsa form-data (URL-encoded)
  .use(express.urlencoded({ extended: false }))

  // CORS: tillåter anrop från frontend (andra portar/domäner)
  .use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*"); // tillåt alla origins
    res.header("Access-Control-Allow-Headers", "*"); // tillåt alla headers
    res.header("Access-Control-Allow-Methods", "*"); // tillåt alla metoder
    next(); // fortsätt till nästa middleware/route
  });

// Skapa databastabell (om den inte finns)
db.run(`
  CREATE TABLE IF NOT EXISTS recipes (
    id INTEGER PRIMARY KEY AUTOINCREMENT, -- unikt id, skapas automatiskt
    name TEXT NOT NULL,                   -- namn på maträtten
    price INTEGER NOT NULL,               -- pris per styck
    servings INTEGER NOT NULL             -- antal rätter
  )
`);

// READ: Hämta alla maträtter
// GET /recipes
server.get("/recipes", (req, res) => {
  // Hämtar alla rader från tabellen, sorterat på senaste först
  db.all("SELECT * FROM recipes ORDER BY id DESC", (err, rows) => {
    if (err) {
      // Vid databasfel: skicka status 500 + felmeddelande
      return res.status(500).json({
        message: "DB error",
        error: String(err),
      });
    }

    // Skicka alla rader som JSON till frontend
    res.json(rows);
  });
});

// READ ONE: Hämta en specifik maträtt
// GET /recipes/:id
server.get("/recipes/:id", (req, res) => {
  // Hämta id från URL-parametern
  const id = Number(req.params.id);

  // Hämta exakt en rad baserat på id
  db.get("SELECT * FROM recipes WHERE id = ?", [id], (err, row) => {
    if (err) {
      return res.status(500).json({
        message: "DB error",
        error: String(err),
      });
    }

    // Skicka objektet (eller null om inget hittades)
    res.json(row || null);
  });
});

// CREATE: Skapa ny maträtt
// POST /recipes
server.post("/recipes", (req, res) => {
  // Läs data som skickats från frontend
  const { name, price, servings } = req.body;

  // Lägg in ny rad i databasen
  db.run(
    "INSERT INTO recipes (name, price, servings) VALUES (?, ?, ?)",
    [name, Number(price), Number(servings)],
    (err) => {
      if (err) {
        return res.status(500).json({
          message: "DB error",
          error: String(err),
        });
      }

      // Skicka bekräftelse tillbaka till frontend
      res.json({ message: "Maträtten skapades" });
    }
  );
});

// UPDATE: Uppdatera befintlig maträtt
// PUT /recipes
server.put("/recipes", (req, res) => {
  // Läs data från request body
  const { id, name, price, servings } = req.body;

  // Uppdatera rätt rad baserat på id
  db.run(
    "UPDATE recipes SET name = ?, price = ?, servings = ? WHERE id = ?",
    [name, Number(price), Number(servings), Number(id)],
    (err) => {
      if (err) {
        return res.status(500).json({
          message: "DB error",
          error: String(err),
        });
      }

      // Skicka bekräftelse till frontend
      res.json({ message: "Maträtten uppdaterades" });
    }
  );
});

// DELETE: Ta bort maträtt
// DELETE /recipes/:id
server.delete("/recipes/:id", (req, res) => {
  // Hämta id från URL-parametern
  const id = Number(req.params.id);

  // Ta bort raden med matchande id
  db.run("DELETE FROM recipes WHERE id = ?", [id], (err) => {
    if (err) {
      return res.status(500).json({
        message: "DB error",
        error: String(err),
      });
    }

    // Skicka bekräftelse
    res.json({ message: "Maträtten borttagen" });
  });
});

// Starta servern
server.listen(3000, () => {
  console.log("Server kör på http://localhost:3000");
});
