const { Client } = require('xrpl');

// XRPL Testnet connection
const xrpl = new Client('wss://s.altnet.rippletest.net:51233');

// Store active listeners
const addressListeners = new Map();

// Connect to XRPL
async function connectToXRPL() {
  try {
    await xrpl.connect();
    console.log('Connected to XRPL Testnet');
    return true;
  } catch (error) {
    console.error('Error connecting to XRPL:', error);
    return false;
  }
}

// Monitor address for incoming payments
async function monitorAddress(address, callback) {
  try {
    // Check if we're already monitoring this address
    if (addressListeners.has(address)) {
      console.log(`Already monitoring address: ${address}`);
      return;
    }

    console.log(`Setting up listener for address: ${address}`);
    
    // Set up the subscription
    const subscription = await xrpl.request({
      command: 'subscribe',
      accounts: [address]
    });

    // Store the subscription
    addressListeners.set(address, subscription);

    // Listen for transactions
    xrpl.on('transaction', (tx) => {
      if (tx.transaction && 
          tx.transaction.Destination === address && 
          tx.transaction.TransactionType === 'Payment') {
        console.log('Incoming transaction:', tx);
        callback({
          from: tx.transaction.Account,
          to: tx.transaction.Destination,
          amount: tx.transaction.Amount,
          hash: tx.transaction.hash,
          timestamp: new Date().toISOString()
        });
      }
    });

  } catch (error) {
    console.error(`Error monitoring address ${address}:`, error);
  }
}

// Stop monitoring an address
function stopMonitoring(address) {
  if (addressListeners.has(address)) {
    const subscription = addressListeners.get(address);
    xrpl.request({
      command: 'unsubscribe',
      accounts: [address]
    });
    addressListeners.delete(address);
    console.log(`Stopped monitoring address: ${address}`);
  }
}

// Get account info
async function getAccountInfo(address) {
  try {
    const accountInfo = await xrpl.request({
      command: 'account_info',
      account: address,
      ledger_index: 'validated'
    });
    return accountInfo;
  } catch (error) {
    console.error(`Error getting account info for ${address}:`, error);
    return null;
  }
}

// Send XRP to an address
async function sendXRP(fromSecret, toAddress, amount) {
  const wallet = xrpl.Wallet.fromSeed(fromSecret);
  
  try {
    const prepared = await xrpl.autofill({
      TransactionType: 'Payment',
      Account: wallet.address,
      Amount: xrpl.xrpToDrops(amount),
      Destination: toAddress
    });
    
    const signed = wallet.sign(prepared);
    const result = await xrpl.submitAndWait(signed.tx_blob);
    
    return {
      success: true,
      txHash: result.id,
      result: result.meta.TransactionResult
    };
  } catch (error) {
    console.error('Error sending XRP:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  xrpl,
  connectToXRPL,
  monitorAddress,
  stopMonitoring,
  getAccountInfo,
  sendXRP
};
