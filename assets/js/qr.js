/*! DawQR — tiny offline QR Code encoder.
 *  Byte mode (UTF-8), error correction L/M/Q/H, versions 1–40, automatic mask choice.
 *  API: DawQR.encode(text, 'M') -> { version, size, mask, get(x, y) }
 *       DawQR.toSVG(qr, { margin, fg, bg })  -> SVG string
 *       DawQR.toCanvas(qr, canvas, { size, margin, fg, bg })
 */
(function (root) {
  'use strict';

  // Index = version (0 unused). Rows: Low, Medium, Quartile, High.
  var ECC_PER_BLOCK = [
    [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
    [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30]
  ];
  var BLOCKS = [
    [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
    [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
    [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
    [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81]
  ];
  var FORMAT_BITS = [1, 0, 3, 2]; // L, M, Q, H
  var LEVELS = { L: 0, M: 1, Q: 2, H: 3 };

  function bit(x, i) { return ((x >>> i) & 1) !== 0; }

  function rawDataModules(ver) {
    var r = (16 * ver + 128) * ver + 64;
    if (ver >= 2) {
      var n = Math.floor(ver / 7) + 2;
      r -= (25 * n - 10) * n - 55;
      if (ver >= 7) r -= 36;
    }
    return r;
  }
  function dataCodewords(ver, ecl) {
    return Math.floor(rawDataModules(ver) / 8) - ECC_PER_BLOCK[ecl][ver] * BLOCKS[ecl][ver];
  }

  function utf8(str) {
    if (typeof TextEncoder !== 'undefined') return Array.prototype.slice.call(new TextEncoder().encode(str));
    var s = unescape(encodeURIComponent(str)), out = [];
    for (var i = 0; i < s.length; i++) out.push(s.charCodeAt(i));
    return out;
  }

  // ---- Reed–Solomon over GF(256), polynomial 0x11D ----
  function gfMul(x, y) {
    var z = 0;
    for (var i = 7; i >= 0; i--) {
      z = (z << 1) ^ ((z >>> 7) * 0x11D);
      z ^= ((y >>> i) & 1) * x;
    }
    return z;
  }
  function rsDivisor(degree) {
    var res = [], i, j;
    for (i = 0; i < degree - 1; i++) res.push(0);
    res.push(1);
    var rootPow = 1;
    for (i = 0; i < degree; i++) {
      for (j = 0; j < res.length; j++) {
        res[j] = gfMul(res[j], rootPow);
        if (j + 1 < res.length) res[j] ^= res[j + 1];
      }
      rootPow = gfMul(rootPow, 2);
    }
    return res;
  }
  function rsRemainder(data, divisor) {
    var res = divisor.map(function () { return 0; });
    data.forEach(function (b) {
      var factor = b ^ res.shift();
      res.push(0);
      divisor.forEach(function (c, i) { res[i] ^= gfMul(c, factor); });
    });
    return res;
  }

  function addEccAndInterleave(data, ver, ecl) {
    var nBlocks = BLOCKS[ecl][ver], eccLen = ECC_PER_BLOCK[ecl][ver];
    var raw = Math.floor(rawDataModules(ver) / 8);
    var nShort = nBlocks - raw % nBlocks;
    var shortLen = Math.floor(raw / nBlocks);
    var divisor = rsDivisor(eccLen);
    var blocks = [], k = 0, i;
    for (i = 0; i < nBlocks; i++) {
      var datLen = shortLen - eccLen + (i < nShort ? 0 : 1);
      var dat = data.slice(k, k + datLen);
      k += datLen;
      var ecc = rsRemainder(dat, divisor);
      if (i < nShort) dat.push(0);
      blocks.push(dat.concat(ecc));
    }
    var out = [];
    for (i = 0; i < blocks[0].length; i++) {
      for (var j = 0; j < blocks.length; j++) {
        if (i !== shortLen - eccLen || j >= nShort) out.push(blocks[j][i]);
      }
    }
    return out;
  }

  // ---- Matrix construction ----
  function alignmentPositions(ver, size) {
    if (ver === 1) return [];
    var n = Math.floor(ver / 7) + 2;
    var step = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2;
    var res = [6];
    for (var pos = size - 7, i = 0; i < n - 1; i++, pos -= step) res.splice(1, 0, pos);
    return res;
  }

  function Matrix(ver, ecl) {
    this.ver = ver;
    this.ecl = ecl;
    this.size = ver * 4 + 17;
    this.m = [];
    this.f = [];
    for (var y = 0; y < this.size; y++) {
      var a = [], b = [];
      for (var x = 0; x < this.size; x++) { a.push(false); b.push(false); }
      this.m.push(a);
      this.f.push(b);
    }
  }
  Matrix.prototype.setFn = function (x, y, dark) {
    this.m[y][x] = dark;
    this.f[y][x] = true;
  };
  Matrix.prototype.drawFunctionPatterns = function () {
    var size = this.size, i;
    for (i = 0; i < size; i++) {
      this.setFn(6, i, i % 2 === 0);
      this.setFn(i, 6, i % 2 === 0);
    }
    this.finder(3, 3);
    this.finder(size - 4, 3);
    this.finder(3, size - 4);
    var pos = alignmentPositions(this.ver, size), n = pos.length;
    for (i = 0; i < n; i++) {
      for (var j = 0; j < n; j++) {
        if (!((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0))) this.align(pos[i], pos[j]);
      }
    }
    this.drawFormat(0);
    this.drawVersion();
  };
  Matrix.prototype.finder = function (x, y) {
    for (var dy = -4; dy <= 4; dy++) {
      for (var dx = -4; dx <= 4; dx++) {
        var d = Math.max(Math.abs(dx), Math.abs(dy)), xx = x + dx, yy = y + dy;
        if (xx >= 0 && xx < this.size && yy >= 0 && yy < this.size) this.setFn(xx, yy, d !== 2 && d !== 4);
      }
    }
  };
  Matrix.prototype.align = function (x, y) {
    for (var dy = -2; dy <= 2; dy++) {
      for (var dx = -2; dx <= 2; dx++) this.setFn(x + dx, y + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  };
  Matrix.prototype.drawFormat = function (mask) {
    var data = (FORMAT_BITS[this.ecl] << 3) | mask, rem = data, i;
    for (i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    var bits = ((data << 10) | rem) ^ 0x5412, size = this.size;
    for (i = 0; i <= 5; i++) this.setFn(8, i, bit(bits, i));
    this.setFn(8, 7, bit(bits, 6));
    this.setFn(8, 8, bit(bits, 7));
    this.setFn(7, 8, bit(bits, 8));
    for (i = 9; i < 15; i++) this.setFn(14 - i, 8, bit(bits, i));
    for (i = 0; i < 8; i++) this.setFn(size - 1 - i, 8, bit(bits, i));
    for (i = 8; i < 15; i++) this.setFn(8, size - 15 + i, bit(bits, i));
    this.setFn(8, size - 8, true);
  };
  Matrix.prototype.drawVersion = function () {
    if (this.ver < 7) return;
    var rem = this.ver, i;
    for (i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
    var bits = (this.ver << 12) | rem;
    for (i = 0; i < 18; i++) {
      var c = bit(bits, i), a = this.size - 11 + (i % 3), b = Math.floor(i / 3);
      this.setFn(a, b, c);
      this.setFn(b, a, c);
    }
  };
  Matrix.prototype.drawCodewords = function (data) {
    var size = this.size, i = 0;
    for (var right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (var vert = 0; vert < size; vert++) {
        for (var j = 0; j < 2; j++) {
          var x = right - j;
          var upward = ((right + 1) & 2) === 0;
          var y = upward ? size - 1 - vert : vert;
          if (!this.f[y][x] && i < data.length * 8) {
            this.m[y][x] = bit(data[i >>> 3], 7 - (i & 7));
            i++;
          }
        }
      }
    }
  };
  Matrix.prototype.applyMask = function (mask) {
    for (var y = 0; y < this.size; y++) {
      for (var x = 0; x < this.size; x++) {
        var inv;
        switch (mask) {
          case 0: inv = (x + y) % 2 === 0; break;
          case 1: inv = y % 2 === 0; break;
          case 2: inv = x % 3 === 0; break;
          case 3: inv = (x + y) % 3 === 0; break;
          case 4: inv = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
          case 5: inv = (x * y) % 2 + (x * y) % 3 === 0; break;
          case 6: inv = ((x * y) % 2 + (x * y) % 3) % 2 === 0; break;
          default: inv = ((x + y) % 2 + (x * y) % 3) % 2 === 0;
        }
        if (!this.f[y][x] && inv) this.m[y][x] = !this.m[y][x];
      }
    }
  };
  Matrix.prototype.penalty = function () {
    var n = this.size, m = this.m, pen = 0, x, y, i, run, dark = 0;

    function lightRange(line, a, b) {
      for (var k = a; k < b; k++) if (k >= 0 && k < n && line[k]) return false;
      return true;
    }
    function scanLine(line) {
      var p = 0, r = 1, k;
      for (k = 1; k < n; k++) {
        if (line[k] === line[k - 1]) { r++; if (r === 5) p += 3; else if (r > 5) p++; }
        else r = 1;
      }
      var pat = [true, false, true, true, true, false, true];
      for (k = 0; k + 7 <= n; k++) {
        var hit = true;
        for (var q = 0; q < 7; q++) if (line[k + q] !== pat[q]) { hit = false; break; }
        if (hit && (lightRange(line, k - 4, k) || lightRange(line, k + 7, k + 11))) p += 40;
      }
      return p;
    }

    for (y = 0; y < n; y++) pen += scanLine(m[y]);
    for (x = 0; x < n; x++) {
      var col = [];
      for (y = 0; y < n; y++) col.push(m[y][x]);
      pen += scanLine(col);
    }
    for (y = 0; y < n - 1; y++) {
      for (x = 0; x < n - 1; x++) {
        var c = m[y][x];
        if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) pen += 3;
      }
    }
    for (y = 0; y < n; y++) for (x = 0; x < n; x++) if (m[y][x]) dark++;
    var total = n * n;
    pen += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
    return pen;
  };

  // ---- Public API ----
  function encode(text, level) {
    var ecl = LEVELS[String(level || 'M').toUpperCase()];
    if (ecl === undefined) throw new Error('Invalid error correction level');
    var bytes = utf8(String(text)), ver, ccBits;
    for (ver = 1; ver <= 40; ver++) {
      ccBits = ver <= 9 ? 8 : 16;
      if (bytes.length < (1 << ccBits) && 4 + ccBits + bytes.length * 8 <= dataCodewords(ver, ecl) * 8) break;
    }
    if (ver > 40) throw new Error('Text is too long for a QR code at this error-correction level');

    var bits = [];
    function put(val, len) { for (var i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); }
    put(4, 4);                 // byte mode
    put(bytes.length, ccBits);
    bytes.forEach(function (b) { put(b, 8); });
    var cap = dataCodewords(ver, ecl) * 8;
    put(0, Math.min(4, cap - bits.length));
    while (bits.length % 8) bits.push(0);
    for (var pad = 0xEC; bits.length < cap; pad ^= 0xEC ^ 0x11) put(pad, 8);

    var data = [];
    for (var i = 0; i < bits.length; i++) data[i >>> 3] = (data[i >>> 3] || 0) | (bits[i] << (7 - (i & 7)));

    var mx = new Matrix(ver, ecl);
    mx.drawFunctionPatterns();
    mx.drawCodewords(addEccAndInterleave(data, ver, ecl));

    var best = 0, bestPen = Infinity;
    for (var mask = 0; mask < 8; mask++) {
      mx.applyMask(mask);
      mx.drawFormat(mask);
      var p = mx.penalty();
      if (p < bestPen) { bestPen = p; best = mask; }
      mx.applyMask(mask); // undo
    }
    mx.drawFormat(best);
    mx.applyMask(best);

    return {
      version: ver,
      size: mx.size,
      mask: best,
      get: function (x, y) { return x >= 0 && y >= 0 && x < mx.size && y < mx.size && mx.m[y][x]; }
    };
  }

  function safeColor(c, fallback) {
    return /^#[0-9a-f]{3,8}$/i.test(String(c)) ? c : fallback;
  }

  function toSVG(qr, opts) {
    opts = opts || {};
    var margin = opts.margin == null ? 4 : opts.margin;
    var fg = safeColor(opts.fg, '#000000'), bg = safeColor(opts.bg, '#ffffff');
    var dim = qr.size + margin * 2, d = [];
    for (var y = 0; y < qr.size; y++) {
      var x = 0;
      while (x < qr.size) {
        if (qr.get(x, y)) {
          var start = x;
          while (x < qr.size && qr.get(x, y)) x++;
          d.push('M' + (start + margin) + ',' + (y + margin) + 'h' + (x - start) + 'v1h-' + (x - start) + 'z');
        } else x++;
      }
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + dim + ' ' + dim + '" shape-rendering="crispEdges">' +
      '<rect width="' + dim + '" height="' + dim + '" fill="' + bg + '"/>' +
      '<path fill="' + fg + '" d="' + d.join('') + '"/></svg>';
  }

  function toCanvas(qr, canvas, opts) {
    opts = opts || {};
    var margin = opts.margin == null ? 4 : opts.margin;
    var dim = qr.size + margin * 2;
    var scale = Math.max(1, Math.round((opts.size || 512) / dim));
    canvas.width = canvas.height = dim * scale;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = safeColor(opts.bg, '#ffffff');
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = safeColor(opts.fg, '#000000');
    for (var y = 0; y < qr.size; y++) {
      for (var x = 0; x < qr.size; x++) {
        if (qr.get(x, y)) ctx.fillRect((x + margin) * scale, (y + margin) * scale, scale, scale);
      }
    }
    return canvas;
  }

  var api = { encode: encode, toSVG: toSVG, toCanvas: toCanvas, LEVELS: LEVELS };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DawQR = api;
})(typeof self !== 'undefined' ? self : this);
