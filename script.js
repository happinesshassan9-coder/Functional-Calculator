// Simple calculator behavior with mathjs API fallback
// Elements
const exprEl = document.getElementById('expr');
const resEl  = document.getElementById('res');
const pad = document.getElementById('pad');

// State
let expression = '';
let result = '0';

// Helper to format numeric output concisely
function fmt(v) {
  if (typeof v === 'number' && !Number.isInteger(v)) {
    return parseFloat(v.toPrecision(12)).toString();
  }
  return String(v);
}

// Render UI
function render() {
  exprEl.textContent = expression || '0';
  resEl.textContent  = result;
}

// Click handling for buttons
pad.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;

  const val = btn.getAttribute('data-value');
  const action = btn.getAttribute('data-action');

  if (action === 'clear') {
    expression = '';
    result = '0';
    render();
    return;
  }

  if (action === 'neg') {
    expression = toggleNegateLastNumber(expression);
    render();
    return;
  }

  if (action === 'percent') {
    expression = applyPercentToLastNumber(expression);
    render();
    return;
  }

  if (action === 'equals') {
    evaluateExpression(expression);
    return;
  }

  if (val) {
    const mapped = val.replace('÷','/').replace('×','*').replace('−','-');
    expression = appendToExpression(expression, mapped);
    render();
  }
});

// Append token with small sanitizations
function appendToExpression(expr, token) {
  if (/^[+\-*/.]$/.test(token)) {
    if (expr === '') {
      if (token === '+' || token === '-') return token;
      return expr;
    }
    if (/[+\-*/.]$/.test(expr)) {
      if (token === '-' && !expr.endsWith('-')) return expr + token;
      return expr.slice(0, -1) + token;
    }
  }
  if ((expr + token).length > 80) return expr;
  return expr + token;
}

// Toggle negation of last number
function toggleNegateLastNumber(expr) {
  const match = expr.match(/(-?\d+(\.\d+)?)(?!.*\d)/);
  if (!match) return expr;
  const num = match[1];
  const start = match.index;
  const before = expr.slice(0, start);
  const toggled = num.startsWith('-') ? num.slice(1) : ('-' + num);
  return before + toggled;
}

// Apply percent to last number
function applyPercentToLastNumber(expr) {
  const match = expr.match(/(-?\d+(\.\d+)?)(?!.*\d)/);
  if (!match) return expr;
  const num = parseFloat(match[1]);
  if (Number.isNaN(num)) return expr;
  const start = match.index;
  const before = expr.slice(0, start);
  const updated = (num / 100).toString();
  return before + updated;
}

// Evaluate expression using mathjs API with local fallback
async function evaluateExpression(expr) {
  if (!expr) return;
  const safeExpr = expr.replace(/÷/g,'/').replace(/×/g,'*').replace(/−/g,'-');

  result = '…';
  render();

  try {
    const url = 'https://api.mathjs.org/v4/?expr=' + encodeURIComponent(safeExpr);
    const resp = await fetch(url, { method: 'GET', cache: 'no-store' });
    if (!resp.ok) throw new Error('API error ' + resp.status);
    const text = await resp.text();
    result = fmt(Number(text) || text);
    expression = String(result);
    render();
  } catch (apiError) {
    try {
      const local = safeEvaluate(safeExpr);
      result = fmt(local);
      expression = String(result);
      render();
    } catch (localError) {
      result = 'Error';
      render();
    }
  }
}

// Local safe evaluator for basic arithmetic
function safeEvaluate(input) {
  const s = input.replace(/\s+/g, '');
  let i = 0;
  function peek() { return s[i]; }
  function consume() { return s[i++]; }

  function parseNumber() {
    let start = i;
    if (peek() === '-') consume();
    while (/\d|\./.test(peek())) consume();
    const raw = s.slice(start, i);
    if (raw === '' || raw === '-') throw new Error('Invalid number');
    return parseFloat(raw);
  }

  function parseFactor() {
    if (peek() === '(') {
      consume();
      const val = parseExpression();
      if (peek() !== ')') throw new Error('Missing )');
      consume();
      return val;
    }
    if (peek() === '+') { consume(); return parseFactor(); }
    if (peek() === '-') { consume(); return -parseFactor(); }
    return parseNumber();
  }

  function parseTerm() {
    let value = parseFactor();
    while (peek() === '*' || peek() === '/') {
      const op = consume();
      const right = parseFactor();
      if (op === '*') value = value * right;
      else value = value / right;
    }
    return value;
  }

  function parseExpression() {
    let value = parseTerm();
    while (peek() === '+' || peek() === '-') {
      const op = consume();
      const right = parseTerm();
      if (op === '+') value = value + right;
      else value = value - right;
    }
    return value;
  }

  const out = parseExpression();
  if (i < s.length) throw new Error('Unexpected input');
  return out;
}

// Keyboard support
window.addEventListener('keydown', (ev) => {
  const key = ev.key;
  if ((/^[0-9]$/).test(key) || key === '.' ) {
    expression = appendToExpression(expression, key);
    render(); return;
  }
  if (key === 'Enter' || key === '=') {
    ev.preventDefault();
    evaluateExpression(expression); return;
  }
  if (key === 'Backspace') {
    expression = expression.slice(0, -1); render(); return;
  }
  if (['+','-','*','/'].includes(key)) {
    expression = appendToExpression(expression, key); render(); return;
  }
  if (key === '%') {
    expression = applyPercentToLastNumber(expression); render(); return;
  }
  if (key === 'Escape') {
    expression = ''; result = '0'; render(); return;
  }
});

// Initial UI
render();
