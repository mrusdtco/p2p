// -------------------------------------------------------------------
// ARCHIVO: server.js (BACKEND)
// PROPÓSITO: Este es tu servidor seguro que obtiene los precios.
// DESTINO: Debe ser desplegado en VERCEL.
// CORRECCIÓN: Se añade User-Agent para Bybit y logging mejorado para OKX.
// -------------------------------------------------------------------

const express = require('express');
const axios = require('axios');
const cors = require('cors');
const crypto = require('crypto');

const app = express();

// --- Configuración de CORS ---
const allowedOrigins = ['https://www.mrusdt.co', 'http://localhost:3000'];
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
};
app.use(cors(corsOptions));

// --- CONFIGURACIÓN DE CLAVES API DESDE VARIABLES DE ENTORNO ---
const apiKeys = {
    bybit: { key: process.env.BYBIT_API_KEY, secret: process.env.BYBIT_API_SECRET },
    binance: { key: process.env.BINANCE_API_KEY, secret: process.env.BINANCE_API_SECRET },
    bitget: { key: process.env.BITGET_API_KEY, secret: process.env.BITGET_API_SECRET, passphrase: process.env.BITGET_API_PASSPHRASE },
    okx: { key: process.env.OKX_API_KEY, secret: process.env.OKX_API_SECRET, passphrase: process.env.OKX_API_PASSPHRASE },
    kucoin: { key: process.env.KUCOIN_API_KEY, secret: process.env.KUCOIN_API_SECRET, passphrase: process.env.KUCOIN_API_PASSPHRASE }
};

// --- HELPERS DE FIRMA ---
const getOkxSignature = (timestamp, method, requestPath, body = '') => {
    const message = `${timestamp}${method.toUpperCase()}${requestPath}${body}`;
    // Logging para depuración
    console.log(`OKX Signature String: [${message}]`);
    return crypto.createHmac('sha256', apiKeys.okx.secret).update(message).digest('base64');
};

// --- FUNCIONES PARA OBTENER PRECIOS ---

async function getBinancePrices() {
    try {
        console.log("Attempting to fetch Binance prices...");
        const url = 'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search';
        const config = { headers: { "Content-Type": "application/json" } };

        const buyPayload = { page: 1, rows: 5, payTypes: [], countries: ["CO"], tradeType: "BUY", asset: "USDT", fiat: "COP", publisherType: null };
        const buyResponse = await axios.post(url, buyPayload, config);
        const priceToSell = parseFloat(buyResponse.data.data[0].adv.price); 

        const sellPayload = { page: 1, rows: 5, payTypes: [], countries: ["CO"], tradeType: "SELL", asset: "USDT", fiat: "COP", publisherType: null };
        const sellResponse = await axios.post(url, sellPayload, config);
        const priceToBuy = parseFloat(sellResponse.data.data[0].adv.price);
        
        console.log("Successfully fetched Binance prices.");
        return { priceToSell, priceToBuy };
    } catch (error) {
        console.error('ERROR fetching Binance prices:', error.message);
        return null;
    }
}

async function getBybitPrices() {
     try {
        console.log("Attempting to fetch Bybit prices...");
        const url = 'https://api2.bybit.com/fiat/otc/ads/list';
        const headers = {
            // Se añade un User-Agent para simular un navegador y evitar bloqueos 403
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        };

        const buyParams = { tokenId: 'USDT', currencyId: 'COP', payment: [], side: '1', size: '5', page: '1' };
        const buyResponse = await axios.get(url, { params: buyParams, headers: headers });
        const priceToSell = parseFloat(buyResponse.data.result.items[0].price);

        const sellParams = { tokenId: 'USDT', currencyId: 'COP', payment: [], side: '0', size: '5', page: '1' };
        const sellResponse = await axios.get(url, { params: sellParams, headers: headers });
        const priceToBuy = parseFloat(sellResponse.data.result.items[0].price);

        console.log("Successfully fetched Bybit prices.");
        return { priceToSell, priceToBuy };
    } catch (error) {
        console.error('ERROR fetching Bybit prices:', error.message);
        return null;
    }
}

async function getOkxPrices() {
    try {
        console.log("Attempting to fetch OKX prices...");
        if (!apiKeys.okx.key || !apiKeys.okx.secret || !apiKeys.okx.passphrase) {
            throw new Error("OKX API credentials not configured in environment variables.");
        }
        const baseUrl = 'https://www.okx.com';
        const requestPath = '/api/v5/p2p/public/orders-list';
        const method = 'GET';
        
        const fetchSide = async (side) => {
            const timestamp = new Date().toISOString();
            const signature = getOkxSignature(timestamp, method, requestPath);
            const headers = {
                'OK-ACCESS-KEY': apiKeys.okx.key,
                'OK-ACCESS-SIGN': signature,
                'OK-ACCESS-TIMESTAMP': timestamp,
                'OK-ACCESS-PASSPHRASE': apiKeys.okx.passphrase,
                'Content-Type': 'application/json'
            };
            const params = { ccy: 'USDT-COP', side: side, paymentMethod: 'all', userType: 'all', limit: 5 };
            const response = await axios.get(`${baseUrl}${requestPath}`, { headers, params });
            const items = response.data.data.list;
            if (!items || items.length === 0) throw new Error(`No orders found for side: ${side}`);
            return parseFloat(items[items.length - 1].price);
        };

        const priceToSell = await fetchSide('buy');
        const priceToBuy = await fetchSide('sell');
        
        console.log("Successfully fetched OKX prices.");
        return { priceToSell, priceToBuy };
    } catch (error) {
        console.error('ERROR fetching OKX prices:', error.response ? JSON.stringify(error.response.data) : error.message);
        return null;
    }
}

// RUTA DE LA API
app.get('/api/prices', async (req, res) => {
    console.log("--- Request received at /api/prices ---");
    try {
        const [binance, bybit, okx] = await Promise.all([
            getBinancePrices(),
            getBybitPrices(),
            getOkxPrices()
        ]);

        const responseData = {
            binancep2p: binance,
            bybitp2p: bybit,
            okx: okx,
            kucoin: null,
            bitget: null
        };
        
        console.log("--- Successfully fetched all data, sending response. ---");
        res.status(200).json(responseData);

    } catch (error) {
        console.error("--- FATAL ERROR in /api/prices route: ---", error.message);
        res.status(500).json({ error: 'Failed to fetch prices from exchanges' });
    }
});

// Vercel exporta la app, no necesita `app.listen`
module.exports = app;

