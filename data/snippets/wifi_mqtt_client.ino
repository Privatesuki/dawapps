/*
 * Wi-Fi + MQTT Client Boilerplate (non-blocking, auto-reconnect)
 * ------------------------------------------------------------
 * Board     : ESP32 (see notes at the bottom for ESP8266)
 * Libraries : "PubSubClient" by Nick O'Leary (Library Manager)
 *
 * Topics (DEVICE_ID is built from the chip MAC, e.g. esp32-a1b2c3):
 *   <DEVICE_ID>/status     "online" / "offline"  (retained; "offline" is the Last Will)
 *   <DEVICE_ID>/telemetry  JSON every 10 s: {"uptime":..,"rssi":..,"heap":..}
 *   <DEVICE_ID>/cmd        send "ON" / "OFF" to switch the on-board LED
 *
 * Test with:  mosquitto_sub -h <broker> -t "esp32-+/#" -v
 *             mosquitto_pub -h <broker> -t "esp32-a1b2c3/cmd" -m ON
 * For TLS (port 8883) swap WiFiClient for WiFiClientSecure and call setCACert().
 */
#include <WiFi.h>
#include <PubSubClient.h>

// ---- User settings ----------------------------------------------------------
const char* WIFI_SSID = "YOUR_WIFI_NAME";
const char* WIFI_PASS = "YOUR_WIFI_PASSWORD";

const char*    MQTT_HOST = "broker.hivemq.com";   // public test broker - use your own for real data
const uint16_t MQTT_PORT = 1883;
const char*    MQTT_USER = "";                    // leave empty for anonymous
const char*    MQTT_PASS = "";

const uint8_t  LED_PIN = 2;                       // on-board LED on most ESP32 dev boards
const uint32_t TELEMETRY_MS = 10000;
// ------------------------------------------------------------------------------

WiFiClient wifiClient;
PubSubClient mqtt(wifiClient);

char deviceId[20];
char topicStatus[48], topicTelemetry[48], topicCmd[48];

uint32_t lastTelemetry = 0;
uint32_t lastMqttAttempt = 0;
uint32_t mqttBackoff = 1000;            // grows to 30 s while the broker is unreachable

void onMessage(char* topic, byte* payload, unsigned int length) {
  char msg[32];
  const unsigned int n = length < sizeof(msg) - 1 ? length : sizeof(msg) - 1;
  memcpy(msg, payload, n);
  msg[n] = '\0';
  Serial.printf("[%s] %s\n", topic, msg);

  if (strcasecmp(msg, "ON") == 0)       digitalWrite(LED_PIN, HIGH);
  else if (strcasecmp(msg, "OFF") == 0) digitalWrite(LED_PIN, LOW);
}

void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("Wi-Fi");
  const uint32_t started = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - started < 20000) {
    delay(400);
    Serial.print('.');
  }
  Serial.println(WiFi.status() == WL_CONNECTED ? " connected" : " failed (retrying in loop)");
}

// One non-blocking connection attempt; called from loop() with exponential backoff.
void tryConnectMqtt() {
  Serial.printf("MQTT -> %s:%u ... ", MQTT_HOST, MQTT_PORT);
  const bool ok = mqtt.connect(
      deviceId,
      MQTT_USER[0] ? MQTT_USER : nullptr,
      MQTT_USER[0] ? MQTT_PASS : nullptr,
      topicStatus, 1, true, "offline");          // Last Will: broker publishes "offline" if we vanish

  if (ok) {
    Serial.println("connected");
    mqtt.publish(topicStatus, "online", true);   // retained
    mqtt.subscribe(topicCmd);
    mqttBackoff = 1000;
  } else {
    Serial.printf("failed, rc=%d\n", mqtt.state());
    mqttBackoff = (mqttBackoff * 2 > 30000) ? 30000 : mqttBackoff * 2;
  }
}

void publishTelemetry() {
  char json[128];
  snprintf(json, sizeof(json), "{\"uptime\":%lu,\"rssi\":%d,\"heap\":%u}",
           (unsigned long)(millis() / 1000), WiFi.RSSI(), (unsigned)ESP.getFreeHeap());
  mqtt.publish(topicTelemetry, json);
  Serial.println(json);
}

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);

  uint8_t mac[6];
  WiFi.macAddress(mac);
  snprintf(deviceId, sizeof(deviceId), "esp32-%02x%02x%02x", mac[3], mac[4], mac[5]);
  snprintf(topicStatus,    sizeof(topicStatus),    "%s/status",    deviceId);
  snprintf(topicTelemetry, sizeof(topicTelemetry), "%s/telemetry", deviceId);
  snprintf(topicCmd,       sizeof(topicCmd),       "%s/cmd",       deviceId);
  Serial.printf("Device ID: %s\n", deviceId);

  connectWiFi();
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setCallback(onMessage);
  mqtt.setBufferSize(512);
  mqtt.setKeepAlive(30);
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    static uint32_t lastWifiTry = 0;
    if (millis() - lastWifiTry > 10000) {
      lastWifiTry = millis();
      WiFi.disconnect();
      WiFi.begin(WIFI_SSID, WIFI_PASS);
    }
    return;                                      // nothing else works without Wi-Fi
  }

  if (!mqtt.connected()) {
    if (millis() - lastMqttAttempt >= mqttBackoff) {
      lastMqttAttempt = millis();
      tryConnectMqtt();
    }
    return;
  }

  mqtt.loop();                                   // keep-alive + incoming messages

  if (millis() - lastTelemetry >= TELEMETRY_MS) {
    lastTelemetry = millis();
    publishTelemetry();
  }
}

/* ESP8266: replace <WiFi.h> with <ESP8266WiFi.h>; the rest of the sketch is unchanged. */
