# SheboyHaat Frontend

Frontend prototype for the Software Development-I project "SheboyHaat – A Trust-Based Booking Platform for Local Home-Service Workers".

## Run in VS Code

Open the terminal in this `frontend` folder and run:

```bash
npm install
npm run dev
```

Then open the local URL printed by Vite (normally `http://localhost:5173`).

For a production build:

```bash
npm run build
```

## Demo pages

- `/` Home
- `/services` Services
- `/workers` Find workers
- `/worker/1` Worker profile
- `/book/1` Booking form
- `/bookings` Customer bookings
- `/login` Login demo
- `/register` Customer/Worker registration demo
- `/worker-dashboard` Worker dashboard
- `/admin` Admin panel

The current frontend uses localStorage and sample data so it can be demonstrated before the backend/database are connected. Later, the sample data will be replaced with REST API calls to the Node/Express backend.
