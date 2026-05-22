# 🌍 Travel Globe

Applicazione web per generare itinerari di viaggio tramite AI e visualizzarli su un globo 3D interattivo.

---

## 📁 Struttura progetto

```
travel-globe/
├── frontend/
│   ├── index.html
│   ├── css/
│   │   └── style.css
│   └── js/
│       └── app.js
│
├── backend/
│   ├── server.js
│   ├── .env
│   ├── package.json
│   └── node_modules/
│
├── .gitignore
└── README.md
```

---

## ⚙️ Requisiti

* Node.js installato
* Connessione internet
* API key OpenAI

---

## 🔐 Configurazione backend

Dentro `backend/` crea il file `.env`:

```
OPENAI_API_KEY=la_tua_chiave
PORT=4000
```

---

## ▶️ Avvio del progetto

### 1. Avvia il backend

```bash
cd backend
npm install
node server.js
```

Backend attivo su:

```
http://0.0.0.0:4000
```

---

### 2. Avvia il frontend

```bash
cd frontend
npx serve . -l 3000
```

Frontend disponibile su:

```
http://localhost:3000
```

⚠️ Non aprire `index.html` con doppio click (file://)

---

## 🌐 Accesso da altri dispositivi

Trova il tuo IP locale:

```bash
ipconfig
```

Esempio:

```
192.168.1.34
```

Apri da telefono / tablet / altro PC:

```
http://192.168.1.34:3000
```

---

## 🧠 Come funziona

1. L’utente scrive nella chat
2. Il frontend invia richiesta al backend
3. Il backend usa OpenAI per generare l’itinerario
4. Il frontend:

   * aggiorna la chat
   * mostra i marker sul globo
   * costruisce il piano giornaliero
   * attiva il player del viaggio

---

## 🧪 Test rapido

Scrivi:

```
Fammi un viaggio di 3 giorni in Italia
```

Verifica:

* globo visibile
* risposta in chat
* marker presenti
* dettagli apribili

---

## 📌 Stato attuale

✔ Globo 3D funzionante
✔ Chat collegata al backend
✔ Itinerari generati dinamicamente
✔ Visualizzazione su mappa
✔ Supporto multi-dispositivo in rete locale

---

## 🚀 Prossimi sviluppi

* miglioramento UI/UX
* autenticazione utenti
* salvataggio viaggi
* deploy online
* integrazione prezzi reali (hotel/voli)

---
