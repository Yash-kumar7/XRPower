# XRPower Backend

This is the backend service for the XRPower Prediction Market, built with Node.js, Express, and the XRP Ledger (XRPL).

## 🏗️ Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Blockchain**: XRPL (XRP Ledger)
- **Authentication**: JWT (JSON Web Tokens)
- **API Documentation**: Swagger/OpenAPI
- **Testing**: Jest, Supertest

## 🚀 Getting Started

### Prerequisites

- Node.js v18 or later
- npm or yarn
- XRP Ledger account (TestNet or MainNet)
- XUMM API credentials (for wallet integration)

### Installation

1. Install dependencies:
   ```bash
   npm install
   # or
   yarn
   ```

2. Create a `.env` file in the root directory with the following variables:
   ```env
   PORT=5000
   NODE_ENV=development
   XRPL_TESTNET_URL=wss://s.altnet.rippletest.net:51233
   JWT_SECRET=your_jwt_secret
   ```

3. Start the development server:
   ```bash
   npm run dev
   # or
   yarn dev
   ```

The server will be available at `http://localhost:5000`
