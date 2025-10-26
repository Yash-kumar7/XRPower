# XRPower Frontend

This is the frontend application for the XRPower Prediction Market, built with React, TypeScript, and Vite.

## 🏗️ Tech Stack

- **Framework**: React 18
- **Language**: TypeScript
- **Build Tool**: Vite
- **UI Library**: Material-UI (MUI)
- **State Management**: React Context API
- **Blockchain**: XRPL.js
- **Styling**: CSS Modules, MUI Styled Components
- **Testing**: Jest, React Testing Library

## 🚀 Getting Started

### Prerequisites

- Node.js v16 or later
- npm or yarn
- Backend server (see [Backend README](../backend/README.md))

### Installation

1. Install dependencies:
   ```bash
   npm install
   # or
   yarn
   ```

2. Create a `.env` file in the root directory with the following variables:
   ```env
   VITE_API_URL=http://localhost:3001
   VITE_XRPL_TESTNET_URL=wss://s.altnet.rippletest.net:51233
   ```

3. Start the development server:
   ```bash
   npm run dev
   # or
   yarn dev
   ```

4. Open [http://localhost:5173](http://localhost:5173) to view it in your browser.