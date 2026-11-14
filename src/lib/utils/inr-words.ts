/**
 * Convert an amount in INR into Indian numbering system words.
 * Handles Crores, Lakhs, Thousands, Hundreds, and Paise.
 * Example: 118000 -> "INR One Lakh, Eighteen Thousand Rupees Only."
 */
export function numberToWordsINR(num: number): string {
  if (!num || isNaN(num) || num <= 0) return 'INR Zero Rupees Only.';
  const integerPart = Math.floor(num);
  const decimalPart = Math.round((num - integerPart) * 100);

  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen',
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function inWords(val: number): string {
    let str = '';
    if (val > 99) {
      str += a[Math.floor(val / 100)] + ' Hundred ';
      val %= 100;
    }
    if (val > 19) {
      str += b[Math.floor(val / 10)] + (val % 10 ? '-' + a[val % 10] : '') + ' ';
    } else if (val > 0) {
      str += a[val] + ' ';
    }
    return str;
  }

  let words = '';
  let n = integerPart;
  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  const hundredAndRem = n;

  if (crore > 0) words += inWords(crore) + 'Crore, ';
  if (lakh > 0) words += inWords(lakh) + 'Lakh, ';
  if (thousand > 0) words += inWords(thousand) + 'Thousand, ';
  if (hundredAndRem > 0) words += inWords(hundredAndRem);

  words = words.trim().replace(/,\s*$/, '');
  let result = words ? 'INR ' + words + ' Rupees' : 'INR Zero Rupees';

  if (decimalPart > 0) {
    result += ' And ' + inWords(decimalPart).trim() + ' Paise';
  }

  return result + ' Only.';
}
