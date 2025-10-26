require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Client } = require('xrpl');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for all routes
app.use((req, res, next) => {
  // Allow from any origin in development
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Pragma');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).json({
      status: 'ok'
    });
  }
  
  next();
});

// Parse JSON bodies
app.use(bodyParser.json());

// Root route for testing
app.get('/', (req, res) => {
  res.json({ status: 'Server is running', message: 'XRP Prediction Market API' });
});

// Get prediction data
app.get('/api/prediction', (req, res) => {
  try {
    if (!prediction) {
      return res.status(404).json({ error: 'Prediction not found' });
    }

    // Calculate totals
    const totalVotes = prediction.options.reduce((sum, opt) => sum + opt.votes, 0);
    const totalAmount = prediction.options.reduce((sum, opt) => sum + opt.amount, 0);

    // Update the prediction object with current totals
    prediction.totalVotes = totalVotes;
    prediction.totalAmount = totalAmount;
    
    // Format the response
    const response = {
      ...prediction,
      totalVotes,
      totalAmount,
      options: prediction.options.map(option => ({
        ...option,
        // Ensure all required fields are present
        id: option.id,
        text: option.text,
        votes: option.votes || 0,
        amount: option.amount || 0,
        address: option.address || '',
        voters: Array.isArray(option.voters) ? option.voters.map(voter => ({
          address: voter.address || '',
          amount: typeof voter.amount === 'number' ? voter.amount : 0,
          transactions: Array.isArray(voter.transactions) 
            ? voter.transactions.map(tx => ({
                hash: tx.hash || '',
                amount: typeof tx.amount === 'number' ? tx.amount : 0,
                timestamp: tx.timestamp || new Date().toISOString()
              }))
            : []
        })) : [],
        totalReceived: option.totalReceived || 0
      }))
    };
    
    res.status(200).json(response);
  } catch (error) {
    console.error('Error getting prediction:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get prediction data',
      details: error.message 
    });
  }
});

