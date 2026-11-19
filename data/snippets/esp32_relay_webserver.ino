/*
 * ESP32 4-Channel Relay Web Server
 * ------------------------------------------------------------
 * Board     : ESP32 (any dev board) - Arduino-ESP32 core 2.x or 3.x
 * Libraries : none (WiFi, WebServer and ESPmDNS ship with the core)
 *
 * Open http://esp32-relay.local/ (or the IP printed on Serial) from a phone or PC
 * on the same network to switch the four relays.
 *
 * REST API
 *   GET /api/relays                     -> {"relays":[false,false,false,false]}
 *   GET /api/relay?ch=1&state=1         -> switch channel 1 ON  (state=0 for OFF)
 *
 * SECURITY: there is no authentication. Keep this on your home LAN and never
 * expose it to the internet. Relays that switch mains voltage need a proper,
 * insulated enclosure.
 */
#include <WiFi.h>
#include <WebServer.h>
#include <ESPmDNS.h>

// ---- User settings ----------------------------------------------------------
const char* WIFI_SSID = "YOUR_WIFI_NAME";
const char* WIFI_PASS = "YOUR_WIFI_PASSWORD";
const char* HOSTNAME  = "esp32-relay";

const uint8_t RELAY_COUNT = 4;
const uint8_t RELAY_PINS[RELAY_COUNT] = {23, 22, 21, 19};  // GPIOs wired to IN1..IN4
const bool    ACTIVE_LOW = true;   // most relay modules switch ON when the pin is LOW
// ------------------------------------------------------------------------------

WebServer server(80);
bool relayState[RELAY_COUNT] = {false, false, false, false};

const char INDEX_HTML[] PROGMEM = R"rawliteral(
<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>ESP32 Relays</title>
<style>
body{font-family:system-ui,sans-serif;margin:0;padding:20px;background:#10131b;color:#f1f4fa}
h1{font-size:20px;margin:0 0 16px}
.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;max-width:420px}
button{padding:24px 10px;font-size:17px;border:0;border-radius:14px;color:#fff;background:#3a4256}
button.on{background:#2fb344}
</style></head><body>
<h1>ESP32 Relay Control</h1>
<div class="grid" id="g"></div>
<script>
const g = document.getElementById('g');
function paint(s) {
  s.relays.forEach((on, i) => {
    const b = document.getElementById('r' + (i + 1));
    b.classList.toggle('on', on);
    b.textContent = 'Relay ' + (i + 1) + (on ? ': ON' : ': OFF');
  });
}
for (let i = 1; i <= 4; i++) {
  const b = document.createElement('button');
  b.id = 'r' + i;
  b.onclick = () => fetch('/api/relay?ch=' + i + '&state=' + (b.classList.contains('on') ? 0 : 1))
    .then(r => r.json()).then(paint);
  g.append(b);
}
function poll() { fetch('/api/relays').then(r => r.json()).then(paint).catch(() => {}); }
poll();
setInterval(poll, 3000);
</script></body></html>
)rawliteral";

// Drive one relay pin according to relayState[] and the ACTIVE_LOW setting.
void applyRelay(uint8_t index) {
  const bool pinHigh = relayState[index] ? !ACTIVE_LOW : ACTIVE_LOW;
  digitalWrite(RELAY_PINS[index], pinHigh ? HIGH : LOW);
}

void sendStatus() {
  String json = "{\"relays\":[";
  for (uint8_t i = 0; i < RELAY_COUNT; i++) {
    json += relayState[i] ? "true" : "false";
    if (i < RELAY_COUNT - 1) json += ',';
  }
  json += "]}";
  server.send(200, "application/json", json);
}

void handleRelaySet() {
  if (!server.hasArg("ch") || !server.hasArg("state")) {
    server.send(400, "application/json", "{\"error\":\"ch and state are required\"}");
    return;
  }
  const int channel = server.arg("ch").toInt();
  const int state   = server.arg("state").toInt();
  if (channel < 1 || channel > RELAY_COUNT) {
    server.send(400, "application/json", "{\"error\":\"ch must be 1-4\"}");
    return;
  }
  relayState[channel - 1] = (state != 0);
  applyRelay(channel - 1);
  Serial.printf("Relay %d -> %s\n", channel, relayState[channel - 1] ? "ON" : "OFF");
  sendStatus();
}

void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.setHostname(HOSTNAME);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("Connecting to Wi-Fi");
  const uint32_t started = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - started < 20000) {
    delay(400);
    Serial.print('.');
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\nConnected. IP: %s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("\nWi-Fi not connected yet - will keep retrying in loop().");
  }
}

void setup() {
  Serial.begin(115200);

  for (uint8_t i = 0; i < RELAY_COUNT; i++) {
    pinMode(RELAY_PINS[i], OUTPUT);
    applyRelay(i);                       // start with every relay OFF
  }

  connectWiFi();
  if (MDNS.begin(HOSTNAME)) {
    MDNS.addService("http", "tcp", 80);
  }

  server.on("/", HTTP_GET, []() { server.send_P(200, "text/html", INDEX_HTML); });
  server.on("/api/relays", HTTP_GET, sendStatus);
  server.on("/api/relay", HTTP_GET, handleRelaySet);
  server.onNotFound([]() { server.send(404, "text/plain", "Not found"); });
  server.begin();
  Serial.println("HTTP server started");
}

void loop() {
  server.handleClient();

  // Non-blocking Wi-Fi watchdog: retry every 10 seconds while disconnected.
  static uint32_t lastCheck = 0;
  if (millis() - lastCheck > 10000) {
    lastCheck = millis();
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("Wi-Fi lost, reconnecting...");
      WiFi.disconnect();
      WiFi.begin(WIFI_SSID, WIFI_PASS);
    }
  }
}
