/* DAWAPPS registry — single source of truth for the hub.
   To add an app: create apps/<id>.html, add an entry here and add the file to
   PRECACHE in sw.js. */
window.DAW_CATEGORIES = [
  { id: 'writing',      name: 'Writing',      hue: 205 },
  { id: 'developer',    name: 'Developer',    hue: 262 },
  { id: 'design',       name: 'Design',       hue: 330 },
  { id: 'productivity', name: 'Productivity', hue: 32  },
  { id: 'calc',         name: 'Calculate',    hue: 160 },
  { id: 'media',        name: 'Media',        hue: 8   },
  { id: 'iot',          name: 'IoT & Embedded', hue: 125 }
];

window.DAW_APPS = [
  { id: 'text-counter',     name: 'Text Counter',      icon: '🔤', cat: 'writing',      desc: 'Words, characters, sentences and reading time.',            tags: ['word count', 'characters', 'reading time', 'length', 'paragraphs'] },
  { id: 'password-generator', name: 'Password & Hash', icon: '🔐', cat: 'developer',    desc: 'Secure passwords and SHA hashes, made in your browser.',    tags: ['security', 'random', 'sha256', 'sha', 'crypto', 'checksum'] },
  { id: 'pomodoro',         name: 'Pomodoro Focus',    icon: '🍅', cat: 'productivity', desc: 'Focus, short and long break timer with session tracking.',  tags: ['timer', 'focus', 'study', 'break', 'work'], wide: true },
  { id: 'color-palette',    name: 'Color Studio',      icon: '🎨', cat: 'design',       desc: 'Pick colors, convert HEX / RGB / HSL and build palettes.',  tags: ['hex', 'rgb', 'hsl', 'contrast', 'swatch', 'picker'], wide: true },
  { id: 'box-shadow',       name: 'Shadow Generator',  icon: '🔲', cat: 'design',       desc: 'Visual CSS box-shadow and border-radius builder.',          tags: ['css', 'box-shadow', 'radius', 'depth'] },
  { id: 'markdown-preview', name: 'Markdown Preview',  icon: '✍️', cat: 'writing',      desc: 'Write Markdown, see live HTML, copy the result.',           tags: ['md', 'html', 'editor', 'preview'] },
  { id: 'encoder',          name: 'Encoder / Decoder', icon: '🔁', cat: 'developer',    desc: 'Base64, URL, HTML entities and hex in one place.',          tags: ['base64', 'url', 'encode', 'decode', 'html', 'hex'] },
  { id: 'unit-converter',   name: 'Unit Converter',    icon: '📏', cat: 'calc',         desc: 'Length, mass, temperature, volume, speed, data and more.',  tags: ['metric', 'imperial', 'length', 'weight', 'temperature', 'volume'] },
  { id: 'decision-maker',   name: 'Decision Maker',    icon: '🎲', cat: 'productivity', desc: 'Pick randomly, flip a coin, roll dice or shuffle a list.',  tags: ['random', 'picker', 'coin', 'dice', 'choose', 'shuffle'] },
  { id: 'sticky-notes',     name: 'Sticky Notes',      icon: '🗒️', cat: 'productivity', desc: 'Colorful notes that stay on your device.',                  tags: ['notes', 'ideas', 'memo', 'todo', 'local'] },
  { id: 'qr-generator',     name: 'QR Generator',      icon: '🔳', cat: 'media',        desc: 'Scannable QR codes for links, text and Wi-Fi. Works offline.', tags: ['qr', 'link', 'wifi', 'barcode', 'png', 'svg'], wide: true },
  { id: 'json-formatter',   name: 'JSON Formatter',    icon: '🧾', cat: 'developer',    desc: 'Format, minify, validate and sort JSON with clear errors.', tags: ['json', 'validate', 'pretty', 'minify', 'beautify'], wide: true },
  { id: 'stopwatch',        name: 'Stopwatch',         icon: '⏱️', cat: 'productivity', desc: 'Precise stopwatch with lap times.',                         tags: ['timer', 'laps', 'time', 'chrono'] },
  { id: 'tip-calculator',   name: 'Tip & Bill Split',  icon: '💸', cat: 'calc',         desc: 'Split the bill and add a tip in any currency.',             tags: ['tip', 'bill', 'split', 'restaurant', 'money'] },
  { id: 'aspect-ratio',     name: 'Aspect Ratio',      icon: '🖥️', cat: 'calc',         desc: 'Simplify ratios and resize proportionally.',                tags: ['resolution', '16:9', 'screen', 'video', 'resize'] },
  { id: 'gradient-generator', name: 'Gradient Generator', icon: '🌈', cat: 'design',    desc: 'Linear, radial and conic CSS gradients with multiple stops.', tags: ['css', 'background', 'color', 'linear', 'radial', 'conic'] },
  { id: 'text-case',        name: 'Text Case',         icon: '🔠', cat: 'writing',      desc: 'UPPER, Title, camelCase, snake_case, kebab-case and more.', tags: ['uppercase', 'lowercase', 'camel', 'snake', 'kebab', 'title'] },
  { id: 'calculator',       name: 'Calculator',        icon: '🧮', cat: 'calc',         desc: 'Expression calculator with keypad, functions and history.', tags: ['math', 'expression', 'sqrt', 'percent', 'arithmetic'] },
  { id: 'number-converter', name: 'Number Base',       icon: '🔢', cat: 'calc',         desc: 'Binary, octal, decimal, hex and any base up to 36.',        tags: ['binary', 'hex', 'decimal', 'octal', 'radix', 'base'] },
  { id: 'countdown',        name: 'Countdown',         icon: '⏳', cat: 'productivity', desc: 'Track several events with live countdowns.',                tags: ['event', 'date', 'deadline', 'days left', 'birthday'] },
  { id: 'code-scanner',     name: 'Code Scanner',      icon: '📷', cat: 'media',        desc: 'Scan QR codes and barcodes with your camera or an image.',  tags: ['qr', 'barcode', 'camera', 'scan', 'reader'] },
  { id: 'svg-converter',    name: 'SVG to Data URI',   icon: '🧩', cat: 'developer',    desc: 'Turn SVG markup into compact, CSS-ready data URIs.',        tags: ['svg', 'data uri', 'base64', 'css', 'icon', 'background'] },
  { id: 'image-compressor', name: 'Image Compressor',  icon: '🗜️', cat: 'media',        desc: 'Resize and compress JPEG, WebP or PNG locally.',            tags: ['image', 'photo', 'resize', 'compress', 'jpeg', 'webp', 'shrink'], wide: true },
  { id: 'css-units',        name: 'CSS Units',         icon: '📐', cat: 'developer',    desc: 'Convert px, rem, em, vw, vh, pt, cm and more.',             tags: ['px', 'rem', 'em', 'vw', 'vh', 'pt', 'css'] },
  { id: 'timestamp',        name: 'Epoch Converter',   icon: '🕒', cat: 'developer',    desc: 'Unix timestamps to readable dates and back.',               tags: ['unix', 'epoch', 'date', 'time', 'utc', 'iso'] },
  { id: 'serial-monitor',   name: 'Serial & BLE Monitor', icon: '📡', cat: 'iot',     desc: 'Stream live logs from USB serial or Bluetooth LE devices, plot values and send commands.', tags: ['web serial', 'web bluetooth', 'ble', 'usb', 'uart', 'esp32', 'arduino', 'sensor', 'monitor', 'terminal', 'baud', 'nordic uart', 'hm-10', 'log', 'plotter'], wide: true },
  { id: 'snippet-vault',    name: 'Snippet Vault',     icon: '🧩', cat: 'iot',        desc: 'ESP32 / Arduino C++ snippets loaded from a JSON file. View, copy, download.', tags: ['esp32', 'arduino', 'c++', 'cpp', 'code', 'snippet', 'ino', 'relay', 'oled', 'ssd1306', 'lcd', 'i2c', 'mqtt', 'wifi', 'microcontroller', 'sketch'], wide: true },
  { id: 'electronics-calc', name: 'Electronics Calc',  icon: '⚡', cat: 'iot',        desc: "Ohm's law, resistor color code and ADC sensor mapping.", tags: ['ohm', 'resistor', 'color code', 'adc', 'voltage divider', 'volt', 'amp', 'watt', 'power', 'analogread', 'map', 'esp32', 'arduino', 'resistance'] }
];
