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

const char* streamUrl = "http://192.168.137.121:5000/upload_stream"; 
const char* analyzeUrl = "http://192.168.137.121:5000/analyze_frame";

// ---------------------------------------------------------------------------
// Pin Definitions
// ---------------------------------------------------------------------------
#define BUTTON_PIN 13  // ✅ Safe pin. Not a strapping pin. Freed by 1-bit SD mode.

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
const int STREAM_INTERVAL_MS = 200;  

bool lastButtonState = HIGH;         
unsigned long lastDebounceTime = 0;
const int DEBOUNCE_DELAY = 50;       

bool sdCardReady = false;

// ---------------------------------------------------------------------------
// FreeRTOS Background Task: The Offline Sync Queue
// ---------------------------------------------------------------------------
void backgroundSyncTask(void *pvParameters) {
  while (true) {
    if (WiFi.status() == WL_CONNECTED && sdCardReady) {
      File dir = SD_MMC.open("/");
      File file = dir.openNextFile();
      
      while (file) {
        String fileName = file.name();
        
        if (!file.isDirectory() && fileName.startsWith("queue_")) {
          String fullPath = "/" + fileName;
          Serial.println("🔄 Found queued image: " + fullPath);
          
          size_t fileSize = file.size();
          uint8_t *imgBuffer = (uint8_t*)ps_malloc(fileSize);
          
          if (imgBuffer) {
            file.read(imgBuffer, fileSize);
            file.close(); 
            
            HTTPClient http;
            http.begin(analyzeUrl);
            http.addHeader("Content-Type", "image/jpeg");
            http.setTimeout(25000); 
            
            Serial.println("📤 Uploading queued image to server...");
            int httpCode = http.POST(imgBuffer, fileSize);
            
            free(imgBuffer); 
            
            if (httpCode == 200) {
              Serial.println("✅ Upload successful! Removing from queue.");
              SD_MMC.remove(fullPath.c_str());
            } else {
              Serial.printf("❌ Upload failed (HTTP %d). Will retry later.\n", httpCode);
            }
          } else {
            file.close();
            Serial.println("❌ Failed to allocate PSRAM for upload.");
          }
          break; 
        }
        file = dir.openNextFile();
      }
    }
    vTaskDelay(pdMS_TO_TICKS(3000));
  }
}

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
  if (!SD_MMC.begin("/sdcard", true)) {
    Serial.println("⚠️ SD Card Mount Failed. System will run without offline storage.");
    sdCardReady = false;
  } else {
    Serial.println("💾 SD Card Mounted successfully in 1-bit mode.");
    sdCardReady = true;
  }
}

// ---------------------------------------------------------------------------
// Action Functions
// ---------------------------------------------------------------------------
void captureAndQueueImage() {
  camera_fb_t *fb = esp_camera_fb_get();
  if (!fb) {
    Serial.println("❌ Camera capture failed.");
    return;
  }

  if (sdCardReady) {
    String id = String(millis());
    String tempPath = "/temp_" + id + ".jpg";
    String queuePath = "/queue_" + id + ".jpg";
    
    File file = SD_MMC.open(tempPath.c_str(), FILE_WRITE);
    if (file) {
      file.write(fb->buf, fb->len);
      file.close();
      
      SD_MMC.rename(tempPath.c_str(), queuePath.c_str());
      Serial.println("💾 Image secured in offline queue: " + queuePath);
    } else {
      Serial.println("❌ Failed to write to SD card.");
    }
  } else {
    // ✅ Fallback: No SD card detected, bypass queue and upload immediately
    Serial.println("⚠️ No SD card. Attempting synchronous fallback upload...");
    if (WiFi.status() == WL_CONNECTED) {
      HTTPClient http;
      http.begin(analyzeUrl);
      http.addHeader("Content-Type", "image/jpeg");
      http.setTimeout(25000); 
      
      int httpCode = http.POST(fb->buf, fb->len);
      if (httpCode == 200) {
        Serial.println("✅ Fallback upload successful!");
      } else {
        Serial.printf("❌ Fallback upload failed (HTTP %d).\n", httpCode);
      }
      http.end();
    } else {
      Serial.println("❌ No Wi-Fi AND no SD card. Image lost!");
    }
  }

  esp_camera_fb_return(fb);
}

void streamLiveFeed() {
  camera_fb_t *fb = esp_camera_fb_get();
  if (fb) {
    HTTPClient http;
    http.begin(streamUrl);
    http.addHeader("Content-Type", "image/jpeg");
    http.setTimeout(1500); 
    http.POST(fb->buf, fb->len);
    http.end();
    esp_camera_fb_return(fb);
  }
}

// ---------------------------------------------------------------------------
// Main Loop
// ---------------------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  delay(1000);

  pinMode(BUTTON_PIN, INPUT_PULLUP);

  setupSDCard();
  connectWiFi();
  setupCamera();
  
  xTaskCreatePinnedToCore(
    backgroundSyncTask,   
    "SyncTask",           
    8192,                 
    NULL,                 
    1,                    
    NULL,                 
    0                     
  );
  
  Serial.println("🌱 Plant Monitor Ready. Press the button to analyze.");
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) connectWiFi();

  unsigned long now = millis();
  
  bool reading = digitalRead(BUTTON_PIN);
  if (reading != lastButtonState) {
    lastDebounceTime = now;
  }

  if ((now - lastDebounceTime) > DEBOUNCE_DELAY) {
    if (reading == LOW && lastButtonState == HIGH) {
      Serial.println("\n🚨 Button Press Detected! Capturing instantly...");
      captureAndQueueImage();
      lastButtonState = reading; 
    } else if (reading == HIGH) {
      lastButtonState = HIGH;
    }
  }

  if (now - lastStreamTime >= STREAM_INTERVAL_MS) {
    lastStreamTime = now;
    if (WiFi.status() == WL_CONNECTED) {
      streamLiveFeed();
    }
  }
}