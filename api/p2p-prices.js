// api/p2p-prices.js

// Permite que solo tu dominio de frontend pueda llamar a esta función
const allowedOrigins = [
    'https://mrusdt.co',
    'https://www.mrusdt.co', // <-- AÑADIDO PARA SOLUCIONAR EL ERROR
    'http://localhost:3000',
    'http://127.0.0.1:5500'
];

// Helper para configurar las cabeceras CORS
const setCorsHeaders = (res, origin) => {
    if (allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
};

const fetch = require('node-fetch');
const FIAT_CURRENCY = "COP";
const CRYPTO_COIN = "USDT";
const PAYMENT_METHOD = "Bancolombia";

// --- Fetchers para cada Exchange (Implementaciones Reales) ---

// 1. Fetcher para Binance
async function getBinanceData() {
    try {
        const body = {
            fiat: FIAT_CURRENCY,
            page: 1,
            rows: 5,
            tradeType: "BUY",
            asset: CRYPTO_COIN,
            countries: [],
            payTypes: [PAYMENT_METHOD],
        };

        const buyPriceResponse = await fetch('https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...body, tradeType: 'SELL' }), // Compro a quien VENDE
        });
        const buyPriceData = await buyPriceResponse.json();
        const buyPrice = parseFloat(buyPriceData.data[0].adv.price);

        const sellPriceResponse = await fetch('https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...body, tradeType: 'BUY' }), // Vendo a quien COMPRA
        });
        const sellPriceData = await sellPriceResponse.json();
        const sellPrice = parseFloat(sellPriceData.data[0].adv.price);

        return { name: 'Binance', logo: 'https://p2p.binance.com/images/logo.png', buyPrice, sellPrice };
    } catch (error) {
        console.error("Error fetching Binance data:", error.message);
        return { name: 'Binance', error: 'Failed to fetch' };
    }
}

// 2. Fetcher para Bybit
async function getBybitData() {
    try {
        const body = {
            userId: "",
            tokenId: CRYPTO_COIN,
            currencyId: FIAT_CURRENCY,
            payment: [PAYMENT_METHOD],
            size: "5",
            page: "1",
            authMaker: false
        };
        const buyPriceResponse = await fetch('https://api2.bybit.com/fiat/otc/ads/list', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...body, side: "0" }), // Compro a quien VENDE (side 0)
        });
        const buyPriceData = await buyPriceResponse.json();
        const buyPrice = parseFloat(buyPriceData.result.items[0].price);

        const sellPriceResponse = await fetch('https://api2.bybit.com/fiat/otc/ads/list', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...body, side: "1" }), // Vendo a quien COMPRA (side 1)
        });
        const sellPriceData = await sellPriceResponse.json();
        const sellPrice = parseFloat(sellPriceData.result.items[0].price);

        return { name: 'Bybit', logo: 'https://www.bybit.com/bybit-logo.svg', buyPrice, sellPrice };
    } catch (error) {
        console.error("Error fetching Bybit data:", error.message);
        return { name: 'Bybit', error: 'Failed to fetch' };
    }
}

// 3. Fetcher para OKX
async function getOkxData() {
    try {
        const buyPriceResponse = await fetch(`https://www.okx.com/v3/c2c/tradingOrders/books?t=${Date.now()}&quoteCurrency=${FIAT_CURRENCY}&baseCurrency=${CRYPTO_COIN}&side=sell&paymentMethod=${PAYMENT_METHOD}&userType=all&showFollow=false&showAlreadyTraded=false&isAbleToTrade=false`);
        const buyPriceData = await buyPriceResponse.json();
        const buyPrice = parseFloat(buyPriceData.data.sell[0].price);

        const sellPriceResponse = await fetch(`https://www.okx.com/v3/c2c/tradingOrders/books?t=${Date.now()}&quoteCurrency=${FIAT_CURRENCY}&baseCurrency=${CRYPTO_COIN}&side=buy&paymentMethod=${PAYMENT_METHOD}&userType=all&showFollow=false&showAlreadyTraded=false&isAbleToTrade=false`);
        const sellPriceData = await sellPriceResponse.json();
        const sellPrice = parseFloat(sellPriceData.data.buy[0].price);

        return { name: 'OKX', logo: 'https://static.okx.com/cdn/assets/imgs/226/5186851288852AD6.png', buyPrice, sellPrice };
    } catch (error) {
        console.error("Error fetching OKX data:", error.message);
        return { name: 'OKX', error: 'Failed to fetch' };
    }
}

// 4. Fetcher para KuCoin
async function getKucoinData() {
    try {
        const buyPriceResponse = await fetch(`https://www.kucoin.com/_api/otc/ad/list?currency=${CRYPTO_COIN}&side=SELL&legal=${FIAT_CURRENCY}&page=1&pageSize=5&payType=${PAYMENT_METHOD}&lang=es_ES`);
        const buyPriceData = await buyPriceResponse.json();
        const buyPrice = parseFloat(buyPriceData.items[0].price);

        const sellPriceResponse = await fetch(`https://www.kucoin.com/_api/otc/ad/list?currency=${CRYPTO_COIN}&side=BUY&legal=${FIAT_CURRENCY}&page=1&pageSize=5&payType=${PAYMENT_METHOD}&lang=es_ES`);
        const sellPriceData = await sellPriceResponse.json();
        const sellPrice = parseFloat(sellPriceData.items[0].price);

        return { name: 'KuCoin', logo: 'https://assets.staticimg.com/cms/media/1lB3Pk9V6K2x3GUkmb3DBI.svg', buyPrice, sellPrice };
    } catch (error) {
        console.error("Error fetching Kucoin data:", error.message);
        return { name: 'KuCoin', error: 'Failed to fetch' };
    }
}

// 5. Fetcher para Bitget
async function getBitgetData() {
    try {
        const body = {
            "coin": CRYPTO_COIN,
            "fiat": FIAT_CURRENCY,
            "page": 1,
            "payment": PAYMENT_METHOD,
            "size": 5
        };

        const buyPriceResponse = await fetch('https://www.bitget.com/v1/p2p/public/adv/queryAdvList', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...body, "side": "SELL" }),
        });
        const buyPriceData = await buyPriceResponse.json();
        const buyPrice = parseFloat(buyPriceData.data.items[0]?.price);

        const sellPriceResponse = await fetch('https://www.bitget.com/v1/p2p/public/adv/queryAdvList', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...body, "side": "BUY" }),
        });
        const sellPriceData = await sellPriceResponse.json();
        const sellPrice = parseFloat(sellPriceData.data.items[0]?.price);

        return { name: 'Bitget', logo: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS4wA5t32A46-Pmu0k2n3dSo407-3i8gLzBwg&s', buyPrice, sellPrice };
    } catch (error) {
        console.error("Error fetching Bitget data:", error.message);
        return { name: 'Bitget', error: 'Failed to fetch' };
    }
}


// --- Función Principal del Servidor ---
export default async function handler(req, res) {
    const origin = req.headers.origin;
    setCorsHeaders(res, origin);

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method === 'GET') {
        try {
            const results = await Promise.all([
                getBinanceData(),
                getBybitData(),
                getOkxData(),
                getKucoinData(),
                getBitgetData()
            ]);

            const successfulResults = results.filter(r => r && !r.error && r.buyPrice && r.sellPrice);

            res.status(200).json(successfulResults);
        } catch (error) {
            console.error('Error in handler:', error.message);
            res.status(500).json({ message: "Internal Server Error", error: error.message });
        }
    } else {
        res.setHeader('Allow', ['GET', 'OPTIONS']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}
