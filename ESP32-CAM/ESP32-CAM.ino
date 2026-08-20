#include "esp_camera.h"
#include <WiFi.h>
#include <HTTPClient.h>
#include "FS.h"
#include "SD_MMC.h"

// ---------------------------------------------------------------------------
// Wi-Fi & Server Credentials
// ---------------------------------------------------------------------------
const char* ssid = "bbj";
const char* password = "32145678";

// UPDATE THIS with the IP address of your PC running the Flask server
const char* streamUrl = "http://192.168.137.121:5000/upload_stream"; 
const char* analyzeUrl = "http://192.168.137.121:5000/analyze_frame";

// ---------------------------------------------------------------------------
// Pin Definitions
// ---------------------------------------------------------------------------
#define BUTTON_PIN 13  // Free to use because SD card is in 1-bit mode

// AI-Thinker OV2640 Pins
#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27
#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

// ---------------------------------------------------------------------------
// State & Timing Variables
// ---------------------------------------------------------------------------
unsigned long lastStreamTime = 0;
const int STREAM_INTERVAL_MS = 200;  // 5 frames per second for live feed

unsigned long lastButtonTime = 0;
const int BUTTON_COOLDOWN_MS = 4000; // Prevent spamming the Gemini API

bool sdCardReady = false;

// ---------------------------------------------------------------------------
// Setup Functions
// ---------------------------------------------------------------------------
void connectWiFi() {
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\n✅ WiFi connected!");
  Serial.print("📡 IP address: ");
  Serial.println(WiFi.localIP());
}

void setupCamera() {
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sscb_sda = SIOD_GPIO_NUM;
  config.pin_sscb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;
  
  // VGA is a great balance between OCR detail and low memory usage
  config.frame_size = FRAMESIZE_VGA; 
  config.jpeg_quality = 12;          
  config.fb_count = 1;

  if (esp_camera_init(&config) != ESP_OK) {
    Serial.println("❌ Camera init failed!");
    while (1) { delay(1000); }
  }
  Serial.println("📸 Camera ready.");
}

void setupSDCard() {
  // true = 1-bit mode. This frees up GPIO 4, 12, and 13!
  if (!SD_MMC.begin("/sdcard", true)) {
    Serial.println("⚠️ SD Card Mount Failed. Continuing without offline storage.");
    sdCardReady = false;
  } else {
    Serial.println("💾 SD Card Mounted successfully in 1-bit mode.");
    sdCardReady = true;
  }
}

// ---------------------------------------------------------------------------
// Action Functions
// ---------------------------------------------------------------------------
void saveToSD(camera_fb_t *fb) {
  if (!sdCardReady) return;

  // Use millis to generate a unique filename
  String path = "/plant_" + String(millis()) + ".jpg";
  File file = SD_MMC.open(path.c_str(), FILE_WRITE);
  
  if (!file) {
    Serial.println("❌ Failed to open SD file for writing");
  } else {
    file.write(fb->buf, fb->len);
    Serial.printf("✅ Saved offline image to SD: %s\n", path.c_str());
  }
  file.close();
}

void triggerAIAnalysis(camera_fb_t *fb) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("⚠️ No Wi-Fi! Image saved to SD card only.");
    return;
  }

  HTTPClient http;
  http.begin(analyzeUrl);
  http.addHeader("Content-Type", "image/jpeg");
  http.setTimeout(25000); // Give Gemini time to process (25 seconds)

  Serial.println("📤 Sending image for AI analysis...");
  int httpResponseCode = http.POST(fb->buf, fb->len);

  if (httpResponseCode == 200) {
    Serial.println("✅ Analysis successful! Data saved to PostgreSQL.");
  } else {
    Serial.printf("❌ Analysis POST failed, HTTP Code: %d\n", httpResponseCode);
  }
  http.end();
}

void streamLiveFeed(camera_fb_t *fb) {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(streamUrl);
    http.addHeader("Content-Type", "image/jpeg");
    http.setTimeout(2000); // Quick timeout to keep the stream flowing
    http.POST(fb->buf, fb->len);
    http.end();
  }
}

// ---------------------------------------------------------------------------
// Main Loop
// ---------------------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  delay(1000);

  // Configure the button with the internal pull-up resistor
  pinMode(BUTTON_PIN, INPUT_PULLUP);

  setupSDCard();
  connectWiFi();
  setupCamera();
  
  Serial.println("🌱 Plant Monitor Ready. Press the button on GPIO 13 to analyze.");
}

void loop() {
  // Check Wi-Fi connection
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }

  unsigned long now = millis();
  
  // Read the button (LOW means pressed because of INPUT_PULLUP)
  bool buttonPressed = (digitalRead(BUTTON_PIN) == LOW);
  bool cooldownExpired = (now - lastButtonTime > BUTTON_COOLDOWN_MS);

  if (buttonPressed && cooldownExpired) {
    lastButtonTime = now;
    Serial.println("\n🚨 Button Pressed! Capturing image...");
    
    camera_fb_t *fb = esp_camera_fb_get();
    if (fb) {
      // 1. Save locally to the SD card
      saveToSD(fb);
      
      // 2. Send to Flask server for Gemini Analysis
      triggerAIAnalysis(fb);
      
      esp_camera_fb_return(fb);
    } else {
      Serial.println("❌ Camera capture failed.");
    }
  } 
  // If button isn't pressed, send the background live feed
  else if (now - lastStreamTime >= STREAM_INTERVAL_MS) {
    lastStreamTime = now;
    camera_fb_t *fb = esp_camera_fb_get();
    if (fb) {
      streamLiveFeed(fb);
      esp_camera_fb_return(fb);
    }
  }
}