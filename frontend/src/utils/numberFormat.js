/**
 * Format a number to 2 decimal places only if required
 * @param {number} value - The number to format
 * @returns {string} - Formatted number string
 */
export const formatNumber = (value) => {
  if (value === null || value === undefined || isNaN(value)) {
    return '0';
  }
  const num = Number(value);
  const rounded = Math.round(num * 100) / 100;
  return rounded % 1 === 0 ? rounded.toString() : rounded.toFixed(2).replace(/\.?0+$/, '');
};

/**
 * Format a number with currency symbol, 2 decimal places only if required
 * @param {number} value - The number to format
 * @param {string} symbol - Currency symbol (default: '$')
 * @returns {string} - Formatted currency string
 */
export const formatCurrency = (value, symbol = '$') => {
  if (value === null || value === undefined || isNaN(value)) {
    return `${symbol}0`;
  }
  return `${symbol}${formatNumber(value)}`;
};

