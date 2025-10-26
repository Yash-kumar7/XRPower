# XRPower Prediction Market

A decentralized prediction market platform built on the XRP Ledger (XRPL) that allows users to create, participate in, and resolve prediction markets using XRP and other XRPL tokens.

## 🌟 Features

- Create prediction markets with custom questions and outcomes
- Participate in markets by placing bets with XRP
- Decentralized resolution using on-chain oracles
- Real-time market updates and price feeds
- Secure wallet integration with XUMM
- Responsive web interface for desktop and mobile

## 🚀 Quick Start

### Prerequisites

- Node.js (v16 or later)
- npm or yarn
- XRP Ledger account (TestNet or MainNet)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Yash-Kumar7/xrp-prediction-market.git
   cd xrp-prediction-market
   ```

2. Install dependencies for both frontend and backend:
   ```bash
   # Install backend dependencies
   cd backend
   npm install
   
   # Install frontend dependencies
   cd ../frontend
   npm install
   ```

3. Configure environment variables (see `.env.example` in each directory)

4. Start the development servers:
   ```bash
   # In one terminal (backend)
   cd backend
   npm run dev
   
   # In another terminal (frontend)
   cd frontend
   npm start
   ```

## 📁 Project Structure

```
XRPower/
├── backend/          # Backend server (Node.js/Express)
├── frontend/         # Frontend React application
├── .gitignore        # Git ignore file
└── README.md         # This file
```

## 🔧 Technologies Used

- **Frontend**: React, Material-UI, XRPL.js
- **Backend**: Node.js, Express, XRPL
- **Blockchain**: XRP Ledger (XRPL)