// Process vote with XRPL transaction
app.post('/api/process-vote', async (req, res) => {
  const { Client, Wallet, xrpToDrops } = require('xrpl');
  const xrpl = new Client('wss://s.altnet.rippletest.net:51233');
  
  try {
    const { optionId, amount, senderAddress, walletSecret, destinationAddress, destinationTag } = req.body;
    
    // Validate input
    if (optionId !== 'yes' && optionId !== 'no') {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid option. Must be "yes" or "no"' 
      });
    }

    const xrpAmount = parseFloat(amount);
    if (isNaN(xrpAmount) || xrpAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid amount. Must be a positive number'
      });
    }

    if (!senderAddress || !walletSecret) {
      return res.status(400).json({
        success: false,
        error: 'Sender address and wallet secret are required'
      });
    }

    try {
      // Connect to XRPL
      await xrpl.connect();
      
      // Get wallet from secret
      const wallet = Wallet.fromSeed(walletSecret);
      
      // Prepare payment
      const prepared = await xrpl.autofill({
        TransactionType: 'Payment',
        Account: wallet.address,
        Amount: xrpToDrops(xrpAmount),
        Destination: destinationAddress,
        DestinationTag: destinationTag,
      });

      // Sign the transaction
      const signed = wallet.sign(prepared);
      console.log('Transaction signed, submitting...');
      
      // Submit with retry logic
      const maxRetries = 3;
      let retryCount = 0;
      let lastError;
      
      let txResult = null;
      while (retryCount < maxRetries) {
        try {
          // Increase timeout to 45 seconds and enable fail_soft
          const result = await xrpl.submitAndWait(signed.tx_blob, {
            timeout: 45000, // 45 seconds
            fail_hard: false, // Use fail_soft to allow retries
            waitForFinality: true
          });
          
          console.log('Transaction result:', result.result.meta.TransactionResult);
          
          if (result.result.meta.TransactionResult === 'tesSUCCESS') {
            console.log(`✅ Transaction successful! Hash: ${result.result.hash}`);
            txResult = result; // Store the successful result
            break; // Success, exit retry loop
          }
          
          // If we got here, the transaction failed but didn't throw an error
          lastError = new Error(`Transaction failed with code: ${result.result.meta.TransactionResult}`);
        } catch (error) {
          console.warn(`Attempt ${retryCount + 1} failed:`, error.message);
          lastError = error;
        }
        
        // Wait before retrying (exponential backoff)
        const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
        console.log(`Retrying in ${delay/1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        retryCount++;
      }
      
      // If we get here, all retries failed
      if (lastError || !txResult) {
        throw lastError || new Error('Transaction failed after all retries');
      }
      
      // Record the vote in our database
      const option = prediction.options.find(opt => opt.id === optionId);
      if (!option) {
        throw new Error(`Invalid option: ${optionId}`);
      }
      
      // Ensure voters array exists
      if (!Array.isArray(option.voters)) {
        option.voters = [];
      }
      
      // Update vote count and amount
      option.votes += 1;
      option.amount += xrpAmount;
      option.totalReceived += xrpAmount;
      
      const existingVoteIndex = option.voters.findIndex(v => v.address === senderAddress);
      const transactionHash = txResult.result.hash;
      
      if (existingVoteIndex >= 0) {
        // Update existing vote
        option.voters[existingVoteIndex].amount = (option.voters[existingVoteIndex].amount || 0) + xrpAmount;
        if (!Array.isArray(option.voters[existingVoteIndex].transactions)) {
          option.voters[existingVoteIndex].transactions = [];
        }
        option.voters[existingVoteIndex].transactions.push({
          hash: transactionHash,
          amount: xrpAmount,
          timestamp: new Date().toISOString()
        });
      } else {
        // Add new vote
        option.voters.push({
          address: senderAddress,
          amount: xrpAmount,
          transactions: [{
            hash: transactionHash,
            amount: xrpAmount,
            timestamp: new Date().toISOString()
          }]
        });
      }
      
      // Update totals
      option.totalReceived += xrpAmount;
      prediction.updatedAt = new Date().toISOString();

      res.json({ 
        success: true, 
        message: 'Vote processed successfully',
        transactionHash: txResult.result.hash,
        vote: {
          option: optionId,
          amount: xrpAmount,
          senderAddress,
          totalVotes: option.voters.length,
          totalAmount: option.totalReceived
        }
      });
      
    } finally {
      // Always disconnect from XRPL
      await xrpl.disconnect();
    }
    
  } catch (error) {
    console.error('Error processing vote:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to process vote',
      details: error.message
    });
  }
});

// Handle vote submission (legacy endpoint, kept for backward compatibility)
app.post('/api/vote', async (req, res) => {
  try {
    const { optionId, amount, senderAddress, transactionHash } = req.body;
    
    // Validate input
    if (optionId !== 'yes' && optionId !== 'no') {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid option. Must be "yes" or "no"' 
      });
    }

    const xrpAmount = parseFloat(amount);
    if (isNaN(xrpAmount) || xrpAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid amount. Must be a positive number'
      });
    }

    if (!senderAddress) {
      return res.status(400).json({
        success: false,
        error: 'Sender address is required'
      });
    }

    if (!transactionHash) {
      return res.status(400).json({
        success: false,
        error: 'Transaction hash is required for verification'
      });
    }

    // In a real implementation, verify the transaction here
    // For now, we'll just log it
    console.log(`Vote received: ${senderAddress} voted ${optionId} with ${xrpAmount} XRP (TX: ${transactionHash})`);

    // Update vote in the prediction object
    const option = prediction.options.find(opt => opt.id === optionId);
    if (!option) {
      throw new Error(`Option not found: ${optionId}`);
    }
    
    // Check if this is a new voter
    const existingVoteIndex = option.voters.findIndex(v => v.address === senderAddress);
    
    if (existingVoteIndex >= 0) {
      // Update existing vote
      option.voters[existingVoteIndex].amount += xrpAmount;
      option.voters[existingVoteIndex].transactions.push({
        hash: transactionHash,
        amount: xrpAmount,
        timestamp: new Date().toISOString()
      });
    } else {
      // Add new vote
      option.voters.push({
        address: senderAddress,
        amount: xrpAmount,
        transactions: [{
          hash: transactionHash,
          amount: xrpAmount,
          timestamp: new Date().toISOString()
        }]
      });
    }
    
    // Update totals
    option.totalReceived += xrpAmount;
    prediction.updatedAt = new Date().toISOString();

    res.json({ 
      success: true, 
      message: 'Vote and payment recorded',
      vote: {
        option: optionId,
        amount: xrpAmount,
        senderAddress,
        transactionHash,
        totalVotes: option.voters.length,
        totalAmount: option.totalReceived
      }
    });
  } catch (error) {
    console.error('Error processing vote:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to process vote',
      details: error.message
    });
  }
});

// Initialize prediction from environment variables
const PREDICTION_END_TIME = new Date(
  Date.now() + (process.env.PREDICTION_DURATION_HOURS * 60 * 60 * 1000)
).toISOString();

// In-memory storage (for demo purposes)
let prediction = {
  question: process.env.PREDICTION_QUESTION || 'Will XRP cross $3k by tonight?',
  status: 'active',
  resolved: false,
  winningOption: null,
  resolution: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  endTime: PREDICTION_END_TIME,
  options: [
    {
      id: 'yes',
      text: 'Yes',
      votes: 0,
      amount: 0,
      address: process.env.YES_WALLET_ADDRESS || 'rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe',
      voters: [],
      totalReceived: 0
    },
    {
      id: 'no',
      text: 'No',
      votes: 0,
      amount: 0,
      address: process.env.NO_WALLET_ADDRESS || 'r3kmLJN5D28dHuH8vZNUZpMC43pEHpaocV',
      voters: [],
      totalReceived: 0
    }
  ],
  totalVotes: 0,
  totalAmount: 0
};

// ... rest of the code remains the same ...
// Validate required environment variables
const requiredEnvVars = [
  'YES_WALLET_ADDRESS',
  'NO_WALLET_ADDRESS',
  'ADMIN_SECRET'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ Error: Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

// Helper function to find option by id
const getOption = (id) => prediction.options.find(opt => opt.id === id);

console.log('✅ Configuration loaded:');
console.log(`- Prediction: ${prediction.question}`);
console.log(`- End Time: ${new Date(prediction.endTime).toLocaleString()}`);
console.log(`- Yes Address: ${getOption('yes').address}`);
console.log(`- No Address: ${getOption('no').address}`);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get prediction data
app.get('/api/prediction', (req, res) => {
  try {
    res.status(200).json(prediction);
  } catch (error) {
    console.error('Error getting prediction:', error);
    res.status(500).json({ error: 'Failed to get prediction data' });
  }
});

// Admin route to resolve prediction and distribute rewards
app.post('/api/resolve', async (req, res) => {
  try {
    const { outcome } = req.body;
    const authHeader = req.headers.authorization;
    
    // Simple auth check (in production, use proper authentication)
    if (!authHeader || authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    if (prediction.resolved) {
      return res.status(400).json({ 
        success: false,
        error: 'Prediction already resolved' 
      });
    }
    
    if (outcome !== 'yes' && outcome !== 'no') {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid outcome. Must be "yes" or "no"' 
      });
    }
    
    // Validate prediction structure
    if (!prediction || typeof prediction !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Invalid prediction data',
        prediction: prediction
      });
    }

    // Convert options to array format if it's an object
    if (prediction.options && typeof prediction.options === 'object' && !Array.isArray(prediction.options)) {
      console.log('Converting options from object to array format');
      const optionsArray = [];
      
      // Handle yes/no format
      if (prediction.options.yes && prediction.options.no) {
        optionsArray.push({
          text: 'yes',
          address: prediction.options.yes.address,
          votes: prediction.options.yes.votes,
          voters: prediction.options.yes.voters || [],
          totalReceived: prediction.options.yes.totalReceived || 0
        });
        
        optionsArray.push({
          text: 'no',
          address: prediction.options.no.address,
          votes: prediction.options.no.votes,
          voters: prediction.options.no.voters || [],
          totalReceived: prediction.options.no.totalReceived || 0
        });
      } else {
        // Handle other object formats if needed
        for (const [key, value] of Object.entries(prediction.options)) {
          if (value && typeof value === 'object') {
            optionsArray.push({
              text: key,
              ...value,
              voters: value.voters || []
            });
          }
        }
      }
      
      // Replace the options object with our array
      prediction.options = optionsArray;
    }

    // Final validation of options
    if (!Array.isArray(prediction.options)) {
      console.error('Invalid options format after conversion:', prediction.options);
      return res.status(400).json({
        success: false,
        error: 'Could not process prediction options',
        optionsType: typeof prediction.options,
        options: prediction.options
      });
    }

    // Find the winning option
    const winningOption = prediction.options.find(opt => 
      opt && typeof opt === 'object' && 
      opt.text && 
      opt.text.toLowerCase() === outcome.toLowerCase()
    );

    if (!winningOption) {
      console.error('Winning option not found:', {
        outcome,
        availableOptions: prediction.options.map(opt => ({
          text: opt.text,
          hasVoters: Array.isArray(opt.voters) && opt.voters.length > 0
        }))
      });
      
      return res.status(400).json({ 
        success: false, 
        error: `No option found matching outcome: ${outcome}`,
        availableOptions: prediction.options.map(opt => opt.text)
      });
    }

    // Update prediction status
    prediction.resolved = true;
    prediction.winningOption = winningOption.text;
    prediction.updatedAt = new Date().toISOString();
    
    console.log('Prediction resolved as:', prediction.winningOption);
    console.log('Processed prediction options:', JSON.stringify(prediction.options, null, 2));
    
    try {
        
        if (!Array.isArray(winningOption.voters) || winningOption.voters.length === 0) {
          return res.status(400).json({ 
            success: false, 
            error: 'No votes found for the winning option',
            outcome,
            hasVoters: Array.isArray(winningOption.voters) ? winningOption.voters.length : 'invalid'
          });
        }

        // Calculate total pool from all votes
        let totalPool = 0;
        prediction.options.forEach(option => {
          if (option.voters && option.voters.length > 0) {
            option.voters.forEach(voter => {
              const amount = typeof voter === 'object' ? voter.amount : 1; // Default to 1 if amount not specified
              totalPool += parseFloat(amount) || 0;
            });
          }
        });

        if (totalPool <= 0) {
          return res.status(400).json({
            success: false,
            error: 'No valid votes with positive amounts found',
            totalVotes: prediction.options.reduce((sum, opt) => sum + (opt.voters ? opt.voters.length : 0), 0),
            totalPool: 0
          });
        }

        // Initialize variables for reward distribution
        const results = {
          success: true,
          message: `Prediction resolved as ${outcome}. Winners rewarded.`,
          winningOption: outcome,
          totalPool: parseFloat(totalPool.toFixed(6)),
          winnerCount: winningOption.voters.length,
          rewards: [],
          timestamp: new Date().toISOString(),
          failedTransactions: []
        };
        
        console.log(`Total pool calculated: ${results.totalPool} XRP`);
        console.log(`Number of winners: ${results.winnerCount}`);   // Distribute rewards to each winner
      if (winningOption.voters.length > 0) {
        // Validate we have the admin wallet configured
        if (!process.env.ADMIN_WALLET_SECRET) {
          throw new Error('Admin wallet secret not configured. Cannot process payouts.');
        }
        
        // Initialize results object
        const results = {
          success: true,
          message: `Prediction resolved as ${outcome}. Winners rewarded.`,
          winningOption: outcome,
          totalPool: totalPool,
          winnerCount: winningOption.voters.length,
          rewards: [],
          timestamp: new Date().toISOString(),
          failedTransactions: []
        };

        console.log(`🚀 Starting XRP reward distribution to ${winningOption.voters.length} winners...`);
        
        // Initialize XRPL client and wallet
        const { Client, Wallet, xrpToDrops, dropsToXrp } = require('xrpl');
        const xrpl = new Client(process.env.XRPL_TESTNET_WS);
        
        // Declare variables in outer scope
        let totalPayout = 0;
        let rewardPerWinner = 0;
        let adminWallet;
        
        try {
          await xrpl.connect();
          
          // Initialize admin wallet
          adminWallet = Wallet.fromSeed(process.env.ADMIN_WALLET_SECRET);
          
          // Calculate the total amount to be distributed (90% of total pool, 10% platform fee)
          totalPayout = parseFloat((totalPool * 0.9).toFixed(6)); // Ensure we have exactly 6 decimal places
          
          // Ensure we have at least one winner
          const winnerCount = Math.max(1, winningOption.voters.length);
          rewardPerWinner = parseFloat((totalPayout / winnerCount).toFixed(6));
          
          // Validate reward amount
          if (rewardPerWinner <= 0.000001) { // Minimum XRP amount (1 drop)
            throw new Error(`Calculated reward per winner (${rewardPerWinner} XRP) is too small`);
          }
          
          console.log(`Calculated ${rewardPerWinner} XRP per winner for ${winnerCount} winners`);
          
          // Get admin wallet balance
          const accountInfo = await xrpl.request({
            command: 'account_info',
            account: adminWallet.address,
            ledger_index: 'validated'
          });
          
          const adminBalance = parseFloat(dropsToXrp(accountInfo.result.account_data.Balance));
          
          console.log(`Admin balance: ${adminBalance} XRP`);
          console.log(`Required balance: ${totalPayout} XRP`);
          
          if (adminBalance < totalPayout) {
            throw new Error(`Insufficient balance in admin wallet. Need ${totalPayout} XRP, but only have ${adminBalance} XRP`);
          }
          
          console.log(`💰 Total Payout: ${totalPayout} XRP (${rewardPerWinner} XRP per winner)`);
          
          // Process payouts to each winner
          for (const [index, voterObj] of winningOption.voters.entries()) {
            let voterAddress;
            try {
              voterAddress = typeof voterObj === 'object' ? voterObj.address : voterObj;
              console.log(`\n🔹 Processing winner ${index + 1}/${winningOption.voters.length}: ${voterAddress}`);
              
              // Validate amount before sending
              if (isNaN(rewardPerWinner) || rewardPerWinner <= 0) {
                throw new Error(`Invalid reward amount: ${rewardPerWinner}`);
              }
              
              // Convert XRP to drops (1 XRP = 1,000,000 drops) and ensure it's an integer
              const amountInDrops = Math.round(rewardPerWinner * 1000000);
              if (amountInDrops < 1) {
                throw new Error(`Reward amount too small (${rewardPerWinner} XRP)`);
              }
              
              console.log(`Sending ${rewardPerWinner} XRP to ${voterAddress}...`);
              
              // Get the account info to get the sequence number
              const accountInfo = await xrpl.request({
                command: 'account_info',
                account: adminWallet.address,
                ledger_index: 'validated'
              });
              
              // Prepare the payment transaction
              const payment = {
                TransactionType: 'Payment',
                Account: adminWallet.address,
                Destination: voterAddress,
                Amount: amountInDrops.toString(),
                Fee: '12', // Standard network fee in drops
                Sequence: accountInfo.result.account_data.Sequence,
                LastLedgerSequence: null,
                Flags: 2147483648 // tfFullyCanonicalSig
              };
              
              console.log('Prepared payment:', JSON.stringify(payment, null, 2));
              
              // Get the latest validated ledger index
              const ledgerResponse = await xrpl.request({
                command: 'ledger',
                ledger_index: 'validated',
                transactions: false
              });
              
              // Add LastLedgerSequence (current ledger + 4)
              payment.LastLedgerSequence = ledgerResponse.result.ledger_index + 4;
              
              // Sign the transaction
              const signed = adminWallet.sign(payment);
              
              console.log('Submitting transaction...');
              
              // Submit the transaction
              const submitResult = await xrpl.request({
                command: 'submit',
                tx_blob: signed.tx_blob,
                fail_hard: false // Allow soft failures for retries
              });
              
              const txHash = submitResult.result.tx_json.hash;
              console.log(`Transaction submitted, hash: ${txHash}`);
              
              // Wait for validation with timeout
              const validationResult = await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                  reject(new Error('Transaction validation timeout'));
                }, 60000); // 60 second timeout
                
                // Check transaction status with exponential backoff
                let attempts = 0;
                const maxAttempts = 10;
                let lastLedger = null;
                
                const checkTx = async () => {
                  try {
                    const txResult = await xrpl.request({
                      command: 'tx',
                      transaction: txHash,
                      binary: false
                    });
                    
                    if (txResult.result.validated) {
                      clearTimeout(timeout);
                      resolve(txResult);
                      return;
                    }
                    
                    // Track ledger progress
                    const currentLedger = txResult.result.ledger_index;
                    if (currentLedger !== lastLedger) {
                      console.log(`Waiting for validation in ledger ${currentLedger}...`);
                      lastLedger = currentLedger;
                    }
                    
                    attempts++;
                    if (attempts >= maxAttempts) {
                      clearTimeout(timeout);
                      reject(new Error('Max validation attempts reached'));
                      return;
                    }
                    
                    // Exponential backoff
                    const delay = Math.min(1000 * Math.pow(2, attempts), 10000);
                    setTimeout(checkTx, delay);
                    
                  } catch (e) {
                    clearTimeout(timeout);
                    reject(e);
                  }
                };
                
                checkTx().catch(e => {
                  clearTimeout(timeout);
                  reject(e);
                });
              });

              // Check transaction result
              if (validationResult.result.meta.TransactionResult === 'tesSUCCESS') {
                const ledgerIndex = validationResult.result.ledger_index;
                
                console.log(`✅ Successfully sent ${rewardPerWinner} XRP to ${voterAddress}`);
                console.log(`   TX Hash: ${txHash}`);
                console.log(`   Ledger Index: ${ledgerIndex}`);
                
                results.rewards.push({
                  to: voterAddress,
                  amount: rewardPerWinner,
                  txHash: txHash,
                  status: 'completed',
                  timestamp: new Date().toISOString()
                });
                
                // Update the winning option's total distributed
                winningOption.totalDistributed = (winningOption.totalDistributed || 0) + rewardPerWinner;
                
                // Add a small delay between transactions (2 seconds) to avoid rate limiting
                if (index < winningOption.voters.length - 1) {
                  await new Promise(resolve => setTimeout(resolve, 2000));
                }
              } else {
                throw new Error(`Transaction failed with code: ${validationResult.result.meta.TransactionResult}`);
              }
            } catch (txError) {
              console.error(`❌ Failed to process transaction for ${voterAddress}:`, txError.message);
              
              const rewardInfo = {
                to: voterAddress,
                amount: rewardPerWinner,
                error: txError.message,
                status: 'failed',
                timestamp: new Date().toISOString(),
                retry: true
              };
              
              results.rewards.push(rewardInfo);
              results.failedTransactions.push({
                voter: voterAddress,
                amount: rewardPerWinner,
                error: txError.message
              });
            }
          }
          
          // Calculate distribution results
          const successCount = results.rewards.filter(r => r.status === 'completed').length;
          const failedCount = results.rewards.length - successCount;
          
          // Update prediction with distribution results
          prediction.distribution = {
            totalPayout: totalPayout || 0,
            rewardPerWinner: rewardPerWinner || 0,
            completedAt: new Date().toISOString(),
            successCount: successCount,
            failedCount: failedCount
          };
          
          console.log(`\n🎉 Reward distribution completed!`);
          console.log(`   Total distributed: ${successCount * rewardPerWinner} XRP`);
          console.log(`   Successful payouts: ${successCount}`);
          console.log(`   Failed payouts: ${failedCount}`);
          
          // Finalize the prediction resolution
          prediction.updatedAt = new Date().toISOString();
          prediction.status = 'resolved';
          prediction.winningOption = outcome;
          prediction.resolution = results;
          
          // Format the response to match frontend expectations
          const response = {
            success: true, 
            message: `Prediction resolved as ${outcome}. ${results.winnerCount} winners rewarded.`,
            ...results,
            // Include the full updated prediction in the response
            prediction: {
              ...prediction,
              status: 'resolved',
              winningOption: outcome,
              resolution: results
            }
          };
          
          // Return success response
          res.status(200).json(response);
          
        } catch (error) {
          console.error('Error processing resolution:', error);
          res.status(500).json({
            success: false,
            error: 'Failed to process resolution',
            details: error.message
          });
        }
      } else {
        // No winners to process
        prediction.updatedAt = new Date().toISOString();
        prediction.status = 'resolved';
        prediction.winningOption = outcome;
        prediction.resolution = results;
        
        // Format the response to match frontend expectations
        const response = {
          success: true,
          message: `Prediction resolved as ${outcome}. No winners to reward.`,
          ...results,
          // Include the full updated prediction in the response
          prediction: {
            ...prediction,
            status: 'resolved',
            winningOption: outcome,
            resolution: results
          }
        };
        
        res.status(200).json(response);
      }
    } catch (error) {
      console.error('Error resolving prediction:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to resolve prediction',
        details: error.message
      });
    }
  } catch (error) {
    console.error('Error in resolve endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process resolution',
      details: error.message
    });
  }
});

// Import XRPL utilities
const xrplUtils = require('./xrpl-utils');

// Connect to XRPL and start monitoring
async function initializeXRPL() {
  try {
    const connected = await xrplUtils.connectToXRPL();
    if (connected && prediction) {
      console.log('Monitoring for votes on prediction:', prediction.question);
      
      // Monitor wallet addresses for incoming payments
      for (const option of prediction.options) {
        xrplUtils.monitorAddress(option.address, (tx) => {
          console.log(`Received ${option.id.toUpperCase()} vote:`, tx);
          
          // Update vote count
          option.votes++;
          
          // Add voter if not already present
          const existingVoter = option.voters.find(v => v.address === tx.from);
          if (!existingVoter) {
            option.voters.push({
              address: tx.from,
              amount: 0, // Will be updated by the transaction processing
              transactions: []
            });
          }
          
          // Log the transaction
          const voter = option.voters.find(v => v.address === tx.from);
          if (voter) {
            voter.transactions.push({
              hash: tx.hash,
              amount: tx.amount,
              timestamp: new Date().toISOString()
            });
          }
        });
      }
    }
  } catch (error) {
    console.error('Error initializing XRPL monitoring:', error);
  }
}

// Create HTTP server
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Initialize XRPL connection and monitoring
initializeXRPL().catch(console.error);

// Handle shutdown gracefully
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    process.exit(0);
  });
});

module.exports = { app, server };
