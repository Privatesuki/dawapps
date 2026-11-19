/*
 * SSD1306 OLED (128x64, I2C) - Initialization & Text Print
 * ------------------------------------------------------------
 * Boards    : ESP32, ESP8266, Arduino Uno/Nano (AVR)
 * Libraries : "Adafruit SSD1306" and "Adafruit GFX Library" (Library Manager)
 *
 * Wiring (4 pins):
 *   OLED VCC -> 3V3 (or 5V on modules with a regulator)    OLED GND -> GND
 *   OLED SDA -> GPIO 21 (ESP32) / A4 (Uno)
 *   OLED SCL -> GPIO 22 (ESP32) / A5 (Uno)
 * Most modules use address 0x3C (a few use 0x3D). Run an I2C scanner if unsure.
 */
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

#define SCREEN_WIDTH  128
#define SCREEN_HEIGHT 64
#define OLED_RESET    -1       // -1 = share the board reset pin (no dedicated pin)
#define OLED_ADDR     0x3C

#define I2C_SDA 21             // ESP32 default; ESP8266 NodeMCU: D2 (GPIO4)
#define I2C_SCL 22             // ESP32 default; ESP8266 NodeMCU: D1 (GPIO5)

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

uint32_t counter = 0;
uint32_t lastTick = 0;

void setup() {
  Serial.begin(115200);

#if defined(ESP32) || defined(ESP8266)
  Wire.begin(I2C_SDA, I2C_SCL);
#else
  Wire.begin();                // AVR boards use fixed hardware I2C pins
#endif

  if (!display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDR)) {
    Serial.println(F("SSD1306 not found - check wiring and address"));
    for (;;) delay(1000);      // halt: nothing useful to do without a display
  }

  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);

  display.setTextSize(1);
  display.setCursor(0, 0);
  display.println(F("Hello, OLED!"));

  display.setTextSize(2);
  display.println(F("ESP32"));

  display.setTextSize(1);
  display.println(F("128x64 I2C SSD1306"));
  display.display();           // nothing is shown until display() pushes the buffer
  delay(1500);
}

void loop() {
  if (millis() - lastTick >= 1000) {
    lastTick = millis();
    counter++;

    display.clearDisplay();
    display.setTextSize(1);
    display.setCursor(0, 0);
    display.print(F("Uptime: "));
    display.print(millis() / 1000);
    display.println(F(" s"));

    display.setTextSize(3);
    display.setCursor(0, 24);
    display.print(counter);

    display.display();
  }
}
