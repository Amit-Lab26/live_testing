import Papa from 'papaparse';
import type { OHLCVBar } from '../types/ohlcv';

/**
 * Convert "DD-MM-YYYY HH:mm" to Unix timestamp (seconds)
 *
 * Parses the date string as UTC to ensure the chart displays the time exactly as in the CSV.
 */
function parseDateToUnix(dateStr: string): number {
    const [datePart, timePart] = dateStr.trim().split(' ');
    if (!datePart || !timePart) {
        return NaN;
    }
    const [dayStr, monthStr, yearStr] = datePart.split('-');
    const [hourStr, minuteStr] = timePart.split(':');

    const year = Number(yearStr);
    const month = Number(monthStr); // 1-12
    const day = Number(dayStr);
    const hour = Number(hourStr);
    const minute = Number(minuteStr);

    if ([year, month, day, hour, minute].some((n) => Number.isNaN(n))) {
        return NaN;
    }

    // Parse as UTC to match CSV time exactly
    const utcDate = new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0));
    return Math.floor(utcDate.getTime() / 1000);
}

export function parseCSVText(text: string, fileName = 'CSV file'): OHLCVBar[] {
    if (!text || !text.trim()) {
        throw new Error(`${fileName} is empty.`);
    }

    const result = Papa.parse<Record<string, string>>(text, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) => h.trim(),
    });

    if (result.errors.length > 0) {
        const firstError = result.errors[0];
        if (firstError.message && !firstError.message.includes('Too few columns')) {
            throw new Error(`The CSV could not be parsed: ${firstError.message}`);
        }
    }

    const bars: OHLCVBar[] = result.data
        .map((row) => ({
            time: parseDateToUnix(row['time'] ?? row['datetime'] ?? row['date'] ?? ''),
            open: parseFloat(row['open'] ?? ''),
            high: parseFloat(row['high'] ?? ''),
            low: parseFloat(row['low'] ?? ''),
            close: parseFloat(row['close'] ?? ''),
            volume: parseFloat(row['volume'] ?? ''),
        }))
        .filter((b) => !isNaN(b.time) && !isNaN(b.open) && !isNaN(b.high) && !isNaN(b.low) && !isNaN(b.close) && !isNaN(b.volume))
        .sort((a, b) => a.time - b.time);

    if (bars.length === 0) {
        throw new Error(`No valid OHLCV data was found in ${fileName}. Please check that the file includes time, open, high, low, close and volume columns.`);
    }

    return bars;
}

/**
 * Fetch and parse an OHLCV CSV from /data/{symbol}.csv
 */
export async function loadCSV(symbol: string): Promise<OHLCVBar[]> {
    const url = `/data/${symbol}.csv`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
    }
    const text = await response.text();
    return parseCSVText(text, symbol);
}

export async function loadCSVFromFile(file: File): Promise<OHLCVBar[]> {
    if (!file) {
        throw new Error('No CSV file was selected.');
    }

    const fileName = file.name || 'uploaded CSV';
    const isCsv = fileName.toLowerCase().endsWith('.csv') || file.type.toLowerCase().includes('csv');
    if (!isCsv) {
        throw new Error('Please choose a valid .csv file.');
    }

    try {
        const text = await file.text();
        return parseCSVText(text, fileName);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to read the uploaded file.';
        throw new Error(message);
    }
}

export let AVAILABLE_STOCKS: string[] = ['RELIANCE', 'TCS', 'INFY'];

/**
 * Fetch the list of available stocks from the server
 */
export async function loadAvailableStocks(): Promise<string[]> {
    try {
        const response = await fetch('/api/available-stocks');
        if (!response.ok) {
            throw new Error(`Failed to fetch stocks: ${response.status}`);
        }
        const data = await response.json();
        AVAILABLE_STOCKS = data.stocks.sort();
        return AVAILABLE_STOCKS;
    } catch (err) {
        console.warn('Failed to load available stocks from server, using defaults:', err);
        return AVAILABLE_STOCKS;
    }
}
