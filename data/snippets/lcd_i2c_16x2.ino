/*
 * I2C LCD 16x2 (HD44780 + PCF8574 backpack) - Setup & Counter
 * ------------------------------------------------------------
 * Boards    : ESP32, ESP8266, Arduino Uno/Nano
 * Libraries : "LiquidCrystal I2C" by Frank de Brabander (Library Manager)
 *
 * Wiring:
 *   LCD GND -> GND     LCD VCC -> 5V (the LCD needs 5V; the I2C lines still work with 3.3V ESP32 boards)
 *   LCD SDA -> GPIO 21 (ESP32) / A4 (Uno)     LCD SCL -> GPIO 22 (ESP32) / A5 (Uno)
 * Backpack addresses are usually 0x27 or 0x3F - this sketch finds it automatically.
 * Blank screen? Turn the blue contrast potentiometer on the back of the module.
 */
#include <Wire.h>
#include <LiquidCrystal_I2C.h>

#define I2C_SDA 21
#define I2C_SCL 22
#define LCD_COLS 16
#define LCD_ROWS 2

LiquidCrystal_I2C* lcd = nullptr;
uint32_t counter = 0;
uint32_t lastTick = 0;

// Returns the first I2C address in the PCF8574/PCF8574A range that answers, or 0.
uint8_t findLcdAddress() {
  for (uint8_t address = 0x20; address <= 0x3F; address++) {
    Wire.beginTransmission(address);
    if (Wire.endTransmission() == 0) return address;
  }
  return 0;
}

void setup() {
  Serial.begin(115200);

#if defined(ESP32) || defined(ESP8266)
  Wire.begin(I2C_SDA, I2C_SCL);
#else
  Wire.begin();
#endif

  const uint8_t address = findLcdAddress();
  if (address == 0) {
    Serial.println(F("No I2C LCD found - check SDA/SCL wiring"));
    for (;;) delay(1000);
  }
  Serial.print(F("LCD found at 0x"));
  Serial.println(address, HEX);

  lcd = new LiquidCrystal_I2C(address, LCD_COLS, LCD_ROWS);
  lcd->init();
  lcd->backlight();

  lcd->setCursor(0, 0);
  lcd->print(F("Hello, world!"));
  lcd->setCursor(0, 1);
  lcd->print(F("I2C LCD 16x2"));
  delay(1500);
  lcd->clear();
}

void loop() {
  if (millis() - lastTick >= 1000) {
    lastTick = millis();
    counter++;

    lcd->setCursor(0, 0);
    lcd->print(F("Counter:"));

    lcd->setCursor(0, 1);
    lcd->print(counter);
    lcd->print(F("          "));     // overwrite leftovers when the number gets shorter
  }
}
